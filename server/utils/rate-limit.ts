/**
 * In-memory sliding window rate limiter, keyed by IP.
 * Nuxt/Nitroサーバー向けのin-memory sliding window rate limiter。
 *
 * なぜin-memory:
 *   - デモ規模のトラフィック、ほぼ同一Worker isolateにヒット
 *   - KV / D1 / Rate Limiting binding設定前の最低限の防御
 *
 * 本番スケール時はenv.RATE_LIMITER.limit({ key }) などに差し替え可能な設計。
 */

import type { H3Event } from 'h3';

interface RequestLog {
  timestamps: number[];
}

const buckets = new Map<string, RequestLog>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(ip: string, now: number = Date.now()): RateLimitResult {
  const cutoff = now - WINDOW_MS;
  const bucket = buckets.get(ip) ?? { timestamps: [] };

  // 期限切れタイムスタンプをdrop
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= MAX_REQUESTS) {
    // noUncheckedIndexedAccess対策: length >= MAX_REQUESTS (>=1) なので [0] は必ず存在
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterMs = WINDOW_MS - (now - oldest);
    buckets.set(ip, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  bucket.timestamps.push(now);
  buckets.set(ip, bucket);
  return {
    allowed: true,
    remaining: MAX_REQUESTS - bucket.timestamps.length,
    retryAfterSeconds: 0,
  };
}

/** h3 eventからclient IPを取り出す。CloudflareのCF-Connecting-IPを優先。 */
export function getClientIp(event: H3Event): string {
  return (
    getRequestHeader(event, 'CF-Connecting-IP') ??
    getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}
