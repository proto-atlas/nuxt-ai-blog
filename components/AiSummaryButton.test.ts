// @vitest-environment nuxt
// AiSummaryButton.vue のテスト。
// useAiSummary は Nuxt auto-import なので mockNuxtImport で差し替える。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import AiSummaryButton from './AiSummaryButton.vue';

interface SummaryResponse {
  slug: string;
  summary: string;
  model: string;
  cached: boolean;
  generatedAt: string;
}

interface UseAiSummaryStub {
  summary: ReturnType<typeof ref<SummaryResponse | null>>;
  loading: ReturnType<typeof ref<boolean>>;
  error: ReturnType<typeof ref<string | null>>;
  summarize: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
}

let aiSummaryStub: UseAiSummaryStub;

mockNuxtImport('useAiSummary', () => () => aiSummaryStub);

function makeStub(
  overrides: Partial<{
    summary: SummaryResponse | null;
    loading: boolean;
    error: string | null;
  }> = {},
): UseAiSummaryStub {
  return {
    summary: ref(overrides.summary ?? null),
    loading: ref(overrides.loading ?? false),
    error: ref(overrides.error ?? null),
    summarize: vi.fn(),
    reset: vi.fn(),
  };
}

describe('AiSummaryButton', () => {
  beforeEach(() => {
    aiSummaryStub = makeStub();
  });

  it('初期状態で「AI 要約を生成」ボタンとアクセスキー入力を表示する', async () => {
    const wrapper = await mountSuspended(AiSummaryButton, { props: { slug: 'sample' } });
    expect(wrapper.text()).toContain('AI 要約を生成');
    expect(wrapper.get('label').text()).toBe('AI要約アクセスキー');
    expect(wrapper.find('button').attributes('disabled')).toBeDefined();
  });

  it('loading=true で disabled + 「生成中...」表示', async () => {
    aiSummaryStub = makeStub({ loading: true });
    const wrapper = await mountSuspended(AiSummaryButton, { props: { slug: 'sample' } });

    const btn = wrapper.find('button');
    expect(btn.text()).toBe('生成中...');
    expect(btn.attributes('disabled')).toBeDefined();
  });

  it('summary が入っていれば本文と model を表示する', async () => {
    aiSummaryStub = makeStub({
      summary: {
        slug: 'sample',
        summary: 'サンプル記事の要約本文です。',
        model: 'claude-haiku-4-5-20251001',
        cached: false,
        generatedAt: '2026-04-25T01:23:45.000Z',
      },
    });
    const wrapper = await mountSuspended(AiSummaryButton, { props: { slug: 'sample' } });

    expect(wrapper.text()).toContain('サンプル記事の要約本文です。');
    expect(wrapper.text()).toContain('claude-haiku-4-5-20251001');
    expect(wrapper.find('button').text()).toBe('再生成');
  });

  it('cached=true で「キャッシュ」バッジを表示する', async () => {
    aiSummaryStub = makeStub({
      summary: {
        slug: 'sample',
        summary: 'cached テキスト',
        model: 'claude-haiku-4-5-20251001',
        cached: true,
        generatedAt: '2026-04-25T01:23:45.000Z',
      },
    });
    const wrapper = await mountSuspended(AiSummaryButton, { props: { slug: 'sample' } });
    expect(wrapper.text()).toContain('キャッシュ');
  });

  it('error が入っていればエラーメッセージを表示する', async () => {
    aiSummaryStub = makeStub({ error: 'Rate limit exceeded.' });
    const wrapper = await mountSuspended(AiSummaryButton, { props: { slug: 'sample' } });
    expect(wrapper.text()).toContain('Rate limit exceeded.');
  });

  it('アクセスキー入力後のボタン click で summarize(slug, accessKey) を呼ぶ', async () => {
    const wrapper = await mountSuspended(AiSummaryButton, { props: { slug: 'my-slug' } });
    await wrapper.get('input').setValue('demo-key');
    await wrapper.find('button').trigger('click');
    expect(aiSummaryStub.summarize).toHaveBeenCalledWith('my-slug', 'demo-key');
  });
});
