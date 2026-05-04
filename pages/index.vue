<script setup lang="ts">
/**
 * 記事一覧ページ。
 * queryCollection('blog') で Nuxt Content 3 の blog コレクションを取得し、
 * date DESC でソートして ArticleCard で表示する。
 * select() で表示に必要なフィールドだけ取得し、ペイロードサイズを抑える。
 */
import { collectArticleTags, filterArticles } from '~/utils/article-filter';

const { data: articles } = await useAsyncData('blog-index', () => {
  return queryCollection('blog')
    .select('path', 'title', 'description', 'date', 'tags', 'category')
    .order('date', 'DESC')
    .all();
});

const description =
  '技術ブログの記事一覧。Nuxt / TypeScript / Cloudflare / Tailwind / ESLint 等のトピック。';

const canonicalUrl = 'https://nuxt-ai-blog.atlas-lab.workers.dev/';

const searchQuery = ref('');
const selectedTag = ref('');
const articleList = computed(() => articles.value ?? []);
const tags = computed(() => collectArticleTags(articleList.value));
const filteredArticles = computed(() =>
  filterArticles(articleList.value, searchQuery.value, selectedTag.value),
);

function selectTag(tag: string): void {
  selectedTag.value = selectedTag.value === tag ? '' : tag;
}

function clearFilters(): void {
  searchQuery.value = '';
  selectedTag.value = '';
}

useHead({
  title: '記事一覧',
  meta: [{ name: 'description', content: description }],
  // 検索エンジン向けに重複コンテンツを統一する canonical URL。
  // 同じページが複数 URL でアクセス可能な場合 (trailing slash 等) でも検索評価が分散しない。
  link: [{ rel: 'canonical', href: canonicalUrl }],
});

// OG / Twitter card のページ個別項目。app.vue で og:type / og:site_name は設定済み。
useSeoMeta({
  ogTitle: '記事一覧 | nuxt-ai-blog',
  ogDescription: description,
  ogUrl: canonicalUrl,
  twitterTitle: '記事一覧 | nuxt-ai-blog',
  twitterDescription: description,
});
</script>

<template>
  <div>
    <div class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">記事一覧</h1>
      <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Nuxt / Vue / TypeScript / Cloudflare Workers 周辺の技術ノート。AI 要約は記事詳細ページから。
      </p>
    </div>

    <div
      v-if="articleList.length"
      class="mb-6 border-y border-slate-200 py-4 dark:border-slate-800"
    >
      <div class="flex flex-col gap-3">
        <label for="article-search" class="text-sm font-medium text-slate-900 dark:text-slate-100">
          記事検索
        </label>
        <input
          id="article-search"
          v-model="searchQuery"
          type="search"
          autocomplete="off"
          class="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
      </div>

      <div class="mt-4 flex flex-wrap gap-2" aria-label="タグ絞り込み">
        <button
          v-for="tag in tags"
          :key="tag"
          type="button"
          class="min-h-11 rounded-md border px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
          :class="
            selectedTag === tag
              ? 'border-emerald-700 bg-emerald-700 text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
          "
          :aria-pressed="selectedTag === tag"
          @click="selectTag(tag)"
        >
          #{{ tag }}
        </button>
        <button
          v-if="searchQuery || selectedTag"
          type="button"
          class="min-h-11 rounded-md px-3 py-2 text-sm text-slate-600 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none dark:text-slate-300"
          @click="clearFilters"
        >
          絞り込み解除
        </button>
      </div>
    </div>

    <div v-if="filteredArticles.length" class="grid gap-4 sm:grid-cols-2">
      <ArticleCard v-for="article in filteredArticles" :key="article.path" :article="article" />
    </div>
    <p v-else class="text-sm text-slate-500 dark:text-slate-400">該当する記事がありません。</p>
  </div>
</template>
