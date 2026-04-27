/**
 * /api/summary 周りの h3 / Web API 依存を含む小さなヘルパー。
 *
 * route ハンドラ (server/api/summary.post.ts) から切り出してユニットテスト可能性を
 * 上げる目的。Anthropic SDK / Nuxt Content など重い依存を持たないので
 * Vitest happy-dom 環境からそのまま import できる。
 */
import type { SummaryErrorCode, SummaryErrorData } from '#shared/error-codes';

/**
 * h3 createError を SummaryErrorCode 化したラッパー。
 * statusMessage は code 文字列、data は { error: code, retryAfterSeconds? } の
 * 統一形式に揃える。クライアント側 (useAiSummary) は data.error を読んで
 * labelForSummaryError で日本語ラベルに変換する。
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
 * h3 H3Event から AbortSignal を取り出すヘルパー。
 * h3 v2 では `event.req` が Web API Request 互換で `signal` を持つ。
 * h3 v1 互換 (`event.node.req.signal`) も最後の手段として確認する。
 *
 * Cloudflare Workers の `enable_request_signal` flag (wrangler.jsonc) が
 * 有効だと、クライアント離脱時にこの signal が abort される
 * (README / docs/ARCHITECTURE で記載している課金保護の実装)。
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
