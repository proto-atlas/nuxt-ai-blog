// useAiSummary composable のテスト。
// $fetch (Nuxt auto-import) を vi.stubGlobal で差し替えて、成功 / エラー / 多重呼び出しを検証する。
// 改善以降: サーバー側 createError({ data: { error: SummaryErrorCode } }) を
// labelForSummaryError で日本語ラベルに変換して error.value にセットする方式。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiSummary } from './useAiSummary';
import { SUMMARY_ERROR_LABELS } from '#shared/error-codes';

interface SummaryResponse {
  slug: string;
  summary: string;
  model: string;
  cached: boolean;
  generatedAt: string;
}

const mockResponse: SummaryResponse = {
  slug: 'sample-article',
  summary: 'これはサンプルの要約です。',
  model: 'claude-haiku-4-5-20251001',
  cached: false,
  generatedAt: '2026-04-25T00:00:00.000Z',
};

describe('useAiSummary', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('初期状態は summary=null / loading=false / error=null', () => {
    const { summary, loading, error } = useAiSummary();
    expect(summary.value).toBeNull();
    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it('成功時に summary を更新し loading が false に戻る', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal('$fetch', fetchMock);

    const { summary, loading, error, summarize } = useAiSummary();
    await summarize('sample-article');

    expect(fetchMock).toHaveBeenCalledWith('/api/summary', {
      method: 'POST',
      body: { slug: 'sample-article' },
    });
    expect(summary.value).toEqual(mockResponse);
    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it('createError({ data: { error: rate_limit } }) で日本語ラベルが入る', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockRejectedValue({
        data: { error: 'rate_limit', retryAfterSeconds: 21 },
        statusMessage: 'rate_limit',
      }),
    );
    const { error, summarize } = useAiSummary();
    await summarize('sample-article');
    expect(error.value).toBe(SUMMARY_ERROR_LABELS.rate_limit);
  });

  it('createError({ data: { error: server_misconfigured } }) でサーバー設定エラー文言', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockRejectedValue({
        data: { error: 'server_misconfigured' },
        statusMessage: 'server_misconfigured',
      }),
    );
    const { error, summarize } = useAiSummary();
    await summarize('sample-article');
    expect(error.value).toBe(SUMMARY_ERROR_LABELS.server_misconfigured);
  });

  it('未知の code は unknown ラベルにフォールバック', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue({ data: { error: 'never_known_code' } }));
    const { error, summarize } = useAiSummary();
    await summarize('sample-article');
    expect(error.value).toBe(SUMMARY_ERROR_LABELS.unknown);
  });

  it('Error throw 等の内部詳細は UI に流さず unknown ラベル', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('Anthropic 502 stack trace')));
    const { error, summarize } = useAiSummary();
    await summarize('sample-article');
    expect(error.value).toBe(SUMMARY_ERROR_LABELS.unknown);
    // 内部 message が UI に流れていないことを保証
    expect(error.value).not.toContain('Anthropic 502 stack trace');
  });

  it('plain string reject も unknown ラベル', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue('plain string'));
    const { error, summarize } = useAiSummary();
    await summarize('sample-article');
    expect(error.value).toBe(SUMMARY_ERROR_LABELS.unknown);
  });

  it('loading 中の再呼び出しは無視する (二重呼び出し防止)', async () => {
    let resolveFn: (value: SummaryResponse) => void = () => {};
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<SummaryResponse>((resolve) => {
          resolveFn = resolve;
        }),
    );
    vi.stubGlobal('$fetch', fetchMock);

    const { loading, summarize } = useAiSummary();
    const first = summarize('a');
    const second = summarize('b');

    expect(loading.value).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFn(mockResponse);
    await Promise.all([first, second]);
    expect(loading.value).toBe(false);
  });

  it('reset で summary と error をクリアする', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(mockResponse));

    const { summary, error, summarize, reset } = useAiSummary();
    await summarize('sample-article');
    expect(summary.value).not.toBeNull();

    reset();
    expect(summary.value).toBeNull();
    expect(error.value).toBeNull();
  });
});
