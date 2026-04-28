# Design Decisions

このドキュメントは nuxt-ai-blog を実装する時に下した**トレードオフを伴う判断**とその理由を記録する。

---

## 1. ランタイムは Cloudflare Workers + Nitro `cloudflare_module` preset

**決定**: Vercel / Netlify Edge ではなく Cloudflare Workers Module 形式（Nuxt 4 / Nitro 標準対応）でデプロイする。

**理由**:
- Free 枠 100,000 req/day で十分（デモ用途）
- Cloudflare アカウントに集約してコスト管理を一本化
- D1 binding が同じ Worker 内で使えて、Nuxt Content 3 の本番ストレージとして自然に繋がる

**トレードオフ**:
- Workers の **3 MiB（gzip 後）上限** は厳守必要。2026-04-29 時点の Nitro total は 935 kB / 308 kB gzip なので余裕があるが、将来の依存追加は要監視。
- ローカル開発は `nuxt dev`（Vite）、本番に近い検証は `wrangler dev .output/server/index.mjs` で行う 2 段階構成。

---

## 2. AI 要約は **non-streaming POST**

**決定**: SSE / streaming を使わず、`Anthropic.messages.create` を 1 回呼んで `max_tokens: 256` の応答を待つ。

**理由**:
- 要約は 150 字以内 / 1〜2 文の短い出力。生成時間は ~3〜5 秒で、ストリーミングによる UX 上の差分が小さい
- API 仕様 / クライアント実装 / テストが大幅にシンプルになる（fetch 1 回 → JSON 受け取り）
- 短時間処理ゆえ「キャンセルボタン」UI も不要にできる（連打防止だけで十分）

**トレードオフ**:
- ユーザーは応答が返ってくるまで全画面で何も見えない。`AiSummaryButton` は `loading` 状態でボタンを `disabled` + 「生成中...」表示にして体感を緩和している。
- 応答途中での部分表示はできない。150 字制約があるのでそもそも部分表示の価値が低いと判断。

---

## 3. モデルは `claude-haiku-4-5-20251001` に固定

**決定**: UI からのモデル選択は出さず、`server/api/summary.post.ts` の `MODEL` 定数に固定。

**理由**:
- Haiku 4.5 は最安かつ十分な品質（150 字要約）
- 月額 Spend Limit と合わせてコスト上限を設計側で縛る
- 切り替えたくなった時の変更は 1 行に閉じ込める

**トレードオフ**:
- ユーザー側からの柔軟性ゼロ。デモ用途では許容、本番では `runtimeConfig.public` 経由で UI 選択肢にする拡張余地あり。

---

## 4. AI生成はアクセスキー + in-memory rate limit で保護

**決定**: 公開ページはそのまま閲覧可能にし、`/api/summary` の live AI 生成だけ `NUXT_SUMMARY_ACCESS_KEY` と `X-Summary-Access-Key` で保護する。加えて Workers KV / Durable Objects / 専用 Rate Limiter binding は使わず、module-level `Map` で IP ごとに timestamp 配列を保持。`getClientIp` は `CF-Connecting-IP` 優先、フォールバックで `x-forwarded-for` の左端。

**理由**:
- ブログ本文は公開ポートフォリオとして見せたいが、AI API の課金経路だけは利用条件を設ける必要がある
- 同一 isolate に同 IP がヒットする確率が高いデモ規模では十分機能
- KV の書き込みレイテンシ（数十 ms）と課金を避けられる
- `checkRateLimit(ip, now)` シグネチャで KV 版への差し替えが機械的にできる

**トレードオフ**:
- access key はデモ用の利用条件であり、ユーザー別認可ではない。本格運用では Turnstile / Cloudflare Access / アカウント制認証に置き換える。
- 複数 isolate が並列起動するケースで制限が緩くなる。本番スケール時は `env.RATE_LIMITER.limit({ key })` Cloudflare Rate Limiter binding に置換可能。
- 同種の公開 AI エンドポイントで共通化しやすい判断（共通の問題は共通の解で対応、コード読解負荷を下げる）。

---

## 5. AI 要約結果の in-memory cache（TTL 1h）

**決定**: 同 slug の連続 POST で Anthropic API を再呼出ししないよう、Map ベースのキャッシュを実装。キーは `summary:<slug>`、TTL 1 時間。

**理由**:
- 同じ記事のページを採用担当者が複数回読む場合、初回以外は 28ms で返る（実測）
- レート制限と独立してコスト保護を 2 重に効かせる
- 1 時間 TTL は「同セッション内で再生成は不要」という前提に合致

**トレードオフ**:
- 複数 isolate での非共有は同上。
- TTL 1 時間内に記事内容を編集した場合、要約が古いまま。デモ用途では問題ないが、運用時は管理画面から手動 invalidate API を足す余地あり。

---

## 6. Nuxt Content 3 の本番ストレージは Cloudflare D1

**決定**: ローカルは Node.js 22+ 組み込みの native SQLite (`content.experimental.sqliteConnector: 'native'`)、本番 Workers では `d1_databases` binding `DB` に自動切替。

**理由**:
- Windows での `better-sqlite3` の node-gyp ビルド失敗を回避
- 本番では D1 を使うことで Cloudflare Edge での記事取得をミリ秒オーダーにできる
- Nuxt Content 3 が D1 を公式サポートしており、設定だけで切替可能

