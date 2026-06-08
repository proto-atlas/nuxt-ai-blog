/**
 * /api/summary route handler本体のユニットテスト。
 *
 * `executeSummaryHandler` をnamed export化し、第 2 引数の依存注入で
 * summaryClient / queryCollectionをmockに差し替えて主要分岐を直接呼び出す。
 *
 * Nuxtのauto-import (`createError` / `setResponseHeader` / `useRuntimeConfig` /
 * `readBody` / `getRequestHeader` / `defineEventHandler`) は `vi.stubGlobal` で
 * stubする。`#imports` のqueryCollectionはtest環境でclient side fetcher
 * として走ろうとして `$fetch is not defined` でfailするため、依存注入で完全に
 * 差し替える設計にした。
 *
 * カバーする分岐:
 * 1. success (cache miss → summaryClient → cacheSet → response)
 * 2. cache hit (2 回目はcached:trueでsummaryClient不呼出し)
 * 3. invalid_input (slug形式NG)
 * 4. article_not_found (queryCollectionがnull)
 * 5. server_misconfigured (apiKeyなし)
 * 6. upstream_unavailable (summaryClient throw)
 * 7. AbortSignal伝播 (event.req.signalをsummaryClientに渡す)
 * 8. AbortSignalなし (signalを強制注入しない)
 * 9. access_required (アクセスキー不一致)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { H3Event } from 'h3';
import { _resetDailyLimitForTesting } from '../utils/daily-limit';
import { _resetSummaryControlMemoryForTesting } from '../utils/summary-control';
import type { SummaryAiClient } from '../utils/summary-ai-client';
import { executeSummaryHandler } from './summary.post';

// summary.post.tsのトップレベル `export default defineEventHandler(...)` は
// import時に評価されるので、vi.hoistedでglobalThisにidentity関数を先に
// 注入しておく (Nuxt serverのauto-importをtest環境で代替)。`createError` /
// `setResponseHeader` 等はhandler実行時にしか呼ばれないためbeforeEachで十分。
vi.hoisted(() => {
  (globalThis as unknown as { defineEventHandler: (h: unknown) => unknown }).defineEventHandler = (
    h,
  ) => h;
});

// vi.mockはvitestがimportの前にautomaticにhoistする仕様。
// queryCollectionはtest環境でSQL Builder clientが動こうとしてfailするため、
// `#imports` を最低限の空モジュールに置き換える。実体は依存注入で渡す。
vi.mock('#imports', () => ({
  queryCollection: vi.fn(),
}));

// Anthropic SDKは実呼び出しを避けるためclass全体をmock。実体は依存注入で渡す。
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}));

interface MockArticle {
  title: string;
  description: string;
  body: { type: string; children: { type: string; value: string }[] };
}

const SAMPLE_ARTICLE: MockArticle = {
  title: 'ESLint 10 flat configの実務設定',
  description: 'flat config移行時の罠と最低限の設定。',
  body: {
    type: 'root',
    children: [{ type: 'text', value: 'flat configの本文サンプル。' }],
  },
};
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

/** queryCollectionのmockを生成する。article=nullならnot_foundケース。 */
function makeQueryCollection(article: MockArticle | null): ReturnType<typeof vi.fn> {
  return vi.fn(() => ({
    path: () => ({
      first: () => Promise.resolve(article),
    }),
  }));
}

/**
 * route本体からAnthropic SDK constructorを隠し、adapter化したsummaryClientをmockする。
 */
function makeSummaryClient(
  behavior: 'success' | 'throw',
  text = 'mock summary',
): {
  summaryClient: SummaryAiClient;
  createSummarySpy: ReturnType<typeof vi.fn>;
} {
  const createSummarySpy =
    behavior === 'success'
      ? vi.fn().mockResolvedValue({ summary: text, model: 'claude-haiku-4-5-20251001' })
      : vi.fn().mockRejectedValue(new Error('Anthropic 502 Bad Gateway'));
  return { summaryClient: { createSummary: createSummarySpy }, createSummarySpy };
}

/** test用の最小H3Event mock (handlerが触る部分だけ実装) */
function makeEvent(opts: { signal?: AbortSignal } = {}): H3Event {
  return {
    req: opts.signal ? { signal: opts.signal } : {},
    node: { req: {} },
  } as unknown as H3Event;
}

