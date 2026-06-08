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
const SUMMARY_PENDING_TTL_MS = 35 * 1000; // Anthropic timeout 30s + commit余裕
const SUMMARY_PENDING_WAIT_MS = 10 * 1000; // 同一keyの二重生成を避ける待機上限

export interface SummaryResponse {
  slug: string;
  summary: string;
  model: string;
  cached: boolean;
  generatedAt: string;
}

/**
 * `executeSummaryHandler` の依存注入インターフェイス。
 * productionではdefault値を使うため指定不要、テストではAnthropic SDK / Nuxt
 * ContentのqueryCollectionをmockに差し替える経路として使う
 * (defineEventHandlerラッパーから分離 + 依存注入可能に)。
 */
export interface SummaryHandlerDeps {
  /** `@nuxt/content` のqueryCollection (server overload)。testではmock関数を渡す。 */
  queryCollection?: unknown;
  /** Anthropic SDK境界を隠すadapter。testではmock clientを渡す。 */
  summaryClient?: SummaryAiClient;
  /**
   * Runtime config (`useRuntimeConfig(event)` の結果)。
   * productionではdefault export側で `useRuntimeConfig(event)` を呼んで渡す。
   * testでは `vi.stubGlobal` 経由だとVitestが `nuxt/dist/app/nuxt.js` の
   * 実体をresolveしてしまい `[nuxt] instance unavailable` で落ちるので、
   * 依存注入で完全に切り離す。
   */
  runtimeConfig?: { anthropicApiKey?: unknown; summaryAccessKey?: unknown };
}

/**
 * /api/summaryのhandler本体。
 *
 * `defineEventHandler` のラッパーから分離してnamed exportにすることで、
 * Vitestからもmock event + 依存stubで直接呼び出してテストできる
 * ようにする。default exportはこの関数を `defineEventHandler` でラップしただけで、
 * 追加ロジックは持たない。
 */
export async function executeSummaryHandler(
  event: H3Event,
  deps: SummaryHandlerDeps = {},
): Promise<SummaryResponse> {
  // 依存注入: testではmockを、productionではimportしたdefault実装を使う。
  // 型を `unknown` で受けて呼び出し直前にキャストすることで、`@nuxt/content` の
  // server overloadとclient overloadの型乖離 (serverはevent第一引数、clientは
  // collection第一引数) によるテスト側のTypeScript不整合を吸収する。
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

  // 2. 要約APIのアクセスキー確認（公開記事は読めるまま、AI生成だけを保護）
  const access = checkSummaryAccess(event, config.summaryAccessKey);
  if (!access.allowed) {
    const code = access.error ?? 'access_required';
    throw summaryError(code, code === 'access_required' ? 401 : 500);
  }

  // 3. Body parse + slug validation (parseSummaryRequestでruntime narrowing、
  // SSRF / path traversal対策: 英小文字数字ハイフンのみ)
  const rawBody: unknown = await readBody(event);
  const parsed = parseSummaryRequest(rawBody);
  if (!parsed.ok) {
    throw summaryError(parsed.error, 400);
  }
  const slug = parsed.slug;

  // 4. Fetch article body
  // Nuxt Content 3 のserver-side queryCollectionの型境界はadapterに閉じ込める。
  const article = await fetchBlogArticleBySlug(event, slug, queryCollection);
  if (!article) {
    throw summaryError('article_not_found', 404);
  }
  // Nuxt Content 3 のMDC ASTから平文を抽出する。
  // title + description + 本文 (text node連結、4000 文字truncate) を要約源に。
  // body抽出失敗時はtitle + descriptionのみでfallback (article-text.test.tsでカバー)。
  // BlogCollectionItemは { title, description, body } を含むので構造的subtypeで渡せる。
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

  // 5. Durable Object cache check。cache hitは実APIのquotaを消費しない。
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

  // 6. API key取得 (Workers Secret経由、コードにハードコードしない)。
  // productionではdefault export側で `useRuntimeConfig(event)` を呼んでdepsに
  // 詰めて渡す。testではdeps.runtimeConfigを直接渡す (VitestのNuxt instance
  // 依存問題を回避)。
  const apiKey = config.anthropicApiKey;
  if (!apiKey || typeof apiKey !== 'string') {
    // 環境変数名そのものをUIに出さない (攻撃者にスタック推定材料を与えない)。
    // 詳細はサーバーログにのみ残す。
    console.error('[/api/summary] anthropicApiKey is not configured');
    throw summaryError('server_misconfigured', 500);
  }

  // 7. 同一slug / articleHash / modelの二重 実API生成を避ける。
  // claim内でもcacheを再確認し、別requestが先にcacheを埋めた場合はhitとして返す。
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

  // 8. Global daily limit。quotaは実API呼び出しを開始する権利としてreserveする。
  // cache hit / unauthorized / validation errorではreserveしない。
  const daily = await reserveDailyGeneration(summaryControl);
  if (!daily.allowed) {
    await releaseSummaryClaim(summaryControl, cacheKey);
    setResponseHeader(event, 'Retry-After', daily.retryAfterSeconds);
    throw summaryError('rate_limit', 429, daily.retryAfterSeconds);
  }

  // 9. Anthropic呼び出し (try/catchでSDK例外を捕まえる、SDK例外処理対応)。
  // maxRetries: 0 で 429/5xx時のSDK自動リトライによる多重課金を防ぐ。
  // timeout: 30sでAnthropic側のスタックを長時間保持しない (Cloudflare Workersの
  // CPU時間制限 30sとAnthropic Haiku 4.5 の典型応答 1〜3sを踏まえた余裕値、
  // SDKのデフォルト 10 分timeoutは本ユースケースで長すぎる)。
  // request signalをSDKに伝播 → クライアント離脱でSDK fetchも中断、
  // レスポンス未受信ならAnthropic側の課金を回避できる
  // 固定日次上限は全体消費を抑え、Workers Spend Limitは請求上限として別に設定する。
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
    // SDK例外の生messageはUIに出さない (OWASP Improper Error Handling)。
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

// productionではNuxt auto-importのuseRuntimeConfigをdefault export側で評価し、
// 結果をdepsとしてexecuteSummaryHandlerに渡す。これでhandler本体はNuxt
// runtimeに直接依存せず、テストではdeps.runtimeConfigをmock値に差し替えられる。
export default defineEventHandler((event) =>
  executeSummaryHandler(event, { runtimeConfig: useRuntimeConfig(event) }),
);
