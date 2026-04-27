/**
 * cloudflare-env.ts (Cloudflare Workers env binding adapter) の unit テスト。
 *
 * production の `event.context.cloudflare.env` 経路と、test / local dev で env が無い
 * fallback 経路の両方をカバーする。
 */
import { describe, expect, it } from 'vitest';
import { getCloudflareEnv } from './cloudflare-env';

describe('getCloudflareEnv', () => {
  it('event.context.cloudflare.env が存在すればそのまま返す', () => {
    const mockRateLimiter = {
      limit: async () => ({ success: true }),
    };
    const event = {
      context: {
        cloudflare: {
          env: {
            DB: { binding: 'D1' },
            RATE_LIMITER: mockRateLimiter,
          },
        },
      },
    };
    const result = getCloudflareEnv(event);
    expect(result.DB).toEqual({ binding: 'D1' });
    expect(result.RATE_LIMITER).toBe(mockRateLimiter);
  });

  it('event が null / undefined / 文字列でも空 object を返す (throw しない)', () => {
    expect(getCloudflareEnv(null)).toEqual({});
    expect(getCloudflareEnv(undefined)).toEqual({});
    expect(getCloudflareEnv('event-string')).toEqual({});
    expect(getCloudflareEnv(42)).toEqual({});
  });

  it('event.context.cloudflare が無ければ空 object (test / local dev fallback)', () => {
    expect(getCloudflareEnv({})).toEqual({});
    expect(getCloudflareEnv({ context: {} })).toEqual({});
    expect(getCloudflareEnv({ context: { cloudflare: {} } })).toEqual({});
  });

  it('env プロパティが object でなければ空 object', () => {
    expect(getCloudflareEnv({ context: { cloudflare: { env: null } } })).toEqual({});
    expect(getCloudflareEnv({ context: { cloudflare: { env: 'string' } } })).toEqual({});
  });
});
