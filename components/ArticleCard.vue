<script setup lang="ts">
import type { BlogCollectionItem } from '@nuxt/content';

// queryCollection('blog') の返り値の型。select() で絞り込んだ結果にも対応できるようPartial。
defineProps<{
  article: Pick<
    BlogCollectionItem,
    'path' | 'title' | 'description' | 'date' | 'tags' | 'category'
  >;
}>();

function formatDate(date: string): string {
  const d = new Date(date);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}
</script>

<template>
  <!--
 external属性で <a href> を強制し、SPA遷移ではなくfull page reloadで
 /blog/<slug> に飛ぶ。Nuxt Content 3 のclient側queryCollectionがSPA
 遷移時にcollectionを取りこぼし 404 になった事象を避けるため、SSR経由の
 server-side queryCollectionを使う。記事 5 本のブログなのでSPA高速性のロスは
 UXに影響しない。
 -->
  <NuxtLink
    :to="article.path"
    external
    class="block rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-emerald-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-700 dark:hover:bg-slate-900"
  >
    <div class="mb-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      <span
        class="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"
      >
        {{ article.category }}
      </span>
      <time :datetime="article.date">{{ formatDate(article.date) }}</time>
    </div>
    <h2 class="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
      {{ article.title }}
    </h2>
    <p class="mb-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
      {{ article.description }}
    </p>
    <div class="flex flex-wrap gap-1.5">
      <span
        v-for="tag in article.tags"
        :key="tag"
        class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400"
      >
        #{{ tag }}
      </span>
    </div>
  </NuxtLink>
</template>
