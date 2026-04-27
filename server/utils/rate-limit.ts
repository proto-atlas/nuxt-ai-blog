/**
 * In-memory sliding window rate limiter, keyed by IP.
 * citation-reader の lib/rate-limit.ts と同等の挙動 (Nuxt/Nitro サーバー向けに移植)。
 *
 * なぜ in-memory:
 *   - デモ規模のトラフィック、ほぼ同一 Worker isolate にヒット
 *   - KV / D1 / Rate Limiting binding 設定前の最低限の防御
 *
 * 本番スケール時は env.RATE_LIMITER.limit({ key }) などに差し替え可能な設計。
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

  // 期限切れタイムスタンプを drop
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= MAX_REQUESTS) {
    // noUncheckedIndexedAccess 対策: length >= MAX_REQUESTS (>=1) なので [0] は必ず存在
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

/** h3 event から client IP を取り出す。Cloudflare の CF-Connecting-IP を優先。 */
export function getClientIp(event: H3Event): string {
  return (
    getRequestHeader(event, 'CF-Connecting-IP') ??
    getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}
