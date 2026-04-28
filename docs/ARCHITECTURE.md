# Architecture

## 概要

nuxt-ai-blog は Nuxt 4 + Vue 3.5 の SSR ブログで、Cloudflare Workers の Module 形式（Nitro `cloudflare_module` preset）でデプロイされます。記事本体は Markdown ファイルで管理し、ビルド時に Nuxt Content 3 が D1 互換の SQLite スキーマに変換します。記事一覧には検索 / タグ絞り込みを備え、記事詳細ページでアクセスキーを入力すると Workers の `/api/summary` に POST が飛び、Anthropic Claude Haiku 4.5 が記事内容を 150 字以内に要約して返します。

## コンポーネント構成

```
┌──────────────────────────────────────────────┐
│ ブラウザ (Vue 3.5 + Nuxt 4 client) │
│ │
│ layouts/default.vue │
│ └─ ThemeToggle (ライト/自動/ダーク) │
│ │
│ pages/index.vue │
│ ├─ 検索 / タグ絞り込み │
│ └─ ArticleCard × 5 (queryCollection) │
│ │
│ pages/blog/[slug].vue │
│ ├─ ContentRenderer (Markdown → HTML) │
│ └─ AiSummaryButton │
│ └─ useAiSummary.summarize(slug, accessKey) │
│ └─ $fetch('/api/summary') │
└────────────────┬─────────────────────────────┘
 │ POST application/json
│ {"slug":"<slug>"} + X-Summary-Access-Key
 ▼
┌──────────────────────────────────────────────┐
│ Cloudflare Workers (Nitro cloudflare_module)│
│ │
│ /api/summary (server/api/summary.post.ts) │
│ ├─ checkRateLimit (10 req/60s, IP単位) │
│ ├─ checkSummaryAccess (server-only secret照合) │
│ ├─ slug validation (^[a-z0-9-]{1,127}$) │
│ ├─ cacheGet (in-memory, TTL 1h) │
│ ├─ queryCollection(event, 'blog') │
│ │ └─ env.DB (D1 Database) │
│ ├─ anthropic.messages.create( │
│ │ model: claude-haiku-4-5, │
│ │ max_tokens: 256, │
│ │ maxRetries: 0) │
│ └─ cacheSet (TTL 1h) │
│ │
│ enable_request_signal flag │
│ → client disconnect で Anthropic abort │
└────────────────┬─────────────────────────────┘
 │ Anthropic API
 ▼
┌──────────────────────────────────────────────┐
│ Anthropic (claude-haiku-4-5-20251001) │
│ 150 字以内 / 日本語 / 1〜2 文の平文 │
└──────────────────────────────────────────────┘
```

## データフロー

### 1. 記事一覧表示 (SSR)

1. ブラウザが `/` にアクセス
2. Nitro が `pages/index.vue` を server-side レンダ
3. `useAsyncData('blog-index')` 内で `queryCollection('blog').order('date','DESC').all()` を実行
4. D1 にビルド時に流し込まれた blog コレクションから記事 5 件を取得
5. `ArticleCard` で grid 表示（sm 以上で 2 カラム）

### 2. 記事詳細表示 (SSR)

1. `/blog/<slug>` で `pages/blog/[slug].vue` をレンダ
2. `useAsyncData('blog-<slug>')` で `queryCollection('blog').path(route.path).first()`
3. 該当記事が無ければ `throw createError({ statusCode: 404, fatal: true })`
4. `ContentRenderer` が Markdown AST を Prose スタイルで描画
5. `useSeoMeta` が article 用 OG / Twitter card を上書き

### 3. AI 要約

1. `AiSummaryButton` でアクセスキー入力後、クリックで `useAiSummary.summarize(slug, accessKey)`
2. composable が `$fetch('/api/summary', { method: 'POST', body: { slug }, headers: { X-Summary-Access-Key } })`
3. Workers 側 `summary.post.ts` の処理:
 1. `checkRateLimit(getClientIp(event))` → 失敗で 429 + Retry-After
 2. `checkSummaryAccess(event, runtimeConfig.summaryAccessKey)` → 失敗で 401
 3. slug バリデーション（英小文字数字ハイフンのみ）→ 失敗で 400
 4. `cacheGet('summary:<slug>')` → ヒットなら `{ ...cached, cached: true }` 即返却
 5. `fetchBlogArticleBySlug(event, slug)` で記事 fetch（server-side `queryCollection` の型境界は adapter に閉じ込める）
 6. `checkDailyLimit()` → 失敗で 429 + Retry-After
 7. `client.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 256, maxRetries: 0 })`
 8. `cacheSet('summary:<slug>', response, 60*60*1000)`
4. composable が `summary.value = res` し、UI に表示

### 4. テーマ切替

1. `ThemeToggle` の 3 ボタンが `useColorMode().preference` を `light` / `system` / `dark` にセット
2. `@nuxtjs/color-mode` (`classSuffix: ''`) が `<html>` に `light` または `dark` クラスを付与
3. Tailwind v4 の `@custom-variant dark (&:where(.dark, .dark *))` が連動
4. localStorage `nuxt-ai-blog.theme` に保存、リロード後も維持

### 5. クライアント切断時の課金保護

- `wrangler.jsonc` の `compatibility_flags: ["nodejs_compat", "enable_request_signal"]` が必須
- ブラウザ離脱時に Cloudflare が `Request.signal.abort` イベント発火
- Anthropic SDK の fetch が AbortSignal で中断され、レスポンス受信前なら課金停止

