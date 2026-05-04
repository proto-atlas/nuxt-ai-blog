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
- ローカル開発は `nuxt dev`（Vite）、本番に近い検証は `nuxt build` 後に `wrangler dev` / `wrangler deploy --dry-run` で custom wrapper entry (`worker/index.mjs`) を通して行う 2 段階構成。

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

## 4. AI生成はアクセスキー + short-window guard + Durable Objects quota で保護

**決定**: 公開ページはそのまま閲覧可能にし、`/api/summary` の live AI 生成だけ `NUXT_SUMMARY_ACCESS_KEY` と `X-Summary-Access-Key` で保護する。短期連投は module-level `Map` の per-IP sliding window で抑え、global daily live-generation quota は固定名 `GlobalSummaryQuotaDO` に集約する。`getClientIp` は `CF-Connecting-IP` 優先、フォールバックで `x-forwarded-for` の左端。

**理由**:
- ブログ本文は公開ポートフォリオとして見せたいが、AI API の課金経路だけは利用条件を設ける必要がある
- per-IP guard は「短時間の連打を落とす」目的に限定し、正確なglobal accountingとは主張しない
- 日次quotaは slug / IP / articleHash / cache key で分散させず、固定名Durable Objectをsource of truthにする
- quotaは live AI API call を開始する権利としてreserveし、upstream call開始後の失敗もcost exposureとして別カウントする

**トレードオフ**:
- access key はデモ用の利用条件であり、ユーザー別認可ではない。本格運用では Turnstile / Cloudflare Access / アカウント制認証に置き換える。
- per-IP sliding window は引き続き in-memory なので、Workers の複数 isolate 環境では短期連打抑止として扱う。本番SaaS化では Cloudflare Rate Limiting binding や Turnstile を追加する。
- Durable Objects binding が production で欠けている場合は、memory fallback へ黙って落とさず `server_misconfigured` で失敗させる。
- fixed-name `GlobalSummaryQuotaDO` は説明しやすい一方、traffic が大きくなれば hotspot になる。ポートフォリオ規模ではquota正確性と説明容易性を優先した。

---

## 5. AI 要約結果は Durable Objects cache（TTL 1h）

**決定**: 同じ記事・同じmodelの連続 POST で Anthropic API を再呼出ししないよう、`SummaryCacheDO` に要約を保存する。キーは `summary:v1:<model>:<slug>:<articleHash>`、TTL 1 時間。dev / test のみ in-memory fallback を使う。

**理由**:
- 同じ記事のページを第三者が複数回読む場合、2回目以降のlive AI生成を避けられる
- レート制限と独立してコスト保護を 2 重に効かせる
- 1 時間 TTL は「同セッション内で再生成は不要」という前提に合致
- articleHash を含めることで、記事本文が変わった時に古い要約を使わない
- pending marker と route 側の再確認で、同一cache keyの同時リクエストによる重複live AI生成を抑える

**トレードオフ**:
- production `cached:true` は Durable Objects 実装後に manual-live-summary-smoke で再確認する必要がある。
- `SummaryCacheDO` の pending marker は Durable Object Storage に保存するが、同一Object lifetime内の待機効率化にはin-memory signalも使う。eviction / restart時はStorage側のpending markerを優先し、timeout時は再試行を促す。
- Cache API はデータセンター間で自動複製されないため、source of truth にはしない。使う場合もlocal edge accelerationに限定する。

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

## 10. テスト戦略: Vitest 126 件 / 20 ファイル + Playwright Chromium 11 シナリオ

**決定**: Vitest **126 件 / 20 ファイル** (server/utils/{cache,rate-limit,daily-limit,summary-parse,article-text,summary-helpers,summary-access,content-query,summary-control,summary-durable-objects,summary-quality,summary-ai-client} / composables/useAiSummary / components/{ArticleCard,AiSummaryButton,ThemeToggle} / server/api/{summary.post,__sitemap__/urls} / utils/article-filter)、Playwright Chromium で記事一覧 / 検索とタグ絞り込み / 詳細遷移 / 一覧へ戻る導線 / ダークモード + AI 要約 (成功 / 429 rate_limit / 500 upstream_unavailable mock) + a11y target-size の 11 シナリオ pass。

**理由**:
- AI 要約フロー (Anthropic API mock + cache + rate limit) を **E2E + handler unit (8 ケース) + composables unit (8 ケース)** の三層で守ることで、本番 smoke 未到達でも回帰検知できる
- handler 本体は `executeSummaryHandler` を named export + `SummaryHandlerDeps` で依存注入可能化し、Anthropic SDK 境界を `summary-ai-client` adapterへ閉じ込め、route本体は `summaryClient` / queryCollection / runtimeConfig を差し替える
- Markdown レンダ → Prose スタイルは Nuxt Content 3 の責務でアプリ側のテスト価値が低い
- coverage gate は `vitest.config.ts` の閾値 (lines 60 / branches 50 / funcs 70 / statements 60) で機械的に強制、現状 stmts 85.51 / branches 79.54 / funcs 90.74 / lines 87.10

**トレードオフ**:
- `server/api/summary.post.ts` の coverage は 0% → 88.37% まで引き上げたが、per-IP rate-limit / global daily-limit Hit 時の `setResponseHeader` ブロック (72-73 / 79-80 / 183 行) は cost-benefit からテスト対象外として許容
- Anthropic AbortSignal 伝播 (`event.req.signal` → `messages.create(params, { signal })`) は実装 + unit test pass。本番 Cloudflare Workers での `enable_request_signal` flag の実動作は production smoke で検証する
- Cross-browser (Firefox / WebKit) は現時点では Chromium のみで pass。Firefox / WebKit はブラウザ導入済みの環境で別途確認する
