<script setup lang="ts">
// Nuxt のエラーハンドラに登録される共通エラーページ。
// 404 / 500 / その他全てが入ってくるため、statusCode で文言を分岐する。
// layouts/default.vue は通らないので、ここでヘッダ + footer を再現する。
import type { NuxtError } from '#app';

const props = defineProps<{
  error: NuxtError;
}>();

const status = computed(() => Number(props.error.statusCode) || 500);
const title = computed(() =>
  status.value === 404 ? 'ページが見つかりません' : 'エラーが発生しました',
);
const message = computed(() => {
  if (status.value === 404) {
    return '指定された URL の記事が削除されたか、移動した可能性があります。';
  }
  return (
    props.error.statusMessage ||
    'サーバーで予期しない問題が発生しました。時間を置いて再度お試しください。'
  );
});

useHead({
  title: title.value,
});

useSeoMeta({
  ogTitle: () => `${title.value} | nuxt-ai-blog`,
  ogDescription: message,
  twitterTitle: () => `${title.value} | nuxt-ai-blog`,
  twitterDescription: message,
});

function handleHome() {
  clearError({ redirect: '/' });
}
</script>

<template>
  <div
    class="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100"
  >
    <header class="border-b border-slate-200 dark:border-slate-800">
      <div class="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
        <NuxtLink
          to="/"
          class="text-lg font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-md px-1"
        >
          nuxt-ai-blog
        </NuxtLink>
      </div>
    </header>

    <main class="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <div class="text-center">
        <p class="text-sm font-semibold tracking-widest text-emerald-600 dark:text-emerald-400">
          {{ status }}
        </p>
        <h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {{ title }}
        </h1>
        <p class="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {{ message }}
        </p>
        <div class="mt-8 flex items-center justify-center gap-3">
          <button
            type="button"
            class="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:outline-none"
            @click="handleHome"
          >
            記事一覧へ戻る
          </button>
        </div>
      </div>
    </main>

    <footer
      class="mt-16 border-t border-slate-200 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400"
    >
      Nuxt 4 + Cloudflare Workers で動作。
    </footer>
  </div>
</template>
