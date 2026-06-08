/**
 * cloudflare-env.ts (Cloudflare Workers env binding adapter) のunitテスト。
 *
 * productionの `event.context.cloudflare.env` 経路と、test / local devでenvが無い
 * fallback経路の両方をカバーする。
 */
import { describe, expect, it } from 'vitest';
import { getCloudflareEnv } from './cloudflare-env';

describe('getCloudflareEnv', () => {
  it('event.context.cloudflare.envが存在すればそのまま返す', () => {
    const mockRateLimiter = {
      limit: async () => ({ success: true }),
    };
    const mockQuota = {
      idFromName: (name: string) => ({ name }),
      get: () => ({
        reserveDailyGeneration: async () => ({ allowed: true as const, remaining: 199 }),
        markGenerationSucceeded: async () => undefined,
        markGenerationFailedAfterUpstreamCall: async () => undefined,
      }),
    };
    const mockCache = {
      idFromName: (name: string) => ({ name }),
      get: () => ({
        inspect: async () => ({ status: 'miss' as const }),
        claim: async () => ({ status: 'claimed' as const }),
        wait: async () => ({ status: 'timeout' as const }),
        store: async () => undefined,
        release: async () => undefined,
      }),
    };
    const event = {
      context: {
        cloudflare: {
          env: {
            DB: { binding: 'D1' },
            RATE_LIMITER: mockRateLimiter,
            SUMMARY_QUOTA: mockQuota,
            SUMMARY_CACHE: mockCache,
          },
        },
      },
    };
    const result = getCloudflareEnv(event);
    expect(result.DB).toEqual({ binding: 'D1' });
    expect(result.RATE_LIMITER).toBe(mockRateLimiter);
    expect(result.SUMMARY_QUOTA).toBe(mockQuota);
    expect(result.SUMMARY_CACHE).toBe(mockCache);
  });

  it('eventがnull / undefined / 文字列でも空objectを返す (throwしない)', () => {
    expect(getCloudflareEnv(null)).toEqual({});
    expect(getCloudflareEnv(undefined)).toEqual({});
    expect(getCloudflareEnv('event-string')).toEqual({});
    expect(getCloudflareEnv(42)).toEqual({});
  });

  it('event.context.cloudflareが無ければ空object (test / local dev fallback)', () => {
    expect(getCloudflareEnv({})).toEqual({});
    expect(getCloudflareEnv({ context: {} })).toEqual({});
    expect(getCloudflareEnv({ context: { cloudflare: {} } })).toEqual({});
  });

  it('envプロパティがobjectでなければ空object', () => {
    expect(getCloudflareEnv({ context: { cloudflare: { env: null } } })).toEqual({});
    expect(getCloudflareEnv({ context: { cloudflare: { env: 'string' } } })).toEqual({});
  });
});
