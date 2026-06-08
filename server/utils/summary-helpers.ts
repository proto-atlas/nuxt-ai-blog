/**
 * /api/summary周りのh3 / Web API依存を含む小さなヘルパー。
 *
 * routeハンドラ (server/api/summary.post.ts) から切り出してユニットテスト可能性を
 * 上げる目的。Anthropic SDK / Nuxt Contentなど重い依存を持たないので
 * Vitest happy-dom環境からそのままimportできる。
 */
import type { SummaryErrorCode, SummaryErrorData } from '#shared/error-codes';

/**
 * h3 createErrorをSummaryErrorCode化したラッパー。
 * statusMessageはcode文字列、dataは { error: code, retryAfterSeconds? } の
 * 統一形式に揃える。クライアント側 (useAiSummary) はdata.errorを読んで
 * labelForSummaryErrorで日本語ラベルに変換する。
 */
export function summaryError(
  code: SummaryErrorCode,
  statusCode: number,
  retryAfterSeconds?: number,
): ReturnType<typeof createError> {
  const data: SummaryErrorData = { error: code };
  if (retryAfterSeconds !== undefined) {
    data.retryAfterSeconds = retryAfterSeconds;
  }
  return createError({
    statusCode,
    statusMessage: code,
    data,
  });
}

/**
 * h3 H3EventからAbortSignalを取り出すヘルパー。
 * h3 v2 では `event.req` がWeb API Request互換で `signal` を持つ。
 * h3 v1 互換 (`event.node.req.signal`) も最後の手段として確認する。
 *
 * Cloudflare Workersの `enable_request_signal` flag (wrangler.jsonc) が
 * 有効だと、クライアント離脱時にこのsignalがabortされる
 * (README / docs/ARCHITECTUREで記載している課金保護の実装)。
 */
export function getRequestSignal(event: unknown): AbortSignal | undefined {
  if (!event || typeof event !== 'object') return undefined;
  const e = event as {
    req?: { signal?: unknown };
    node?: { req?: { signal?: unknown } };
  };
  if (e.req?.signal instanceof AbortSignal) return e.req.signal;
  if (e.node?.req?.signal instanceof AbortSignal) return e.node.req.signal;
  return undefined;
}
