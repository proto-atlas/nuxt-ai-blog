<script setup lang="ts">
/**
 * AI 要約ボタン + 結果表示。
 * slug を prop で受け取り、クリックで useAiSummary.summarize(slug) を呼ぶ。
 * 表示段階: 初期 (ボタンのみ) → 取得中 (spinner) → 結果表示 (summary + cached バッジ)
 */
const props = defineProps<{ slug: string }>();

const { summary, loading, error, summarize } = useAiSummary();
const accessKey = ref('');
const accessKeyInputId = `summary-access-key-${props.slug}`;
const canSubmit = computed(() => accessKey.value.trim().length > 0 && !loading.value);

onMounted(() => {
  accessKey.value = sessionStorage.getItem('nuxt-ai-blog.summary-access-key') ?? '';
});

watch(accessKey, (value) => {
  const normalized = value.trim();
  if (normalized) {
    sessionStorage.setItem('nuxt-ai-blog.summary-access-key', normalized);
  } else {
    sessionStorage.removeItem('nuxt-ai-blog.summary-access-key');
  }
});

async function handleClick() {
  await summarize(props.slug, accessKey.value);
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
      <div class="flex w-full flex-col gap-2 sm:w-auto sm:min-w-72">
        <label
          :for="accessKeyInputId"
          class="text-xs font-medium text-emerald-900 dark:text-emerald-100"
        >
          AI要約アクセスキー
        </label>
        <div class="flex flex-col gap-2 sm:flex-row">
          <input
            :id="accessKeyInputId"
            v-model="accessKey"
            type="password"
            autocomplete="off"
            class="min-h-11 w-full rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-800 dark:bg-slate-950 dark:text-slate-100"
          />
          <button
            type="button"
            :disabled="!canSubmit"
            class="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:bg-emerald-400 dark:disabled:bg-emerald-800"
            @click="handleClick"
          >
            {{ loading ? '生成中...' : summary ? '再生成' : 'AI 要約を生成' }}
          </button>
        </div>
      </div>
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
    <div
      v-else
      class="mt-3 rounded-md border border-emerald-200 bg-white p-3 text-xs text-slate-700 dark:border-emerald-900 dark:bg-slate-950 dark:text-slate-300"
    >
      <p class="font-medium text-slate-900 dark:text-slate-100">キーなしプレビュー</p>
      <p class="mt-1">
        実AI APIは呼ばず、記事本文から150文字前後の要約を返す表示例だけ確認できます。
      </p>
      <p class="mt-2 text-sm leading-relaxed text-slate-900 dark:text-slate-100">
        Nuxt Contentの記事本文をCloudflare
        Workers上で取得し、短い要約として返す構成です。アクセスキー、日次上限、キャッシュで公開デモのコストを抑えます。
      </p>
    </div>
  </div>
</template>
