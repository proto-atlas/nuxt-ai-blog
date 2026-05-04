import { afterEach, describe, expect, it } from 'vitest';
import {
  _resetSummaryControlMemoryForTesting,
  buildSummaryCacheKey,
  claimSummaryGeneration,
  inspectSummaryCache,
  isProductionRuntime,
  releaseSummaryClaim,
  resolveSummaryControl,
  storeSummaryCache,
  waitForPendingSummary,
} from './summary-control';

describe('summary-control', () => {
  afterEach(() => {
    _resetSummaryControlMemoryForTesting();
    process.env.NODE_ENV = 'test';
  });

  it('同じ slug / model / sourceText なら同じ cache key を返す', async () => {
    const first = await buildSummaryCacheKey({
      slug: 'nuxt-content-workers',
      model: 'claude-haiku-4-5-20251001',
      sourceText: 'Nuxt Content on Workers',
    });
    const second = await buildSummaryCacheKey({
      slug: 'nuxt-content-workers',
      model: 'claude-haiku-4-5-20251001',
      sourceText: 'Nuxt Content on Workers',
    });

    expect(first).toBe(second);
    expect(first).toBe(
      'summary:v1:claude-haiku-4-5-20251001:nuxt-content-workers:b125a16aad2c50ddb3379e062eb73932a11c722db5bc734b1688ab6e23d1ea39',
    );
  });

  it('sourceText が変わると article hash が変わり cache key も変わる', async () => {
    const first = await buildSummaryCacheKey({
      slug: 'nuxt-content-workers',
      model: 'claude-haiku-4-5-20251001',
      sourceText: 'old article',
    });
    const second = await buildSummaryCacheKey({
      slug: 'nuxt-content-workers',
      model: 'claude-haiku-4-5-20251001',
      sourceText: 'new article',
    });

    expect(first).not.toBe(second);
  });

  it('Cloudflare binding が揃っていれば durable control を返す', () => {
    const quotaBinding = {
      idFromName: (name: string) => ({ name }),
      get: () => ({
        reserveDailyGeneration: async () => ({ allowed: true as const, remaining: 199 }),
        markGenerationSucceeded: async () => undefined,
        markGenerationFailedAfterUpstreamCall: async () => undefined,
      }),
    };
    const cacheBinding = {
      idFromName: (name: string) => ({ name }),
      get: () => ({
        inspect: async () => ({ status: 'miss' as const }),
        claim: async () => ({ status: 'claimed' as const }),
        wait: async () => ({ status: 'timeout' as const }),
        store: async () => undefined,
        release: async () => undefined,
      }),
    };
    const result = resolveSummaryControl({
      context: {
        cloudflare: {
          env: {
            SUMMARY_QUOTA: quotaBinding,
            SUMMARY_CACHE: cacheBinding,
          },
        },
      },
    });

    expect(result.missingBindings).toEqual([]);
    expect(result.control.kind).toBe('durable');
  });

  it('binding が無い場合は missingBindings と memory fallback を返す', () => {
    const result = resolveSummaryControl({ context: { cloudflare: { env: {} } } });

    expect(result.control.kind).toBe('memory');
    expect(result.missingBindings).toEqual(['SUMMARY_QUOTA', 'SUMMARY_CACHE']);
  });

  it('production 判定は NODE_ENV=production のときだけ true', () => {
    process.env.NODE_ENV = 'production';
    expect(isProductionRuntime()).toBe(true);
    process.env.NODE_ENV = 'test';
    expect(isProductionRuntime()).toBe(false);
  });

  it('memory fallback は claim 中の同一 key を pending として扱い release 後に timeout へ戻る', async () => {
    const result = resolveSummaryControl({});
    const claim = await claimSummaryGeneration(result.control, 'summary:v1:test', 1_000, 1_000);
    expect(claim).toEqual({ status: 'claimed' });

    const inspected = await inspectSummaryCache(result.control, 'summary:v1:test', 1_100);
    expect(inspected).toEqual({ status: 'pending', retryAfterSeconds: 1 });

    await releaseSummaryClaim(result.control, 'summary:v1:test');
    const afterRelease = await waitForPendingSummary(result.control, 'summary:v1:test', 1, 1_200);
    expect(afterRelease).toEqual({ status: 'timeout' });
  });

  it('memory fallback は store 後に cache hit を返す', async () => {
    const result = resolveSummaryControl({});
    await storeSummaryCache(
      result.control,
      'summary:v1:stored',
      {
        slug: 'stored',
        summary: '要約本文',
        model: 'claude-haiku-4-5-20251001',
        generatedAt: '2026-04-29T00:00:00.000Z',
      },
      1_000,
      1_000,
    );

    const inspected = await inspectSummaryCache(result.control, 'summary:v1:stored', 1_100);
    expect(inspected).toEqual({
      status: 'hit',
      value: {
        slug: 'stored',
        summary: '要約本文',
        model: 'claude-haiku-4-5-20251001',
        generatedAt: '2026-04-29T00:00:00.000Z',
      },
    });
  });
});
