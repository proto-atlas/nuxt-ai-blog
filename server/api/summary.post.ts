// 理由: @anthropic-ai/sdk 0.90 の messages.create の戻り値型が ESLint の型推論と
// 相性が悪く、unsafe 系エラーを誤検出する。実行時の型安全性は SDK 側で保証される。

import AnthropicSdk from '@anthropic-ai/sdk';
import type { H3Event } from 'h3';
import { cacheGet, cacheSet } from '../utils/cache';
import { checkRateLimit, getClientIp } from '../utils/rate-limit';
import { checkDailyLimit } from '../utils/daily-limit';
import { parseSummaryRequest, extractFirstText } from '../utils/summary-parse';
import { buildSummarySource } from '../utils/article-text';
import { summaryError, getRequestSignal } from '../utils/summary-helpers';
import { queryCollection as defaultQueryCollection } from '#imports';

const MODEL = 'claude-haiku-4-5-20251001';
const SUMMARY_TTL_MS = 60 * 60 * 1000; // 1 時間

export interface SummaryResponse {
  slug: string;
  summary: string;
  model: string;
  cached: boolean;
  generatedAt: string;
}

/**
 * `executeSummaryHandler` の依存注入インターフェイス。
 * production では default 値を使うため指定不要、テストでは Anthropic SDK / Nuxt
 * Content の queryCollection を mock に差し替える経路として使う
 * (defineEventHandler ラッパーから分離 + 依存注入可能に)。
 */
export interface SummaryHandlerDeps {
  /** `@nuxt/content` の queryCollection (server overload)。test では mock 関数を渡す。 */
  queryCollection?: unknown;
  /** Anthropic SDK の constructor。test では mock class を渡す。 */
  AnthropicCtor?: unknown;
  /**
   * Runtime config (`useRuntimeConfig(event)` の結果)。
   * production では default export 側で `useRuntimeConfig(event)` を呼んで渡す。
   * test では `vi.stubGlobal` 経由だと Vitest が `nuxt/dist/app/nuxt.js` の
   * 実体を resolve してしまい `[nuxt] instance unavailable` で落ちるので、
   * 依存注入で完全に切り離す。
   */
  runtimeConfig?: { anthropicApiKey?: unknown };
}

/**
 * /api/summary の handler 本体。
 *
 * `defineEventHandler` のラッパーから分離して named export にすることで、
 * Vitest からも mock event + 依存 stub で直接呼び出してテストできる
 * ようにする。default export はこの関数を `defineEventHandler` でラップしただけで、
 * 追加ロジックは持たない。
 */
