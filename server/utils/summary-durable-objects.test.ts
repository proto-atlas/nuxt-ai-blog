import { describe, expect, it } from 'vitest';
import { GlobalSummaryQuotaDO, SummaryCacheDO } from './summary-durable-objects';

class FakeStorage {
  private readonly store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T | undefined;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }
}

function makeState(): { storage: FakeStorage } {
  return { storage: new FakeStorage() };
}

describe('SummaryCacheDO', () => {
  it('claim 後の同一 cacheKey は pending になり、store 後に hit になる', async () => {
    const cache = new SummaryCacheDO(makeState());

    const claim = await cache.claim({
      cacheKey: 'summary:v1:model:slug:hash',
      now: 1_000,
      pendingTtlMs: 30_000,
    });
    expect(claim).toEqual({ status: 'claimed' });

    const pending = await cache.inspect({
      cacheKey: 'summary:v1:model:slug:hash',
      now: 1_100,
    });
    expect(pending).toEqual({ status: 'pending', retryAfterSeconds: 30 });

    await cache.store({
      cacheKey: 'summary:v1:model:slug:hash',
      now: 2_000,
      ttlMs: 60_000,
      value: {
        slug: 'slug',
        summary: '要約本文',
        model: 'model',
        generatedAt: '2026-04-29T00:00:00.000Z',
      },
    });

    const hit = await cache.inspect({
      cacheKey: 'summary:v1:model:slug:hash',
      now: 2_100,
    });
    expect(hit).toEqual({
      status: 'hit',
      value: {
        slug: 'slug',
        summary: '要約本文',
        model: 'model',
        generatedAt: '2026-04-29T00:00:00.000Z',
      },
    });
  });

  it('期限切れ cache と pending は miss として扱う', async () => {
    const cache = new SummaryCacheDO(makeState());
    await cache.store({
      cacheKey: 'summary:v1:expired',
      now: 1_000,
      ttlMs: 10,
      value: {
        slug: 'expired',
        summary: '期限切れ',
        model: 'model',
        generatedAt: '2026-04-29T00:00:00.000Z',
      },
    });

    const expiredCache = await cache.inspect({ cacheKey: 'summary:v1:expired', now: 1_100 });
    expect(expiredCache).toEqual({ status: 'miss' });

    await cache.claim({ cacheKey: 'summary:v1:pending', now: 2_000, pendingTtlMs: 10 });
    const expiredPending = await cache.inspect({ cacheKey: 'summary:v1:pending', now: 2_100 });
    expect(expiredPending).toEqual({ status: 'miss' });
  });
});

describe('GlobalSummaryQuotaDO', () => {
  it('quota は reserve 時点で消費し、上限到達後は retryAfterSeconds を返す', async () => {
    const quota = new GlobalSummaryQuotaDO(makeState());
    const first = await quota.reserveDailyGeneration({
      date: '2026-04-29',
      limit: 2,
      now: Date.parse('2026-04-29T12:00:00Z'),
    });
    const second = await quota.reserveDailyGeneration({
      date: '2026-04-29',
      limit: 2,
      now: Date.parse('2026-04-29T12:00:01Z'),
    });
    const third = await quota.reserveDailyGeneration({
      date: '2026-04-29',
      limit: 2,
      now: Date.parse('2026-04-29T12:00:02Z'),
    });

    expect(first).toEqual({ allowed: true, remaining: 1 });
    expect(second).toEqual({ allowed: true, remaining: 0 });
    expect(third).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 43_198,
    });
  });

  it('成功と upstream call 後失敗は reserve count と別に記録できる', async () => {
    const state = makeState();
    const quota = new GlobalSummaryQuotaDO(state);
    await quota.reserveDailyGeneration({
      date: '2026-04-29',
      limit: 10,
      now: Date.parse('2026-04-29T12:00:00Z'),
    });
    await quota.markGenerationSucceeded({ date: '2026-04-29' });
    await quota.markGenerationFailedAfterUpstreamCall({ date: '2026-04-29' });

    await expect(state.storage.get('summary-quota:2026-04-29')).resolves.toEqual({
      reserved: 1,
      succeeded: 1,
      failedAfterUpstreamCall: 1,
    });
  });
});
