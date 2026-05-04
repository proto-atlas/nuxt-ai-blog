import { describe, expect, it, vi } from 'vitest';
import { createAnthropicSummaryClient, SUMMARY_MODEL } from './summary-ai-client';
import type { AnthropicClientConstructor } from './summary-ai-client';

interface AnthropicConstructorOptions {
  apiKey: string;
  maxRetries: 0;
  timeout: 30000;
}

function makeAnthropicCtor(text = 'mock summary'): {
  ctor: AnthropicClientConstructor;
  createSpy: ReturnType<typeof vi.fn>;
  constructorOptions: AnthropicConstructorOptions[];
} {
  const constructorOptions: AnthropicConstructorOptions[] = [];
  const createSpy = vi.fn().mockResolvedValue({ content: [{ type: 'text', text }] });

  class MockAnthropicSdk {
    messages = { create: createSpy };
    constructor(options: AnthropicConstructorOptions) {
      constructorOptions.push(options);
    }
  }

  return { ctor: MockAnthropicSdk, createSpy, constructorOptions };
}

describe('createAnthropicSummaryClient', () => {
  it('apiKeyとretry抑制とtimeoutを指定して要約を生成する', async () => {
    const { ctor, createSpy, constructorOptions } = makeAnthropicCtor(
      'Nuxt 4とCloudflare Workersのdeploy手順を整理した記事。',
    );
    const client = createAnthropicSummaryClient(ctor);

    const result = await client.createSummary({
      apiKey: 'sk-test-key',
      sourceText: 'Nuxt 4 と Cloudflare Workers のdeploy手順。',
    });

    expect(result).toEqual({
      summary: 'Nuxt 4とCloudflare Workersのdeploy手順を整理した記事。',
      model: SUMMARY_MODEL,
    });
    expect(constructorOptions).toEqual([{ apiKey: 'sk-test-key', maxRetries: 0, timeout: 30000 }]);
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it('AbortSignalがあるとmessages.createのoptionsへ渡す', async () => {
    const { ctor, createSpy } = makeAnthropicCtor();
    const controller = new AbortController();
    const client = createAnthropicSummaryClient(ctor);

    await client.createSummary({
      apiKey: 'sk-test-key',
      sourceText: 'AbortSignal の伝播を確認する記事。',
      signal: controller.signal,
    });

    expect(createSpy.mock.calls[0]?.[1]).toEqual({ signal: controller.signal });
  });

  it('AbortSignalがないとmessages.createのoptionsを省略する', async () => {
    const { ctor, createSpy } = makeAnthropicCtor();
    const client = createAnthropicSummaryClient(ctor);

    await client.createSummary({
      apiKey: 'sk-test-key',
      sourceText: 'AbortSignal がない場合を確認する記事。',
    });

    expect(createSpy.mock.calls[0]?.[1]).toBeUndefined();
  });
});
