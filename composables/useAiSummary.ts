/**
 * AI要約を取得するcomposable。
 * /api/summary (POST) を呼んで、成功したらsummary / model / cached / generatedAtを返す。
 * エラー時はerrorに日本語メッセージを入れる。
 *
 * 同一slugの連続呼び出しを防ぐため、呼び出し中はloading=trueを維持し、
 * handleSummarizeを呼び直しても何もしない。
 */
// Nuxt自動importで動くが、Vitest happy-dom環境ではauto-importが無効なため
// ref/readonlyをvueから明示importする (テスト可能性のため)。
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
 * $fetchの例外オブジェクトからSummaryErrorData.error (code) を取り出す。
 *
 * ofetch FetchErrorは `err.data` にresponse body全体 (parsed JSON) を入れる。
 * Nitroがh3 createError({ statusCode, statusMessage, data: { error, ... } }) を
 * 投げると、body shapeは `{ statusCode, statusMessage, data: { error } }` になる。
 * したがって本体は `err.data.data.error` から取る。
 *
 * Vitest単体テストで `mockRejectedValue({ data: { error } })` を直接渡す経路にも
 * 両対応するため、`err.data.error` のflat shapeも最終フォールバックで拾う。
 */
function extractErrorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const obj = err as Record<string, unknown>;
  const data = obj.data;
  if (data && typeof data === 'object') {
    const dataRec = data as Record<string, unknown>;
    // 1. ofetch + Nitro createErrorの実体: err.data = body, body.data.errorがcode
    const inner = dataRec.data;
    if (inner && typeof inner === 'object') {
      const innerError = (inner as Record<string, unknown>).error;
      if (typeof innerError === 'string') return innerError;
    }
    // 2. body.statusMessageにcodeを入れている経路 (createError({ statusMessage }))
    if (typeof dataRec.statusMessage === 'string') return dataRec.statusMessage;
    // 3. flat shapeのフォールバック (Vitest mockの `{ data: { error } }`)
    if (typeof dataRec.error === 'string') return dataRec.error;
  }
  // 4. err.statusMessage直接 (HTTP statusTextの場合はunknownラベルへ落ちる)
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
      // 内部codeを日本語ラベルに変換し、raw errorはUIに出さない。
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