## ディレクトリ構成

```
.
├── app.vue # ルートコンポーネント、useHead で site 共通 OG
├── nuxt.config.ts # routeRules でセキュリティヘッダ全ルート付与
├── content.config.ts # blog コレクションの zod schema
├── content/
│ └── blog/ # 記事 Markdown 5 本
├── layouts/
│ └── default.vue # ヘッダ + main + フッタ
├── pages/
│ ├── index.vue # 記事一覧 (SSR + 検索/タグ絞り込み)
│ └── blog/
│ └── [slug].vue # 記事詳細 (SSR + AiSummaryButton)
├── components/
│ ├── ArticleCard.vue # 記事カード
│ ├── ThemeToggle.vue # 3 択トグル
│ └── AiSummaryButton.vue # AI 要約ボタン + 結果表示
├── composables/
│ └── useAiSummary.ts # /api/summary 呼び出し
├── server/
│ ├── api/
│ │ └── summary.post.ts # AI 要約エンドポイント本体
│ └── utils/
│ ├── rate-limit.ts # h3 event 版 sliding window
│ ├── summary-access.ts # AI要約アクセスキー検証
│ ├── content-query.ts # Nuxt Content server-side query adapter
│ └── cache.ts # TTL 付き in-memory key-value
├── utils/
│ └── article-filter.ts # 記事検索 / タグ絞り込みの純関数
└── tests/
 ├── server/utils/*.test.ts # Vitest ユニット
 └── components/*.test.ts # @vue/test-utils
```

## テスト戦略

| 層 | 対象 | ツール | 件数 |
|---|---|---|---|
| Unit (server) | `server/utils/{rate-limit,cache,daily-limit,summary-parse,article-text,summary-helpers,summary-access,content-query}` | Vitest (Node 環境) | 8 ファイル |
| Unit (shared UI logic) | `utils/article-filter` | Vitest | 1 ファイル |
| Unit (composable) | `composables/useAiSummary` | Vitest + happy-dom + `$fetch` mock | 1 ファイル |
| Component | `components/{ArticleCard,AiSummaryButton,ThemeToggle}` | Vitest + @vue/test-utils | 3 ファイル |
| E2E (blog) | 記事一覧 5 本 / 検索とタグ絞り込み / 詳細遷移 / ダークモード | Playwright (Chromium) | 4 pass |
| E2E (AI 要約) | 成功フロー / 429 rate_limit / 500 upstream_unavailable (`page.route` mock) | Playwright (Chromium) | 3 pass |
| E2E (a11y target-size) | 記事一覧 / 記事詳細の主要操作 44×44 CSS px 検査 | Playwright (Chromium) | 3 pass |

合計 Vitest **109 件 / 16 ファイル** + Playwright **10 件**。coverage は CI quality-gate で `vitest.config.ts` の閾値を機械的に強制し、2026-04-29 時点の実測は stmts 95.76 / branches 87.83 / funcs 98.03 / lines 96.59。`server/api/summary.post.ts` は `executeSummaryHandler` を named export 化 + `SummaryHandlerDeps` で Anthropic SDK / queryCollection / runtimeConfig を依存注入可能にし、handler 本体 10 ケースのテストを追加している。

## CI

`.github/workflows/ci.yml`:

1. **quality-gate**: `npm ci` → typecheck → lint → `test:coverage` (coverage gate) → `npm audit --audit-level=high` → `scripts/check-secrets.sh` → build
2. **e2e**: quality-gate 成功後、`playwright install --with-deps chromium` → build → E2E → artifact upload
3. **deploy**: main push 時のみ、quality-gate + e2e 通過後に Cloudflare Workers へ `cloudflare/wrangler-action@v3` で deploy

`scripts/check-secrets.sh` は CI 同梱可能な secrets プレフィックス（GitHub PAT / Anthropic API Key / Google API Key / AWS Access Key 系の各プレフィックス）のみ検査する。プロジェクト固有の非公開語は `_docs/DANGER-WORDS.txt`（ローカル専用、公開リポ外）参照のローカルチェック `scripts/check-before-publish.sh` で担保。

## セキュリティ境界

- **API Key**: Cloudflare Workers Secrets `NUXT_ANTHROPIC_API_KEY` のみ
- **Summary access key**: Cloudflare Workers Secrets `NUXT_SUMMARY_ACCESS_KEY` を server-only runtimeConfig として読み、`X-Summary-Access-Key` と照合
- **D1 binding**: `wrangler.jsonc` の `database_id` は public 扱い（API token 必須でアクセス制御）
- **入力検証**: slug の正規表現 `^[a-z0-9][a-z0-9-]{0,126}$`（SSRF / path traversal 対策）
- **レート制限**: IP 単位 10 req / 60s（CF-Connecting-IP 優先、sliding window、in-memory）+ global daily limit 200 req / UTC日
- **セキュリティヘッダ**: `nuxt.config.ts` の `routeRules` で全ルート一括付与（nosniff / X-Frame-Options DENY / Referrer-Policy / Permissions-Policy / HSTS）
- **クライアント切断保護**: `enable_request_signal` flag で Anthropic への課金漏れを防止
- **XSS**: Vue / Nuxt 標準エスケープ。`v-html` は ContentRenderer 内部のみ（Markdown のサニタイズは `@nuxt/content` 標準）
- **コミット履歴**: 全 author を `proto-atlas <278522736+proto-atlas@users.noreply.github.com>` に固定（個人 GitHub と分離）
