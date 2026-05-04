<script setup lang="ts">
/**
 * 記事詳細ページ (動的ルート /blog/[slug])。
 * Nuxt Content 3 は frontmatter + Markdown から path を自動生成 (/blog/<slug>) するため、
 * route.path を使ってクエリするだけで該当記事を取れる。
 */
const route = useRoute();

const slug = route.params.slug as string;

// 一覧 → 詳細の SPA 遷移時に `queryCollection('blog').path('/blog/<slug>').first()`
// が dev 環境で null を返し 404 ページに飛ぶ事象が出ていた (SSR 直接アクセスは OK)。
// 原因は Nuxt Content 3 の SQL Builder が SPA 遷移時の client 側 fetch で path
// 完全一致を取りこぼすケースで、回避策として全コレクション (5 件程度) を取って
// JS 側で filter する。記事数が常に小規模で overhead が無視できる前提。
const { data: post } = await useAsyncData(`blog-${slug}`, async () => {
  const all = await queryCollection('blog').all();
  return all.find((a) => a.path === `/blog/${slug}`) ?? null;
});

if (!post.value) {
  throw createError({
    statusCode: 404,
    statusMessage: '記事が見つかりません',
    fatal: true,
  });
}

const canonicalUrl = computed(
  () => `https://nuxt-ai-blog.atlas-lab.workers.dev/blog/${route.params.slug as string}`,
);

useHead(() => ({
  title: post.value?.title ?? '記事',
  meta: [{ name: 'description', content: post.value?.description ?? '' }],
  // 検索エンジン向けに重複コンテンツを統一する canonical URL。
  link: [{ rel: 'canonical', href: canonicalUrl.value }],
}));

// OG / Twitter card の記事個別項目。og:type は記事ページなので article で上書き。
// app.vue 側の website 設定より優先される (Nuxt の useSeoMeta は後勝ち)。
useSeoMeta({
  ogType: 'article',
  ogTitle: () => post.value?.title ?? '記事',
  ogDescription: () => post.value?.description ?? '',
  ogUrl: () => canonicalUrl.value,
  twitterTitle: () => post.value?.title ?? '記事',
  twitterDescription: () => post.value?.description ?? '',
  articlePublishedTime: () => post.value?.date,
});

function formatDate(date: string): string {
  const d = new Date(date);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}
</script>

<template>
  <article v-if="post" class="max-w-none">
    <header class="mb-8 border-b border-slate-200 pb-6 dark:border-slate-800">
      <div class="mb-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span
          class="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"
        >
          {{ post.category }}
        </span>
        <time :datetime="post.date">{{ formatDate(post.date) }}</time>
      </div>
      <h1 class="mb-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        {{ post.title }}
      </h1>
      <p class="text-base text-slate-600 dark:text-slate-400">
        {{ post.description }}
      </p>
      <div class="mt-4 flex flex-wrap gap-1.5">
        <span
          v-for="tag in post.tags"
          :key="tag"
          class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400"
        >
          #{{ tag }}
        </span>
      </div>
    </header>

    <div class="mb-6">
      <AiSummaryButton :slug="route.params.slug as string" />
    </div>

    <div class="prose prose-slate max-w-none dark:prose-invert">
      <ContentRenderer :value="post" />
    </div>

    <div class="mt-12 border-t border-slate-200 pt-6 dark:border-slate-800">
      <NuxtLink
        to="/"
        class="inline-flex min-h-11 items-center gap-1 rounded px-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-300 dark:hover:text-emerald-200"
      >
        ← 記事一覧へ戻る
      </NuxtLink>
    </div>
  </article>
</template>
