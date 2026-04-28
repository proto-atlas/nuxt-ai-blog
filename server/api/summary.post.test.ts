/**
 * /api/summary route handler 本体のユニットテスト。
 *
 * `executeSummaryHandler` を named export 化し、第 2 引数の依存注入で
 * Anthropic SDK / queryCollection を mock に差し替えて主要分岐を直接呼び出す。
 *
 * Nuxt の auto-import (`createError` / `setResponseHeader` / `useRuntimeConfig` /
 * `readBody` / `getRequestHeader` / `defineEventHandler`) は `vi.stubGlobal` で
 * stub する。`#imports` の queryCollection は test 環境で client side fetcher
 * として走ろうとして `$fetch is not defined` で fail するため、依存注入で完全に
 * 差し替える設計にした。
 *
 * カバーする分岐:
 * 1. success (cache miss → SDK → cacheSet → response)
 * 2. cache hit (2 回目は cached:true で SDK 不呼出し)
 * 3. invalid_input (slug 形式 NG)
 * 4. article_not_found (queryCollection が null)
 * 5. server_misconfigured (apiKey なし)
 * 6. upstream_unavailable (Anthropic SDK throw)
 * 7. AbortSignal 伝播 (event.req.signal を SDK options に渡す)
 * 8. AbortSignal なし (signal を強制注入しない)
 * 9. access_required (アクセスキー不一致)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { H3Event } from 'h3';
import { _resetDailyLimitForTesting } from '../utils/daily-limit';
import { executeSummaryHandler } from './summary.post';

// summary.post.ts のトップレベル `export default defineEventHandler(...)` は
// import 時に評価されるので、vi.hoisted で globalThis に identity 関数を先に
// 注入しておく (Nuxt server の auto-import を test 環境で代替)。`createError` /
// `setResponseHeader` 等は handler 実行時にしか呼ばれないため beforeEach で十分。
vi.hoisted(() => {
  (globalThis as unknown as { defineEventHandler: (h: unknown) => unknown }).defineEventHandler = (
    h,
  ) => h;
});

// vi.mock は vitest が import の前に automatic に hoist する仕様。
// queryCollection は test 環境で SQL Builder client が動こうとして fail するため、
// `#imports` を最低限の空モジュールに置き換える。実体は依存注入で渡す。
vi.mock('#imports', () => ({
  queryCollection: vi.fn(),
}));

// Anthropic SDK は実呼び出しを避けるため class 全体を mock。実体は依存注入で渡す。
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}));

interface MockArticle {
  title: string;
  description: string;
  body: { type: string; children: { type: string; value: string }[] };
}

const SAMPLE_ARTICLE: MockArticle = {
  title: 'ESLint 10 flat config の実務設定',
  description: 'flat config 移行時の罠と最低限の設定。',
  body: {
    type: 'root',
    children: [{ type: 'text', value: 'flat config の本文サンプル。' }],
  },
};

/** queryCollection の mock を生成する。article=null なら not_found ケース。 */
function makeQueryCollection(article: MockArticle | null): ReturnType<typeof vi.fn> {
  return vi.fn(() => ({
    path: () => ({
      first: () => Promise.resolve(article),
    }),
  }));
}

interface AnthropicConstructorOptions {
  apiKey?: string;
  maxRetries?: number;
  timeout?: number;
}

/**
 * Anthropic SDK の mock class を生成する。create() が text を返す or throw。
 * constructorOptions は new で渡された options を蓄積するため、handler が
 * `new AnthropicCtor({ apiKey, maxRetries: 0, timeout: 30_000 })` を呼んだことを
 * test で検証できる。
 *
 * production の Anthropic SDK は `new Anthropic({ apiKey, maxRetries, timeout })` で
 * 渡せる引数を持つ。test mock の戻り型は `unknown` で、deps.AnthropicCtor の型は
 * handler 側で `unknown` で受けて `typeof AnthropicSdk` に cast する。
 */
