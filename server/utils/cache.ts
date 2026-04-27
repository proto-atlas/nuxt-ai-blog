/**
 * Simple in-memory cache with TTL.
 * AI 要約結果を slug で keying。同一記事の繰り返し要約で Anthropic 呼び出しを抑えコスト保護。
 *
 * Workers isolate 分散によりキャッシュ miss する isolate もあるが、
 * デモ用途では許容範囲。本番で厳密に共有したい場合は KV or Durable Objects に置換。
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/** value を cache に保存。既存 key は上書き。 */
export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** cache から取り出す。未存在 or 期限切れなら null。 */
export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}