describe('executeSummaryHandler (route handler本体)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetDailyLimitForTesting();
    _resetSummaryControlMemoryForTesting();

    // Nuxt server auto-importをstub
    vi.stubGlobal(
      'createError',
      vi.fn((arg: { statusCode: number; statusMessage: string; data: unknown }) => {
        const err = new Error(arg.statusMessage) as Error & {
          statusCode: number;
          statusMessage: string;
          data: unknown;
        };
        err.statusCode = arg.statusCode;
        err.statusMessage = arg.statusMessage;
        err.data = arg.data;
        return err;
      }),
    );
    vi.stubGlobal('setResponseHeader', vi.fn());
    vi.stubGlobal(
      'readBody',
      vi.fn().mockResolvedValue({ slug: 'eslint-10-flat-config-practical' }),
    );
    vi.stubGlobal(
      'getRequestHeader',
      vi.fn((_event: unknown, name: string) => {
        // テストでCF-Connecting-IPベースのper-IP rate-limit bucketがテスト間で
        // 混ざらないよう、テストごとに異なるIPを返してもよいが、ここではclearAllMocks
        // と _resetDailyLimitForTesting + 単発呼び出しの組み合わせで十分なため固定値で。
        if (name === 'CF-Connecting-IP') return `203.0.113.${Math.floor(Math.random() * 254) + 1}`;
        return undefined;
      }),
    );
    vi.stubGlobal(
      'defineEventHandler',
      vi.fn((handler: unknown) => handler),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  it('成功フロー: cache miss → Anthropic呼び出し → response返却', async () => {
    const queryCollection = makeQueryCollection(SAMPLE_ARTICLE);
    const { summaryClient, createSummarySpy } = makeSummaryClient(
      'success',
      'flat config移行はpluginのtypegenとPrettier干渉に注意。',
    );

    const result = await executeSummaryHandler(makeEvent(), {
      queryCollection,
      summaryClient,
      runtimeConfig: { anthropicApiKey: 'sk-test-key' },
    });

    expect(result.slug).toBe('eslint-10-flat-config-practical');
    expect(result.summary).toContain('flat config');
    expect(result.model).toBe('claude-haiku-4-5-20251001');
    expect(result.cached).toBe(false);
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(createSummarySpy).toHaveBeenCalledTimes(1);
    expect(createSummarySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-test-key',
        sourceText: expect.stringContaining('flat config'),
      }),
    );
  });

  it('cache hit: 同じslugを 2 回呼ぶと 2 回目はcached:trueでSDK不呼出し', async () => {
    // 同一slugを使い、Math.random IPの影響を受けない範囲でSDK呼び出し回数を比較
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ slug: 'cache-hit-test-slug' }));
    const queryCollection = makeQueryCollection(SAMPLE_ARTICLE);
    const { summaryClient, createSummarySpy } = makeSummaryClient('success');

    const deps = {
      queryCollection,
      summaryClient,
      runtimeConfig: { anthropicApiKey: 'sk-test-key' },
    };
    const first = await executeSummaryHandler(makeEvent(), deps);
    expect(first.cached).toBe(false);
    expect(createSummarySpy).toHaveBeenCalledTimes(1);

    const second = await executeSummaryHandler(makeEvent(), deps);
    expect(second.cached).toBe(true);
    expect(createSummarySpy).toHaveBeenCalledTimes(1); // 増えない
  });

  it('invalid_input: slug形式違反は 400 + invalid_inputをthrow', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ slug: '../etc/passwd' }));
    const queryCollection = makeQueryCollection(SAMPLE_ARTICLE);
    const { summaryClient, createSummarySpy } = makeSummaryClient('success');

    await expect(
      executeSummaryHandler(makeEvent(), {
        queryCollection,
        summaryClient,
        runtimeConfig: { anthropicApiKey: 'sk-test-key' },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'invalid_input',
      data: { error: 'invalid_input' },
    });
    expect(createSummarySpy).not.toHaveBeenCalled();
  });

  it('article_not_found: queryCollectionがnullで 404 + article_not_found', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ slug: 'no-such-article-test' }));
    const queryCollection = makeQueryCollection(null);
    const { summaryClient, createSummarySpy } = makeSummaryClient('success');

    await expect(
      executeSummaryHandler(makeEvent(), {
        queryCollection,
        summaryClient,
        runtimeConfig: { anthropicApiKey: 'sk-test-key' },
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'article_not_found',
      data: { error: 'article_not_found' },
    });
    expect(createSummarySpy).not.toHaveBeenCalled();
  });

  it('server_misconfigured: apiKey未設定で 500 + server_misconfigured', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ slug: 'server-misconfigured-test' }));
    const queryCollection = makeQueryCollection(SAMPLE_ARTICLE);
    const { summaryClient, createSummarySpy } = makeSummaryClient('success');

    await expect(
      executeSummaryHandler(makeEvent(), {
        queryCollection,
        summaryClient,
        runtimeConfig: { anthropicApiKey: '' }, // 未設定を再現
      }),
    ).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'server_misconfigured',
      data: { error: 'server_misconfigured' },
    });
    expect(createSummarySpy).not.toHaveBeenCalled();
  });

  it('server_misconfigured: productionでDurable Object bindingが無いとmemory fallbackせず 500', async () => {
    process.env.NODE_ENV = 'production';
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ slug: 'missing-do-binding-test' }));
    const queryCollection = makeQueryCollection(SAMPLE_ARTICLE);
    const { summaryClient, createSummarySpy } = makeSummaryClient('success');

    await expect(
      executeSummaryHandler(makeEvent(), {
        queryCollection,
        summaryClient,
        runtimeConfig: { anthropicApiKey: 'sk-test-key' },
      }),
    ).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'server_misconfigured',
      data: { error: 'server_misconfigured' },
    });
    expect(createSummarySpy).not.toHaveBeenCalled();
  });

  it('access_required: summaryAccessKey設定時にヘッダが無いと 401 + access_required', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ slug: 'access-required-test' }));
    const queryCollection = makeQueryCollection(SAMPLE_ARTICLE);
    const { summaryClient, createSummarySpy } = makeSummaryClient('success');

    await expect(
      executeSummaryHandler(makeEvent(), {
        queryCollection,
        summaryClient,
        runtimeConfig: {
          anthropicApiKey: 'sk-test-key',
          summaryAccessKey: 'demo-access-key',
        },
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'access_required',
      data: { error: 'access_required' },
    });
    expect(createSummarySpy).not.toHaveBeenCalled();
  });

  it('アクセスキー: summaryAccessKeyとヘッダが一致すればAnthropicを呼ぶ', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ slug: 'access-key-success-test' }));
    vi.stubGlobal(
      'getRequestHeader',
      vi.fn((_event: unknown, name: string) => {
        if (name === 'x-summary-access-key') return 'demo-access-key';
        if (name === 'CF-Connecting-IP') return '203.0.113.200';
        return undefined;
      }),
    );
    const queryCollection = makeQueryCollection(SAMPLE_ARTICLE);
    const { summaryClient, createSummarySpy } = makeSummaryClient('success');

    await executeSummaryHandler(makeEvent(), {
      queryCollection,
      summaryClient,
      runtimeConfig: {
        anthropicApiKey: 'sk-test-key',
        summaryAccessKey: 'demo-access-key',
      },
    });

    expect(createSummarySpy).toHaveBeenCalledTimes(1);
  });

  it('upstream_unavailable: Anthropic SDKがthrowすると 500 + upstream_unavailable', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ slug: 'upstream-fail-test' }));
    const queryCollection = makeQueryCollection(SAMPLE_ARTICLE);
    const { summaryClient, createSummarySpy } = makeSummaryClient('throw');

    await expect(
      executeSummaryHandler(makeEvent(), {
        queryCollection,
        summaryClient,
        runtimeConfig: { anthropicApiKey: 'sk-test-key' },
      }),
    ).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'upstream_unavailable',
      data: { error: 'upstream_unavailable' },
    });
    expect(createSummarySpy).toHaveBeenCalledTimes(1);
  });

  it('AbortSignal伝播: event.req.signalがsummaryClientに渡る', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ slug: 'abort-signal-test' }));
    const controller = new AbortController();
    const queryCollection = makeQueryCollection(SAMPLE_ARTICLE);
    const { summaryClient, createSummarySpy } = makeSummaryClient('success');

    await executeSummaryHandler(makeEvent({ signal: controller.signal }), {
      queryCollection,
      summaryClient,
      runtimeConfig: { anthropicApiKey: 'sk-test-key' },
    });

    expect(createSummarySpy).toHaveBeenCalledTimes(1);
    expect(createSummarySpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('AbortSignalなし: event.reqにsignalがなければsummaryClientへsignalを渡さない', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ slug: 'abort-signal-absent-test' }));
    const queryCollection = makeQueryCollection(SAMPLE_ARTICLE);
    const { summaryClient, createSummarySpy } = makeSummaryClient('success');

    await executeSummaryHandler(makeEvent(), {
      queryCollection,
      summaryClient,
      runtimeConfig: { anthropicApiKey: 'sk-test-key' },
    });

    expect(createSummarySpy).toHaveBeenCalledTimes(1);
    expect(createSummarySpy.mock.calls[0]?.[0]).not.toHaveProperty('signal');
  });
});
