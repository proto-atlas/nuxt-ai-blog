<script setup lang="ts">
/**
 * AI 要約ボタン + 結果表示。
 * slug を prop で受け取り、クリックで useAiSummary.summarize(slug) を呼ぶ。
 * 表示段階: 初期 (ボタンのみ) → 取得中 (spinner) → 結果表示 (summary + cached バッジ)
 */
const props = defineProps<{ slug: string }>();

const { summary, loading, error, summarize } = useAiSummary();

async function handleClick() {
  await summarize(props.slug);
}
</script>

<template>
  <div
    class="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950"
  >
    <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold text-emerald-900 dark:text-emerald-100">AI 要約</h3>
        <p class="text-xs text-emerald-800 dark:text-emerald-200">
          Claude Haiku 4.5 で記事を 150 文字程度に要約します。
        </p>
      </div>
      <button
        type="button"
        :disabled="loading"
        class="inline-flex min-h-11 items-center rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:bg-emerald-400 dark:disabled:bg-emerald-800"
        @click="handleClick"
      >
        {{ loading ? '生成中...' : summary ? '再生成' : 'AI 要約を生成' }}
      </button>
    </div>

    <div
      v-if="error"
      class="mt-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
    >
      {{ error }}
    </div>

    <div v-if="summary" class="mt-3 space-y-2">
      <p class="text-sm leading-relaxed text-slate-900 dark:text-slate-100">
        {{ summary.summary }}
      </p>
      <div
        class="flex flex-wrap items-center gap-2 text-[11px] text-emerald-900 dark:text-emerald-200"
      >
        <span>{{ summary.model }}</span>
        <span
          v-if="summary.cached"
          class="rounded bg-emerald-200 px-1.5 py-0.5 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100"
        >
          キャッシュ
        </span>
        <span>{{ new Date(summary.generatedAt).toLocaleString('ja-JP') }}</span>
      </div>
    </div>
  </div>
</template>
