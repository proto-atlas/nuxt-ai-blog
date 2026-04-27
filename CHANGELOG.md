# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-04-25

### Added

- Nuxt 4 + Vue 3.5 + @nuxt/content 3 ベースのブログ初期実装（Cloudflare Workers デプロイ対応）
- 5 本のサンプル記事（Nuxt 4 / TypeScript 6 / Cloudflare Workers / Tailwind v4 / ESLint 10）
- 記事一覧ページ（`pages/index.vue`）と記事詳細ページ（`pages/blog/[slug].vue`）
- 共通レイアウト（`layouts/default.vue`、ヘッダ + フッタ + ThemeToggle 配置）
- 3 択テーマトグル（ライト / 自動 / ダーク、`localStorage` 永続化、`@nuxtjs/color-mode` 経由）
- AI 要約 API（`POST /api/summary`、Anthropic Claude Haiku 4.5、150 字要約）
- AI 要約 UI コンポーネント（`AiSummaryButton.vue`、cached バッジ + モデル名 + 生成時刻表示）
- スライディングウィンドウ式レート制限（10 req/60s、CF-Connecting-IP 優先）
- in-memory 要約キャッシュ（TTL 1h、`summary:<slug>` キー）
- セキュリティヘッダ 5 件付与（Nitro `routeRules` で全ルート: nosniff / X-Frame-Options DENY / Referrer-Policy / Permissions-Policy / HSTS）
- OG / Twitter Card メタタグ（`og:title` / `og:description` / `og:image` / `og:type=article` / `twitter:card=summary` / `article:published_time`）
- canonical URL（記事一覧 + 詳細で `<link rel="canonical">`）
- `<html lang="ja">` 設定（a11y スクリーンリーダー言語判別）
- ブランド統一の 404 / エラーページ（`error.vue`、ステータスコード別文言）
- 動的 sitemap.xml（`@nuxtjs/sitemap` + `/api/__sitemap__/urls` で全記事 URL 列挙）
- og:image SVG（1200×630、ブランドカラー）
- Cloudflare D1 統合（Nuxt Content 3 の本番ストレージ）
- `wrangler.jsonc` に `compatibility_flags: nodejs_compat + enable_request_signal`
- Vitest ユニットテスト 33 件（rate-limit / cache / ArticleCard / useAiSummary / ThemeToggle / AiSummaryButton）
- Playwright E2E 3 シナリオ（記事一覧 / 記事遷移 / ダークモードトグル）
- カバレッジ閾値（lines 60% / functions 70% / branches 50% / statements 60%）達成
- GitHub Actions CI（typecheck / lint / test / check-secrets / build + Playwright Chromium）
- ドキュメント: `README.md` / `docs/ARCHITECTURE.md` / `docs/DESIGN-DECISIONS.md`

### Fixed

- Nuxt Content 3 の server-side `queryCollection` に `event` 第 1 引数渡し（型定義は client 版のみ公開なので `@ts-expect-error` で抑制）
- 375px viewport で記事詳細ページのコードブロックが横にはみ出す問題（`assets/css/main.css` で `overflow-x: auto` + `overflow-wrap: anywhere`）
- `ThemeToggle` リロード後 `aria-pressed` が「自動」を指す UI 不整合（`onMounted` で localStorage 同期）
- Playwright fixme 2 件解消（hydration 待ち + URL 待ちの追加で安定化）

### Security

- API Key / Secrets ハードコード防止（`scripts/check-before-publish.sh` ローカル + `scripts/check-secrets.sh` CI）
- Slug validation（英小文字数字ハイフンのみ、SSRF / path traversal 対策）

### Infrastructure

- 本番稼働 URL: `https://nuxt-ai-blog.atlas-lab.workers.dev`
- GitHub: `https://github.com/proto-atlas/nuxt-ai-blog`

[Unreleased]: https://github.com/proto-atlas/nuxt-ai-blog/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/proto-atlas/nuxt-ai-blog/releases/tag/v0.1.0