export async function executeSummaryHandler(
  event: H3Event,
  deps: SummaryHandlerDeps = {},
): Promise<SummaryResponse> {
  // 依存注入: test では mock を、production では import した default 実装を使う。
  // 型を `unknown` で受けて呼び出し直前にキャストすることで、`@nuxt/content` の
  // server overload と client overload の型乖離 (server は event 第一引数、client は
  // collection 第一引数) によるテスト側の TypeScript 不整合を吸収する。
  const queryCollection =
    (deps.queryCollection as typeof defaultQueryCollection | undefined) ?? defaultQueryCollection;
  const AnthropicCtor = (deps.AnthropicCtor as typeof AnthropicSdk | undefined) ?? AnthropicSdk;
  // 1. Per-IP rate limit (1 ユーザーの連投を抑制)
  const ip = getClientIp(event);
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    setResponseHeader(event, 'Retry-After', rate.retryAfterSeconds);
    throw summaryError('rate_limit', 429, rate.retryAfterSeconds);
  }

  // 2. Global daily limit (IP rotation 攻撃や全体消費を抑制、Anthropic 課金の最終防衛)
  const daily = checkDailyLimit();
  if (!daily.allowed) {
    setResponseHeader(event, 'Retry-After', daily.retryAfterSeconds);
    throw summaryError('rate_limit', 429, daily.retryAfterSeconds);
  }

  // 3. Body parse + slug validation (parseSummaryRequest で runtime narrowing、
  // SSRF / path traversal 対策: 英小文字数字ハイフンのみ)
  const rawBody: unknown = await readBody(event);
  const parsed = parseSummaryRequest(rawBody);
  if (!parsed.ok) {
    throw summaryError(parsed.error, 400);
  }
  const slug = parsed.slug;

  // 4. Cache hit check
  const cacheKey = `summary:${slug}`;
  const cached = cacheGet<SummaryResponse>(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  // 5. Fetch article body
  // Nuxt Content 3 の server-side queryCollection は第 1 引数に event が必須
  // (https://content.nuxt.com の Server-side Querying 仕様)。event 抜きで呼ぶと
  // getRequestHeaders が event.node を参照する箇所で TypeError になる。
  // 型定義は client 版 (1 引数) のみ公開されているため @ts-expect-error で抑制する。
  // @ts-expect-error queryCollection の server overload は型定義に公開されていない
  const article = await queryCollection(event, 'blog').path(`/blog/${slug}`).first();
  if (!article) {
    throw summaryError('article_not_found', 404);
  }
  // Nuxt Content 3 の MDC AST から平文を抽出する。
  // title + description + 本文 (text node 連結、4000 文字 truncate) を要約源に。
  // body 抽出失敗時は title + description のみで fallback (article-text.test.ts でカバー)。
  // BlogCollectionItem は { title, description, body } を含むので構造的 subtype で渡せる。
  const sourceText = buildSummarySource(article);

  // 6. API key 取得 (Workers Secret 経由、コードにハードコードしない)。
  // production では default export 側で `useRuntimeConfig(event)` を呼んで deps に
  // 詰めて渡す。test では deps.runtimeConfig を直接渡す (Vitest の Nuxt instance
  // 依存問題を回避)。
  const config = deps.runtimeConfig ?? useRuntimeConfig(event);
  const apiKey = config.anthropicApiKey;
  if (!apiKey || typeof apiKey !== 'string') {
    // 環境変数名そのものを UI に出さない (攻撃者にスタック推定材料を与えない)。
    // 詳細はサーバーログにのみ残す。
    console.error('[/api/summary] anthropicApiKey is not configured');
    throw summaryError('server_misconfigured', 500);
  }

  // 7. Anthropic 呼び出し (try/catch で SDK 例外を捕まえる、SDK例外処理対応)。
  // maxRetries: 0 で 429/5xx 時の SDK 自動リトライによる多重課金を防ぐ。
  // timeout: 30s で Anthropic 側のスタックを長時間保持しない (Cloudflare Workers の
  // CPU 時間制限 30s と Anthropic Haiku 4.5 の典型応答 1〜3s を踏まえた余裕値、
  // SDK のデフォルト 10 分 timeout は本ユースケースで長すぎる)。
  // request signal を SDK に伝播 → クライアント離脱で SDK fetch も中断、
  // レスポンス未受信なら Anthropic 側の課金を回避できる
  // (Workers Spend Limit が最終防衛、enable_request_signal が前段防衛、
  // これが中段防衛)。
  const client = new AnthropicCtor({ apiKey, maxRetries: 0, timeout: 30_000 });
  const requestSignal = getRequestSignal(event);
  let summary: string;
  let model: string;
  try {
    const msg = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 256,
        system:
          'あなたは技術記事を 150 文字以内で簡潔に要約するアシスタントです。回答は日本語で、箇条書きではなく 1〜2 文の平文で書いてください。',
        messages: [
          {
            role: 'user',
            content: `次の記事 (タイトル / 概要 / 本文の要点) を読んで、主要な論点を 150 文字以内で要約してください。\n\n---\n\n${sourceText}`,
          },
        ],
      },
      requestSignal ? { signal: requestSignal } : undefined,
    );

    // content は TextBlock のみを想定 (画像含まない)。extractFirstText で型を
    // narrow し、外部 API 形式変更にも空文字 fallback で耐える。
    summary = extractFirstText(msg.content);
    model = MODEL;
  } catch (err) {
    // SDK 例外の生 message は UI に出さない (OWASP Improper Error Handling)。
    // 詳細はサーバーログにのみ残す。
    console.error('[/api/summary] anthropic stream failed:', err);
    throw summaryError('upstream_unavailable', 500);
  }

  // 8. キャッシュ書き込み + レスポンス
  const response: SummaryResponse = {
    slug,
    summary,
    model,
    cached: false,
    generatedAt: new Date().toISOString(),
  };
  cacheSet(cacheKey, response, SUMMARY_TTL_MS);

  return response;
}

// production では Nuxt auto-import の useRuntimeConfig を default export 側で評価し、
// 結果を deps として executeSummaryHandler に渡す。これで handler 本体は Nuxt
// runtime に直接依存せず、テストでは deps.runtimeConfig を mock 値に差し替えられる。
export default defineEventHandler((event) =>
  executeSummaryHandler(event, { runtimeConfig: useRuntimeConfig(event) }),
);