function makeAnthropicCtor(
  behavior: 'success' | 'throw',
  text = 'mock summary',
): {
  ctor: unknown;
  createSpy: ReturnType<typeof vi.fn>;
  constructorOptions: AnthropicConstructorOptions[];
} {
  const createSpy =
    behavior === 'success'
      ? vi.fn().mockResolvedValue({ content: [{ type: 'text', text }] })
      : vi.fn().mockRejectedValue(new Error('Anthropic 502 Bad Gateway'));
  const constructorOptions: AnthropicConstructorOptions[] = [];
  class MockAnthropicSdk {
    messages = { create: createSpy };
    constructor(options?: AnthropicConstructorOptions) {
      constructorOptions.push(options ?? {});
    }
  }
  return { ctor: MockAnthropicSdk, createSpy, constructorOptions };
}

/** test 用の最小 H3Event mock (handler が触る部分だけ実装) */
function makeEvent(opts: { signal?: AbortSignal } = {}): H3Event {
  return {
    req: opts.signal ? { signal: opts.signal } : {},
    node: { req: {} },
  } as unknown as H3Event;
}

describe('executeSummaryHandler (route handler 本体)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetDailyLimitForTesting();

    // Nuxt server auto-import を stub
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
        // テストで CF-Connecting-IP ベースの per-IP rate-limit bucket がテスト間で
        // 混ざらないよう、テストごとに異なる IP を返してもよいが、ここでは clearAllMocks
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
  });

  it('成功フロー: cache miss → Anthropic 呼び出し → response 返却', async () => {
    const queryCollection = makeQueryCollection(SAMPLE_ARTICLE);
    const { ctor: AnthropicCtor, createSpy } = makeAnthropicCtor(
      'success',
      'flat config 移行は plugin の typegen と Prettier 干渉に注意。',
    );

    const result = await executeSummaryHandler(makeEvent(), {
      queryCollection,
      AnthropicCtor,
      runtimeConfig: { anthropicApiKey: 'sk-test-key' },
    });

    expect(result.slug).toBe('eslint-10-flat-config-practical');
    expect(result.summary).toContain('flat config');
    expect(result.model).toBe('claude-haiku-4-5-20251001');
    expect(result.cached).toBe(false);
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it('cache hit: 同じ slug を 2 回呼ぶと 2 回目は cached:true で SDK 不呼出し', async () => {
    // 同一 slug を使い、Math.random IP の影響を受けない範囲で SDK 呼び出し回数を比較
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ slug: 'cache-hit-test-slug' }));
    const queryCollection = makeQueryCollection(SAMPLE_ARTICLE);
    const { ctor: AnthropicCtor, createSpy } = makeAnthropicCtor('success');

    const deps = {
      queryCollection,
      AnthropicCtor,
      runtimeConfig: { anthropicApiKey: 'sk-test-key' },
    };
    const first = await executeSummaryHandler(makeEvent(), deps);
    expect(first.cached).toBe(false);
    expect(createSpy).toHaveBeenCalledTimes(1);

    const second = await executeSummaryHandler(makeEvent(), deps);
    expect(second.cached).toBe(true);
    expect(createSpy).toHaveBeenCalledTimes(1); // 増えない
  });

  it('invalid_input: slug 形式違反は 400 + invalid_input を throw', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ slug: '../etc/passwd' }));
    const queryCollection = makeQueryCollection(SAMPLE_ARTICLE);
    const { ctor: AnthropicCtor, createSpy } = makeAnthropicCtor('success');

    await expect(
      executeSummaryHandler(makeEvent(), {
        queryCollection,
        AnthropicCtor,
        runtimeConfig: { anthropicApiKey: 'sk-test-key' },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'invalid_input',
      data: { error: 'invalid_input' },
    });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('article_not_found: queryCollection が null で 404 + article_not_found', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ slug: 'no-such-article-test' }));
    const queryCollection = makeQueryCollection(null);
    const { ctor: AnthropicCtor, createSpy } = makeAnthropicCtor('success');

    await expect(
      executeSummaryHandler(makeEvent(), {
        queryCollection,
        AnthropicCtor,
        runtimeConfig: { anthropicApiKey: 'sk-test-key' },
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'article_not_found',
      data: { error: 'article_not_found' },
    });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('server_misconfigured: apiKey 未設定で 500 + server_misconfigured', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ slug: 'server-misconfigured-test' }));
    const queryCollection = makeQueryCollection(SAMPLE_ARTICLE);
    const { ctor: AnthropicCtor, createSpy } = makeAnthropicCtor('success');

    await expect(
      executeSummaryHandler(makeEvent(), {
        queryCollection,
        AnthropicCtor,
        runtimeConfig: { anthropicApiKey: '' }, // 未設定を再現
      }),
    ).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'server_misconfigured',
      data: { error: 'server_misconfigured' },
    });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('access_required: summaryAccessKey 設定時にヘッダが無いと 401 + access_required', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ slug: 'access-required-test' }));
    const queryCollection = makeQueryCollection(SAMPLE_ARTICLE);
    const { ctor: AnthropicCtor, createSpy } = makeAnthropicCtor('success');

    await expect(
      executeSummaryHandler(makeEvent(), {
        queryCollection,
        AnthropicCtor,
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
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('access key: summaryAccessKey とヘッダが一致すれば Anthropic を呼ぶ', async () => {
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
    const { ctor: AnthropicCtor, createSpy } = makeAnthropicCtor('success');

    await executeSummaryHandler(makeEvent(), {
      queryCollection,
      AnthropicCtor,
      runtimeConfig: {
        anthropicApiKey: 'sk-test-key',
        summaryAccessKey: 'demo-access-key',
      },
    });

    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it('upstream_unavailable: Anthropic SDK が throw すると 500 + upstream_unavailable', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ slug: 'upstream-fail-test' }));
    const queryCollection = makeQueryCollection(SAMPLE_ARTICLE);
    const { ctor: AnthropicCtor, createSpy } = makeAnthropicCtor('throw');

    await expect(
      executeSummaryHandler(makeEvent(), {
        queryCollection,
        AnthropicCtor,
        runtimeConfig: { anthropicApiKey: 'sk-test-key' },
      }),
    ).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'upstream_unavailable',
      data: { error: 'upstream_unavailable' },
    });
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it('AbortSignal 伝播: event.req.signal が messages.create の options に渡る', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ slug: 'abort-signal-test' }));
    const controller = new AbortController();
    const queryCollection = makeQueryCollection(SAMPLE_ARTICLE);
    const { ctor: AnthropicCtor, createSpy } = makeAnthropicCtor('success');

    await executeSummaryHandler(makeEvent({ signal: controller.signal }), {
      queryCollection,
      AnthropicCtor,
      runtimeConfig: { anthropicApiKey: 'sk-test-key' },
    });

    expect(createSpy).toHaveBeenCalledTimes(1);
    const callArgs = createSpy.mock.calls[0];
    expect(callArgs?.[1]).toEqual({ signal: controller.signal });
  });

  it('AbortSignal なし: event.req に signal がなければ options=undefined で呼ぶ', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ slug: 'abort-signal-absent-test' }));
    const queryCollection = makeQueryCollection(SAMPLE_ARTICLE);
    const { ctor: AnthropicCtor, createSpy } = makeAnthropicCtor('success');

    await executeSummaryHandler(makeEvent(), {
      queryCollection,
      AnthropicCtor,
      runtimeConfig: { anthropicApiKey: 'sk-test-key' },
    });

    expect(createSpy).toHaveBeenCalledTimes(1);
    const callArgs = createSpy.mock.calls[0];
    expect(callArgs?.[1]).toBeUndefined();
  });

  it('Anthropic SDK constructor に timeout 30s と maxRetries 0 が渡る', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ slug: 'timeout-construction-test' }));
    const queryCollection = makeQueryCollection(SAMPLE_ARTICLE);
    const { ctor: AnthropicCtor, constructorOptions } = makeAnthropicCtor('success');

    await executeSummaryHandler(makeEvent(), {
      queryCollection,
      AnthropicCtor,
      runtimeConfig: { anthropicApiKey: 'sk-test-key' },
    });

    expect(constructorOptions).toHaveLength(1);
    expect(constructorOptions[0]).toEqual({
      apiKey: 'sk-test-key',
      maxRetries: 0,
      timeout: 30_000,
    });
  });
});