**トレードオフ**:
- D1 はビルド時にスキーマ + データを流し込む方式。記事を追加する度に再 deploy が必要（CMS 風の運用ではない）。デモではむしろ「記事は git で管理する Markdown のみ」というシンプルさが利点。

---

## 7. server-side `queryCollection` は adapter に閉じ込める

**決定**: `server/utils/content-query.ts` に `fetchBlogArticleBySlug()` と `fetchBlogSitemapArticles()` を置き、`queryCollection(event, 'blog')` の server-side overload は adapter 内で扱う。client 版の `queryCollection('blog')` は server route では使わない。

**理由**:
- Nuxt Content 3 の公式仕様（`/nuxt/content` Server-side Querying）。client 版で呼ぶと内部の `getRequestHeaders` が `event.node` を `undefined` で参照して `TypeError: Cannot read properties of undefined (reading 'req')`
- QA 工程で実際に踏んで debug deploy で原因特定（commit `f31c9b4`）
- route handler 本体に `@ts-expect-error` を散在させると、面接官が型安全性の説明を追いにくい

**トレードオフ**:
- TypeScript 型定義は client 版（1 引数）が中心なので、adapter 内では server-side query の最小インターフェイスを自前で定義している。将来 Nuxt Content 側の型定義が整ったら adapter を薄くできる。

---

## 8. `enable_request_signal` flag で client disconnect 時の課金保護

**決定**: `wrangler.jsonc` に `compatibility_flags: ["nodejs_compat", "enable_request_signal"]` を設定。

**理由**:
- Cloudflare Workers の `Request.signal` の abort event 配信には flag が必須（2025-05-22 の Cloudflare changelog）
- ページ離脱で Anthropic SDK 呼び出しが中断され、レスポンス受信前なら課金停止
- AI 系エンドポイントで得た知見を横展開

**トレードオフ**:
- flag 無し時の挙動は「listener が発火しない」だけで Workers 自体は動くため、忘れた時の発覚が遅い。`wrangler.jsonc` のコメントで明示してプロジェクトテンプレ化。

---

## 9. ダークモードは `@nuxtjs/color-mode` + Tailwind v4 `@custom-variant`

**決定**: `colorMode.classSuffix: ''` で `<html>` に `light` / `dark` クラスのみ付与し、Tailwind v4 の `@custom-variant dark (&:where(.dark, .dark *));` で連動。

**理由**:
- OS 追従（`prefers-color-scheme` のみ）だと採用担当者の OS 設定に縛られる
- 3 択（ライト / 自動 / ダーク）で切替体験をデモ中に見せられる
- `@nuxtjs/color-mode` が SSR レンダ時の class 注入と FOUC 防止 inline script を自動生成
- Tailwind v4 は `@custom-variant` で class 戦略へ切替可能（v3 の `darkMode: 'class'` 設定相当）

**トレードオフ**:
- リロード後の `aria-pressed` 表示が UI ボタン上で「自動」を示すケースがある（実 class は dark）。QA で記録、Should として後続セッションで取り組む。実ユーザーの見た目はダークなので実害低。

---

## 10. テスト戦略: Vitest 109 件 / 16 ファイル + Playwright Chromium 10 シナリオ

**決定**: Vitest **109 件 / 16 ファイル** (server/utils/{cache,rate-limit,daily-limit,summary-parse,article-text,summary-helpers,summary-access,content-query} / composables/useAiSummary / components/{ArticleCard,AiSummaryButton,ThemeToggle} / server/api/{summary.post,__sitemap__/urls} / utils/article-filter)、Playwright Chromium で記事一覧 / 検索とタグ絞り込み / 詳細遷移 / ダークモード + AI 要約 (成功 / 429 rate_limit / 500 upstream_unavailable mock) + a11y target-size の 10 シナリオ pass。

**理由**:
- AI 要約フロー (Anthropic API mock + cache + rate limit) を **E2E + handler unit (8 ケース) + composables unit (8 ケース)** の三層で守ることで、本番 smoke 未到達でも回帰検知できる
- handler 本体は `executeSummaryHandler` を named export + `SummaryHandlerDeps` で依存注入可能化し、Anthropic SDK / queryCollection / runtimeConfig を vi.mock + class-based mock + 型 unknown キャストで切り離している
- Markdown レンダ → Prose スタイルは Nuxt Content 3 の責務でアプリ側のテスト価値が低い
- coverage gate は `vitest.config.ts` の閾値 (lines 60 / branches 50 / funcs 70 / statements 60) で機械的に強制、現状 stmts 95.76 / branches 87.83 / funcs 98.03 / lines 96.59

**トレードオフ**:
- `server/api/summary.post.ts` の coverage は 0% → 88.37% まで引き上げたが、per-IP rate-limit / global daily-limit Hit 時の `setResponseHeader` ブロック (72-73 / 79-80 / 183 行) は cost-benefit からテスト対象外として許容
- Anthropic AbortSignal 伝播 (`event.req.signal` → `messages.create(params, { signal })`) は実装 + unit test pass。本番 Cloudflare Workers での `enable_request_signal` flag の実動作は production smoke で検証する
- Cross-browser (Firefox / WebKit) は現時点では Chromium のみで pass。Firefox / WebKit はブラウザ導入済みの環境で別途確認する
