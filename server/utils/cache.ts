/**
 * Simple in-memory cache with TTL.
 * AI要約結果をslugでkeying。同一記事の繰り返し要約でAnthropic呼び出しを抑えコスト保護。
 *
 * Workers isolate分散によりキャッシュmissするisolateもあるが、
 * デモ用途では許容範囲。本番で厳密に共有したい場合はKV or Durable Objectsに置換。
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/** valueをcacheに保存。既存keyは上書き。 */
export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** cacheから取り出す。未存在or期限切れならnull。 */
export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}
