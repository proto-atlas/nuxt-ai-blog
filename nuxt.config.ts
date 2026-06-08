import tailwindcss from '@tailwindcss/vite';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-04-24',
  // 本番ビルドにdevtoolsの痕跡 (data-* / hydration helper) を残さない。
  devtools: { enabled: process.env.NODE_ENV !== 'production' },

  app: {
    // <html lang="ja"> をNitroレンダ時に出力。SEOとスクリーンリーダー
    // (NVDA / VoiceOver) が言語を判別するために必要 (a11y)。
    head: {
      htmlAttrs: { lang: 'ja' },
      // OG / Twitter cardのサイト共通項目。ページ別タイトル / 説明文は
      // app.vue / pages/ でuseSeoMetaで上書きする。
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

  // @nuxtjs/sitemapが利用するサイトURL。canonical / og:urlの絶対化にも使われる。
  site: {
    url: 'https://nuxt-ai-blog.atlas-lab.workers.dev',
    name: 'nuxt-ai-blog',
  },

  modules: ['@nuxt/content', '@nuxtjs/color-mode', '@nuxt/eslint', '@nuxtjs/sitemap'],

  css: ['~/assets/css/main.css'],

  vite: {
    // Tailwind v4 はViteプラグイン経由で統合
    plugins: [tailwindcss()],
  },

  colorMode: {
    // <html class="dark"> スタイル戦略でTailwind v4 の @custom-variantと連動
    classSuffix: '',
    preference: 'system',
    fallback: 'light',
    storageKey: 'nuxt-ai-blog.theme',
  },

  nitro: {
    // Cloudflare Workers Module形式でデプロイ
    preset: 'cloudflare_module',
  },

  content: {
    // Node.js 22+ 組み込みのnative SQLiteを使用 (Windowsでbetter-sqlite3 の
    // node-gypビルドを避ける。本番Cloudflare WorkersではD1 に切り替える)
    experimental: {
      sqliteConnector: 'native',
    },
  },

  sitemap: {
    // 静的トップ + 動的ブログ記事URLを含める。
    // /api/__sitemap__/urlsからNuxt Contentのblogコレクションを列挙してURL化する。
    sources: ['/api/__sitemap__/urls'],
    // /api/* と /og-image.svgはsitemapから除外 (検索インデックス対象外)。
    exclude: ['/api/**'],
  },

  routeRules: {
    '/**': {
      // セキュリティヘッダをNitroレベルで全ルート一括付与する。
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        // CSPはXSSに対する追加防御として全ルートに付与する。
        // Nuxtのハイドレーションスクリプトとcolor-modeのtheme初期化スクリプトが
        // インラインなので 'unsafe-inline' が必要 (nonce化は将来課題)。
        // Nuxt Contentのsqlite-wasmはSPA遷移時にブラウザ上でWebAssemblyを
        // compile / instantiateするため、JS evalではなくWebAssembly限定で許可する。
        // `unsafe-eval` は許可せず、wasm-unsafe-evalに範囲を絞る。
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
    // サーバーサイドのみで読み取れる値。NUXT_ANTHROPIC_API_KEYで注入 (ローカル: .env、本番: wrangler secret)
    anthropicApiKey: '',
    // /api/summaryの 実API生成を保護するデモ用アクセスキー。
    // NUXT_SUMMARY_ACCESS_KEYで注入し、クライアントbundleには含めない。
    summaryAccessKey: '',
  },

  typescript: {
    strict: true,
    // typeCheckはdev/build時のvite-plugin-checker経由実行でHMRと競合しやすいため無効。
    // 型チェックはCIのnpm run typecheck (nuxt typecheck → vue-tsc) で担保する。
    typeCheck: false,
  },
});
