/**
 * AI 要約を取得する composable。
 * /api/summary (POST) を呼んで、成功したら summary / model / cached / generatedAt を返す。
 * エラー時は error に日本語メッセージを入れる。
 *
 * 同一 slug の連続呼び出しを防ぐため、呼び出し中は loading=true を維持し、
 * handleSummarize を呼び直しても何もしない。
 */
// Nuxt 自動 import で動くが、Vitest happy-dom 環境では auto-import が無効なため
// ref/readonly を vue から明示 import する (テスト可能性のため)。
import { ref, readonly } from 'vue';
import { labelForSummaryError } from '#shared/error-codes';

interface SummaryResponse {
  slug: string;
  summary: string;
  model: string;
  cached: boolean;
  generatedAt: string;
}

/**
 * $fetch の例外オブジェクトから SummaryErrorData.error (code) を取り出す。
 *
 * ofetch FetchError は `err.data` に response body 全体 (parsed JSON) を入れる。
 * Nitro が h3 createError({ statusCode, statusMessage, data: { error, ... } }) を
 * 投げると、body shape は `{ statusCode, statusMessage, data: { error } }` になる。
 * したがって本体は `err.data.data.error` から取る。
 *
 * Vitest 単体テストで `mockRejectedValue({ data: { error } })` を直接渡す経路にも
 * 両対応するため、`err.data.error` の flat shape も最終フォールバックで拾う。
 */
function extractErrorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const obj = err as Record<string, unknown>;
  const data = obj.data;
  if (data && typeof data === 'object') {
    const dataRec = data as Record<string, unknown>;
    // 1. ofetch + Nitro createError の実体: err.data = body, body.data.error が code
    const inner = dataRec.data;
    if (inner && typeof inner === 'object') {
      const innerError = (inner as Record<string, unknown>).error;
      if (typeof innerError === 'string') return innerError;
    }
    // 2. body.statusMessage に code を入れている経路 (createError({ statusMessage }))
    if (typeof dataRec.statusMessage === 'string') return dataRec.statusMessage;
    // 3. flat shape のフォールバック (Vitest mock の `{ data: { error } }`)
    if (typeof dataRec.error === 'string') return dataRec.error;
  }
  // 4. err.statusMessage 直接 (HTTP statusText の場合は unknown ラベルへ落ちる)
  if (typeof obj.statusMessage === 'string') return obj.statusMessage;
  return undefined;
}

export function useAiSummary() {
  const summary = ref<SummaryResponse | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function summarize(slug: string, accessKey: string): Promise<void> {
    if (loading.value) return;
    loading.value = true;
    error.value = null;
    try {
      const normalizedAccessKey = accessKey.trim();
      const res = (await $fetch('/api/summary', {
        method: 'POST',
        body: { slug },
        headers: normalizedAccessKey ? { 'X-Summary-Access-Key': normalizedAccessKey } : undefined,
      })) as SummaryResponse;
      summary.value = res;
    } catch (err) {
      // 内部 code を日本語ラベルに変換し、raw error は UI に出さない。
      const code = extractErrorCode(err);
      error.value = labelForSummaryError(code);
    } finally {
      loading.value = false;
    }
  }

  function reset(): void {
    summary.value = null;
    error.value = null;
  }

  return {
    summary: readonly(summary),
    loading: readonly(loading),
    error: readonly(error),
    summarize,
    reset,
  };
}
