import type { H3Event } from 'h3';
import { checkRateLimit, getClientIp } from '../utils/rate-limit';
import { parseSummaryRequest } from '../utils/summary-parse';
import { buildSummarySource } from '../utils/article-text';
import { summaryError, getRequestSignal } from '../utils/summary-helpers';
import { checkSummaryAccess } from '../utils/summary-access';
import { fetchBlogArticleBySlug } from '../utils/content-query';
import {
  createAnthropicSummaryClient,
  SUMMARY_MODEL,
  type SummaryAiClient,
} from '../utils/summary-ai-client';
import {
  buildSummaryCacheKey,
  claimSummaryGeneration,
  inspectSummaryCache,
  isProductionRuntime,
  markGenerationFailedAfterUpstreamCall,
  markGenerationSucceeded,
  releaseSummaryClaim,
  reserveDailyGeneration,
  resolveSummaryControl,
  storeSummaryCache,
  waitForPendingSummary,
} from '../utils/summary-control';
import { queryCollection as defaultQueryCollection } from '#imports';

const SUMMARY_TTL_MS = 60 * 60 * 1000; // 1 時間
const SUMMARY_PENDING_TTL_MS = 35 * 1000; // Anthropic timeout 30s + commit 余裕
const SUMMARY_PENDING_WAIT_MS = 10 * 1000; // 同一 key の二重生成を避ける待機上限

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
  /** Anthropic SDK 境界を隠す adapter。test では mock client を渡す。 */
  summaryClient?: SummaryAiClient;
  /**
   * Runtime config (`useRuntimeConfig(event)` の結果)。
   * production では default export 側で `useRuntimeConfig(event)` を呼んで渡す。
   * test では `vi.stubGlobal` 経由だと Vitest が `nuxt/dist/app/nuxt.js` の
   * 実体を resolve してしまい `[nuxt] instance unavailable` で落ちるので、
   * 依存注入で完全に切り離す。
   */
  runtimeConfig?: { anthropicApiKey?: unknown; summaryAccessKey?: unknown };
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
  const summaryClient = deps.summaryClient ?? createAnthropicSummaryClient();
  const config = deps.runtimeConfig ?? useRuntimeConfig(event);

  // 1. Per-IP rate limit (1 ユーザーの連投を抑制)
  const ip = getClientIp(event);
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    setResponseHeader(event, 'Retry-After', rate.retryAfterSeconds);
    throw summaryError('rate_limit', 429, rate.retryAfterSeconds);
  }

  // 2. Access key gate (公開記事は読めるまま、AI生成だけをデモ用キーで保護)
  const access = checkSummaryAccess(event, config.summaryAccessKey);
  if (!access.allowed) {
    const code = access.error ?? 'access_required';
    throw summaryError(code, code === 'access_required' ? 401 : 500);
  }

  // 3. Body parse + slug validation (parseSummaryRequest で runtime narrowing、
  // SSRF / path traversal 対策: 英小文字数字ハイフンのみ)
  const rawBody: unknown = await readBody(event);
  const parsed = parseSummaryRequest(rawBody);
  if (!parsed.ok) {
    throw summaryError(parsed.error, 400);
  }
  const slug = parsed.slug;

  // 4. Fetch article body
  // Nuxt Content 3 の server-side queryCollection の型境界は adapter に閉じ込める。
  const article = await fetchBlogArticleBySlug(event, slug, queryCollection);
  if (!article) {
    throw summaryError('article_not_found', 404);
  }
  // Nuxt Content 3 の MDC AST から平文を抽出する。
  // title + description + 本文 (text node 連結、4000 文字 truncate) を要約源に。
  // body 抽出失敗時は title + description のみで fallback (article-text.test.ts でカバー)。
  // BlogCollectionItem は { title, description, body } を含むので構造的 subtype で渡せる。
  const sourceText = buildSummarySource(article);
  const cacheKey = await buildSummaryCacheKey({ slug, model: SUMMARY_MODEL, sourceText });
  const controlResolution = resolveSummaryControl(event);
  if (isProductionRuntime() && controlResolution.missingBindings.length > 0) {
    console.error(
      '[/api/summary] summary Durable Object bindings are missing:',
      controlResolution.missingBindings.join(', '),
    );
    throw summaryError('server_misconfigured', 500);
  }
  const summaryControl = controlResolution.control;

  // 5. Durable Object cache check。cache hit は live AI quota を消費しない。
  const cached = await inspectSummaryCache(summaryControl, cacheKey);
  if (cached.status === 'hit') {
    return { ...cached.value, cached: true };
  }
  if (cached.status === 'pending') {
    const waited = await waitForPendingSummary(summaryControl, cacheKey, SUMMARY_PENDING_WAIT_MS);
    if (waited.status === 'hit') {
      return { ...waited.value, cached: true };
    }
    setResponseHeader(event, 'Retry-After', cached.retryAfterSeconds);
    throw summaryError('rate_limit', 429, cached.retryAfterSeconds);
  }

  // 6. API key 取得 (Workers Secret 経由、コードにハードコードしない)。
  // production では default export 側で `useRuntimeConfig(event)` を呼んで deps に
  // 詰めて渡す。test では deps.runtimeConfig を直接渡す (Vitest の Nuxt instance
  // 依存問題を回避)。
  const apiKey = config.anthropicApiKey;
  if (!apiKey || typeof apiKey !== 'string') {
    // 環境変数名そのものを UI に出さない (攻撃者にスタック推定材料を与えない)。
    // 詳細はサーバーログにのみ残す。
    console.error('[/api/summary] anthropicApiKey is not configured');
    throw summaryError('server_misconfigured', 500);
  }

  // 7. 同一 slug / articleHash / model の二重 live AI 生成を避ける。
  // claim 内でも cache を再確認し、別 request が先に cache を埋めた場合は hit として返す。
  const claim = await claimSummaryGeneration(summaryControl, cacheKey, SUMMARY_PENDING_TTL_MS);
  if (claim.status === 'hit') {
    return { ...claim.value, cached: true };
  }
  if (claim.status === 'pending') {
    const waited = await waitForPendingSummary(summaryControl, cacheKey, SUMMARY_PENDING_WAIT_MS);
    if (waited.status === 'hit') {
      return { ...waited.value, cached: true };
    }
    setResponseHeader(event, 'Retry-After', claim.retryAfterSeconds);
    throw summaryError('rate_limit', 429, claim.retryAfterSeconds);
  }

  // 8. Global daily limit。quota は live AI API call を開始する権利として reserve する。
  // cache hit / unauthorized / validation error では reserve しない。
  const daily = await reserveDailyGeneration(summaryControl);
  if (!daily.allowed) {
    await releaseSummaryClaim(summaryControl, cacheKey);
    setResponseHeader(event, 'Retry-After', daily.retryAfterSeconds);
    throw summaryError('rate_limit', 429, daily.retryAfterSeconds);
  }

  // 9. Anthropic 呼び出し (try/catch で SDK 例外を捕まえる、SDK例外処理対応)。
  // maxRetries: 0 で 429/5xx 時の SDK 自動リトライによる多重課金を防ぐ。
  // timeout: 30s で Anthropic 側のスタックを長時間保持しない (Cloudflare Workers の
  // CPU 時間制限 30s と Anthropic Haiku 4.5 の典型応答 1〜3s を踏まえた余裕値、
  // SDK のデフォルト 10 分 timeout は本ユースケースで長すぎる)。
  // request signal を SDK に伝播 → クライアント離脱で SDK fetch も中断、
  // レスポンス未受信なら Anthropic 側の課金を回避できる
  // (Workers Spend Limit が最終防衛、enable_request_signal が前段防衛、
  // これが中段防衛)。
  const requestSignal = getRequestSignal(event);
  let summary: string;
  let model: string;
  try {
    const generated = await summaryClient.createSummary(
      requestSignal ? { apiKey, sourceText, signal: requestSignal } : { apiKey, sourceText },
    );
    summary = generated.summary;
    model = generated.model;
  } catch (err) {
    // SDK 例外の生 message は UI に出さない (OWASP Improper Error Handling)。
    // 詳細はサーバーログにのみ残す。
    console.error('[/api/summary] anthropic stream failed:', err);
    await markGenerationFailedAfterUpstreamCall(summaryControl);
    await releaseSummaryClaim(summaryControl, cacheKey);
    throw summaryError('upstream_unavailable', 500);
  }

  // 10. キャッシュ書き込み + レスポンス
  const payload = {
    slug,
    summary,
    model,
    generatedAt: new Date().toISOString(),
  };
  await storeSummaryCache(summaryControl, cacheKey, payload, SUMMARY_TTL_MS);
  await markGenerationSucceeded(summaryControl);

  return { ...payload, cached: false };
}

// production では Nuxt auto-import の useRuntimeConfig を default export 側で評価し、
// 結果を deps として executeSummaryHandler に渡す。これで handler 本体は Nuxt
// runtime に直接依存せず、テストでは deps.runtimeConfig を mock 値に差し替えられる。
export default defineEventHandler((event) =>
  executeSummaryHandler(event, { runtimeConfig: useRuntimeConfig(event) }),
);
