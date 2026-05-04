import tailwindcss from '@tailwindcss/vite';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-04-24',
  // 本番ビルドに devtools の痕跡 (data-* / hydration helper) を残さない。
  devtools: { enabled: process.env.NODE_ENV !== 'production' },

  app: {
    // <html lang="ja"> を Nitro レンダ時に出力。SEO とスクリーンリーダー
    // (NVDA / VoiceOver) が言語を判別するために必要 (a11y)。
    head: {
      htmlAttrs: { lang: 'ja' },
      // OG / Twitter card のサイト共通項目。ページ別タイトル / 説明文は
      // app.vue / pages/ で useSeoMeta で上書きする。
      meta: [
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'nuxt-ai-blog' },
        {
          property: 'og:image',
          content: 'https://nuxt-ai-blog.atlas-lab.workers.dev/og-image.svg',
        },
        { property: 'og:image:type', content: 'image/svg+xml' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { name: 'twitter:card', content: 'summary' },
        {
          name: 'twitter:image',
          content: 'https://nuxt-ai-blog.atlas-lab.workers.dev/og-image.svg',
        },
      ],
    },
  },

  // @nuxtjs/sitemap が利用するサイト URL。canonical / og:url の絶対化にも使われる。
  site: {
    url: 'https://nuxt-ai-blog.atlas-lab.workers.dev',
    name: 'nuxt-ai-blog',
  },

  modules: ['@nuxt/content', '@nuxtjs/color-mode', '@nuxt/eslint', '@nuxtjs/sitemap'],

  css: ['~/assets/css/main.css'],

  vite: {
    // Tailwind v4 は Vite プラグイン経由で統合
    plugins: [tailwindcss()],
  },

  colorMode: {
    // <html class="dark"> スタイル戦略で Tailwind v4 の @custom-variant と連動
    classSuffix: '',
    preference: 'system',
    fallback: 'light',
    storageKey: 'nuxt-ai-blog.theme',
  },

  nitro: {
    // Cloudflare Workers Module 形式でデプロイ
    preset: 'cloudflare_module',
  },

  content: {
    // Node.js 22+ 組み込みの native SQLite を使用 (Windows で better-sqlite3 の
    // node-gyp ビルドを避ける。本番 Cloudflare Workers では D1 に切り替える)
    experimental: {
      sqliteConnector: 'native',
    },
  },

  sitemap: {
    // 静的トップ + 動的ブログ記事 URL を含める。
    // /api/__sitemap__/urls から Nuxt Content の blog コレクションを列挙して URL 化する。
    sources: ['/api/__sitemap__/urls'],
    // /api/* と /og-image.svg は sitemap から除外 (検索インデックス対象外)。
    exclude: ['/api/**'],
  },

  routeRules: {
    '/**': {
      // セキュリティヘッダを Nitro レベルで全ルート一括付与する。
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        // CSP は XSS に対する追加防御として全ルートに付与する。
        // Nuxt のハイドレーションスクリプトと color-mode の theme 初期化スクリプトが
        // インラインなので 'unsafe-inline' が必要 (nonce 化は将来課題)。
        // Nuxt Content の sqlite-wasm は SPA 遷移時にブラウザ上で WebAssembly を
        // compile / instantiate するため、JS eval ではなく WebAssembly 限定で許可する。
        // `unsafe-eval` は許可せず、wasm-unsafe-eval に範囲を絞る。
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "connect-src 'self'",
          "worker-src 'self' blob:",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "object-src 'none'",
        ].join('; '),
      },
    },
  },

  runtimeConfig: {
    // サーバーサイドのみで読み取れる値。NUXT_ANTHROPIC_API_KEY で注入 (ローカル: .env、本番: wrangler secret)
    anthropicApiKey: '',
    // /api/summary の live AI 生成を保護するデモ用アクセスキー。
    // NUXT_SUMMARY_ACCESS_KEY で注入し、クライアント bundle には含めない。
    summaryAccessKey: '',
  },

  typescript: {
    strict: true,
    // typeCheck は dev/build 時の vite-plugin-checker 経由実行で HMR と競合しやすいため無効。
    // 型チェックは CI の npm run typecheck (nuxt typecheck → vue-tsc) で担保する。
    typeCheck: false,
  },
});
