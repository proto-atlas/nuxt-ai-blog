/**
 * Cloudflare Workersのenv bindingをh3 H3Eventから安全に取り出すadapter。
 *
 * Rate Limiting Binding / Durable Objectsへ移行する場合に備え、adapter + 型定義を先に分離する。
 * `wrangler.jsonc` への実binding追加は、Cloudflare側のbinding作成後に行う。
 *
 * 設計:
 * - h3 v2 / Nitro Cloudflare presetでは `event.context.cloudflare.env` で
 * binding (D1Database / Rate Limit Binding等) にアクセスできる
 * (https://www.nitro.build/deploy/providers/cloudflare参照)
 * - test / local devでは `event.context.cloudflare` はundefinedなので、
 * 型ガードでempty `{}` を返して呼び出し側でmemory fallbackに倒す
 * - 戻り値は `unknown` を含めず、production bindingが型推論で使えるよう
 * interfaceをexportする
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

import type {
  DurableObjectNamespaceLike,
  SummaryCacheStub,
  SummaryQuotaStub,
} from './summary-control-types';

/**
 * Cloudflare Rate Limiting Bindingの最小型。
 * 公式docs (https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
 * の `limit({ key })` シグネチャに合わせる。`success: boolean` を返す。
 */
export interface CloudflareRateLimiter {
  limit: (input: { key: string }) => Promise<{ success: boolean }>;
}

/**
 * Cloudflare Workersのenv bindingをまとめた型。
 * 各bindingは本番でのみ存在 (wrangler.jsoncに配線後)。test / localでは未配線で
 * undefined。production codeでは `if (env.X)` の型ガードで分岐する。
 */
export interface CloudflareEnv {
  /** D1 binding (`wrangler.jsonc` の `bindings.DB`)。Nuxt Content 3 がD1 切替後に使用予定 */
  DB?: unknown;
  /** Global daily quotaを固定名Durable Objectに集約するbinding。 */
  SUMMARY_QUOTA?: DurableObjectNamespaceLike<SummaryQuotaStub>;
  /** AI要約cacheとin-flight状態をDurable Object Storageに保存するbinding。 */
  SUMMARY_CACHE?: DurableObjectNamespaceLike<SummaryCacheStub>;
  /**
   * Rate Limiting bindingを追加した場合のadapter。
   * 現状は未配線。binding追加後にdeployment疎通確認 で有効性を確認する。
   */
  RATE_LIMITER?: CloudflareRateLimiter;
}

/**
 * h3 H3Eventから `event.context.cloudflare.env` を抽出する。
 * 取得失敗時 (test / local dev / 構造不一致) は空objectを返す → 呼び出し側で
 * `if (env.X)` ガードでmemory fallbackに倒す設計。
 *
 * 安全性:
 * - eventがnull / objectでない場合もthrowせず空objectを返す
 * - context.cloudflareが無い場合も同上
 * - envプロパティが存在してもshapeが合わない場合は呼び出し側で型ガード必須
 */
export function getCloudflareEnv(event: unknown): CloudflareEnv {
  if (!event || typeof event !== 'object') return {};
  const e = event as { context?: { cloudflare?: { env?: unknown } } };
  const env = e.context?.cloudflare?.env;
  if (!env || typeof env !== 'object') return {};
  return env as CloudflareEnv;
}
