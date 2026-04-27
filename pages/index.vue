<script setup lang="ts">
/**
 * 記事一覧ページ。
 * queryCollection('blog') で Nuxt Content 3 の blog コレクションを取得し、
 * date DESC でソートして ArticleCard で表示する。
 * select() で表示に必要なフィールドだけ取得し、ペイロードサイズを抑える。
 */
const { data: articles } = await useAsyncData('blog-index', () => {
  return queryCollection('blog')
    .select('path', 'title', 'description', 'date', 'tags', 'category')
    .order('date', 'DESC')
    .all();
});

const description =
  '技術ブログの記事一覧。Nuxt / TypeScript / Cloudflare / Tailwind / ESLint 等のトピック。';

const canonicalUrl = 'https://nuxt-ai-blog.atlas-lab.workers.dev/';

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

    <div v-if="articles?.length" class="grid gap-4 sm:grid-cols-2">
      <ArticleCard v-for="article in articles" :key="article.path" :article="article" />
    </div>
    <p v-else class="text-sm text-slate-500 dark:text-slate-400">記事がありません。</p>
  </div>
</template>
