<script setup lang="ts">
// default layout: 全ページで共通のヘッダー + footer を提供する。
// ThemeToggle はヘッダー右端に配置し、どのページからも切り替え可能にする。
</script>

<template>
  <div
    class="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100"
  >
    <header class="border-b border-slate-200 dark:border-slate-800">
      <div class="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
        <NuxtLink
          to="/"
          class="inline-flex min-h-11 items-center rounded-md px-2 text-lg font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          nuxt-ai-blog
        </NuxtLink>
        <ThemeToggle />
      </div>
    </header>

    <main class="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <slot />
    </main>

    <footer
      class="mt-16 border-t border-slate-200 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400"
    >
      Nuxt 4 + Cloudflare Workers で動作。記事ごとに AI 要約を生成できます。
    </footer>
  </div>
</template>
