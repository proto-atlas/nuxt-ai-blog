/**
 * Cloudflare Workers の env binding を h3 H3Event から安全に取り出す adapter。
 *
 * Rate Limiting Binding へ移行する場合に備え、adapter + 型定義を先に分離する。
 * `wrangler.jsonc` への実 binding 追加は、Cloudflare 側の binding 作成後に行う。
 *
 * 設計:
 * - h3 v2 / Nitro Cloudflare preset では `event.context.cloudflare.env` で
 * binding (D1Database / Rate Limit Binding 等) にアクセスできる
 * (https://www.nitro.build/deploy/providers/cloudflare 参照)
 * - test / local dev では `event.context.cloudflare` は undefined なので、
 * 型ガードで empty `{}` を返して呼び出し側で memory fallback に倒す
 * - 戻り値は `unknown` を含めず、production binding が型推論で使えるよう
 * interface を export する
 *
 * 将来的な利用イメージ:
 * const env = getCloudflareEnv(event);
 * if (env.RATE_LIMITER) {
 * const result = await env.RATE_LIMITER.limit({ key: `summary:${slug}` });
 * if (!result.success) throw summaryError('rate_limit', 429);
 * } else {
 * // memory fallback (server/utils/rate-limit.ts)
 * }
 */

/**
 * Cloudflare Rate Limiting Binding の最小型。
 * 公式 docs (https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
 * の `limit({ key })` シグネチャに合わせる。`success: boolean` を返す。
 */
export interface CloudflareRateLimiter {
  limit: (input: { key: string }) => Promise<{ success: boolean }>;
}

/**
 * Cloudflare Workers の env binding をまとめた型。
 * 各 binding は本番でのみ存在 (wrangler.jsonc に配線後)。test / local では未配線で
 * undefined。production code では `if (env.X)` の型ガードで分岐する。
 */
export interface CloudflareEnv {
  /** D1 binding (`wrangler.jsonc` の `bindings.DB`)。Nuxt Content 3 が D1 切替後に使用予定 */
  DB?: unknown;
  /**
   * Rate Limiting binding を追加した場合の adapter。
   * 現状は未配線、binding 追加 + 本番 smoke は公開前最終確認送り。
   */
  RATE_LIMITER?: CloudflareRateLimiter;
}

/**
 * h3 H3Event から `event.context.cloudflare.env` を抽出する。
 * 取得失敗時 (test / local dev / 構造不一致) は空 object を返す → 呼び出し側で
 * `if (env.X)` ガードで memory fallback に倒す設計。
 *
 * 安全性:
 * - event が null / object でない場合も throw せず空 object を返す
 * - context.cloudflare が無い場合も同上
 * - env プロパティが存在しても shape が合わない場合は呼び出し側で型ガード必須
 */
export function getCloudflareEnv(event: unknown): CloudflareEnv {
  if (!event || typeof event !== 'object') return {};
  const e = event as { context?: { cloudflare?: { env?: unknown } } };
  const env = e.context?.cloudflare?.env;
  if (!env || typeof env !== 'object') return {};
  return env as CloudflareEnv;
}
