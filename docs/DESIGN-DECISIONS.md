# 設計判断

このドキュメントはnuxt-ai-blogを実装する時に下した**トレードオフを伴う判断**とその理由を記録する。

---

## 1. ランタイムはCloudflare Workers + Nitro `cloudflare_module` preset

**決定**: Vercel / Netlify EdgeではなくCloudflare Workers Module形式（Nuxt 4 / Nitro標準対応）でデプロイする。

**理由**:
- Free枠 100,000 req/dayで十分（デモ用途）
- Cloudflareアカウントに集約してコスト管理を一本化
- D1 bindingが同じWorker内で使えて、Nuxt Content 3 の本番ストレージとして自然に繋がる

**トレードオフ**:
- Workersの **3 MiB（gzip後）上限** は厳守必要。2026-04-29 時点のNitro totalは 935 kB / 308 kB gzipなので余裕があるが、将来の依存追加は要監視。
- ローカル開発は `nuxt dev`（Vite）、本番に近い検証は `nuxt build` 後に `wrangler dev` / `wrangler deploy --dry-run` でcustom wrapper entry (`worker/index.mjs`) を通して行う 2 段階構成。

---

## 2. AI要約は **non-streaming POST**

**決定**: SSE / streamingを使わず、`Anthropic.messages.create` を 1 回呼んで `max_tokens: 256` の応答を待つ。

**理由**:
- 要約は 150 字以内 / 1〜2 文の短い出力。生成時間は ~3〜5 秒で、ストリーミングによるUX上の差分が小さい
- API仕様 / クライアント実装 / テストが大幅にシンプルになる（fetch 1 回 → JSON受け取り）
- 短時間処理ゆえ「キャンセルボタン」UIも不要にできる（連打防止だけで十分）

**トレードオフ**:
- ユーザーは応答が返ってくるまで全画面で何も見えない。`AiSummaryButton` は `loading` 状態でボタンを `disabled` + 「生成中...」表示にして体感を緩和している。
- 応答途中での部分表示はできない。150 字制約があるのでそもそも部分表示の価値が低いと判断。

---

## 3. モデルは `claude-haiku-4-5-20251001` に固定

**決定**: UIからのモデル選択は出さず、`server/api/summary.post.ts` の `MODEL` 定数に固定。

**理由**:
- Haiku 4.5 は最安かつ十分な品質（150 字要約）
- 月額Spend Limitと合わせてコスト上限を設計側で縛る
- 切り替えたくなった時の変更は 1 行に閉じ込める

**トレードオフ**:
- ユーザー側からの柔軟性ゼロ。デモ用途では許容、本番では `runtimeConfig.public` 経由でUI選択肢にする拡張余地あり。

---

## 4. AI生成はアクセスキー + short-window guard + Durable Objects quotaで保護

**決定**: 公開ページはそのまま閲覧可能にし、`/api/summary` の 実API生成だけ `NUXT_SUMMARY_ACCESS_KEY` と `X-Summary-Access-Key` で保護する。短期連投はmodule-level `Map` のper-IP sliding windowで抑え、global daily live-generation quotaは固定名 `GlobalSummaryQuotaDO` に集約する。`getClientIp` は `CF-Connecting-IP` 優先、フォールバックで `x-forwarded-for` の左端。

**理由**:
- ブログ本文は公開URLで見せたいが、AI APIの課金経路だけは利用条件を設ける必要がある
- per-IP guardは「短時間の連打を落とす」目的に限定し、正確なglobal accountingとは主張しない
- 日次quotaはslug / IP / articleHash / cache keyで分散させず、固定名Durable Objectをsource of truthにする
- quotaは実API呼び出しを開始する権利としてreserveし、upstream call開始後の失敗もcost exposureとして別カウントする

**トレードオフ**:
- アクセスキーは確認用の利用条件であり、ユーザー別認可ではない。利用者ごとに認可する運用ではTurnstile / Cloudflare Access / アカウント制認証に置き換える。
- per-IP sliding windowは引き続きin-memoryなので、Workersの複数isolate環境では短期連打抑止として扱う。ユーザー登録を含む運用にする場合はCloudflare Rate Limiting bindingやTurnstileを追加する。
- Durable Objects bindingがproductionで欠けている場合は、メモリ上の代替処理へ黙って落とさず `server_misconfigured` で失敗させる。
- fixed-name `GlobalSummaryQuotaDO` は説明しやすい一方、trafficが大きくなればhotspotになる。小規模な確認用URLではquota正確性と説明容易性を優先した。

---

## 5. AI要約結果はDurable Objects cache（TTL 1h）

**決定**: 同じ記事・同じmodelの連続POSTでAnthropic APIを再呼出ししないよう、`SummaryCacheDO` に要約を保存する。キーは `summary:v1:<model>:<slug>:<articleHash>`、TTL 1 時間。開発時とテスト時だけメモリ上の代替処理を使う。

**理由**:
- 同じ記事のページを第三者が複数回読む場合、2回目以降の実API生成を避けられる
- レート制限と独立してコスト保護を 2 重に効かせる
- 1 時間TTLは「同セッション内で再生成は不要」という前提に合致
- articleHashを含めることで、記事本文が変わった時に古い要約を使わない
- pending markerとroute側の再確認で、同一cache keyの同時リクエストによる重複実API生成を抑える

**トレードオフ**:
- 本番 `cached:true` はDurable Objects実装後にmanual-live-summary-checkで再確認する必要がある。
- `SummaryCacheDO` のpending markerはDurable Object Storageに保存するが、同一Object lifetime内の待機効率化にはin-memory signalも使う。eviction / restart時はStorage側のpending markerを優先し、timeout時は再試行を促す。
- Cache APIはデータセンター間で自動複製されないため、source of truthにはしない。使う場合もlocal edge accelerationに限定する。

---

## 6. Nuxt Content 3 の本番ストレージはCloudflare D1

**決定**: ローカルはNode.js 22+ 組み込みのnative SQLite (`content.experimental.sqliteConnector: 'native'`)、本番Workersでは `d1_databases` binding `DB` に自動切替。

**理由**:
- Windowsでの `better-sqlite3` のnode-gypビルド失敗を回避
- 本番ではD1 を使うことでCloudflare Edgeでの記事取得をミリ秒オーダーにできる
- Nuxt Content 3 がD1 を公式サポートしており、設定だけで切替可能

**トレードオフ**:
- D1 はビルド時にスキーマ + データを流し込む方式。記事を追加する度に再deployが必要（CMS風の運用ではない）。デモではむしろ「記事はgitで管理するMarkdownのみ」というシンプルさが利点。

---

## 7. server-side `queryCollection` はadapterに閉じ込める

**決定**: `server/utils/content-query.ts` に `fetchBlogArticleBySlug()` と `fetchBlogSitemapArticles()` を置き、`queryCollection(event, 'blog')` のserver-side overloadはadapter内で扱う。client版の `queryCollection('blog')` はserver routeでは使わない。

**理由**:
- Nuxt Content 3 の公式仕様（`/nuxt/content` Server-side Querying）。client版で呼ぶと内部の `getRequestHeaders` が `event.node` を `undefined` で参照して `TypeError: Cannot read properties of undefined (reading 'req')`
- QA工程で実際に踏んでdebug deployで原因特定（commit `f31c9b4`）
- route handler本体に `@ts-expect-error` を散在させると、読み手が型安全性の説明を追いにくい

**トレードオフ**:
- TypeScript型定義はclient版（1 引数）が中心なので、adapter内ではserver-side queryの最小インターフェイスを自前で定義している。将来Nuxt Content側の型定義が整ったらadapterを薄くできる。

---

## 8. `enable_request_signal` flagでclient disconnect時の課金保護

**決定**: `wrangler.jsonc` に `compatibility_flags: ["nodejs_compat", "enable_request_signal"]` を設定。

**理由**:
- Cloudflare Workersの `Request.signal` のabort event配信にはflagが必須（2025-05-22 のCloudflare changelog）
- ページ離脱でAnthropic SDK呼び出しが中断され、レスポンス受信前なら課金停止
- AI系エンドポイントで得た知見を横展開

**トレードオフ**:
- flag無し時の挙動は「listenerが発火しない」だけでWorkers自体は動くため、忘れた時の発覚が遅い。`wrangler.jsonc` のコメントで明示してプロジェクトテンプレ化。

---

## 9. ダークモードは `@nuxtjs/color-mode` + Tailwind v4 `@custom-variant`

**決定**: `colorMode.classSuffix: ''` で `<html>` に `light` / `dark` クラスのみ付与し、Tailwind v4 の `@custom-variant dark (&:where(.dark, .dark *));` で連動。

**理由**:
- OS追従（`prefers-color-scheme` のみ）だと閲覧者のOS設定に縛られる
- 3 択（ライト / 自動 / ダーク）で切替体験をデモ中に見せられる
- `@nuxtjs/color-mode` がSSRレンダ時のclass注入とFOUC防止inline scriptを自動生成
- Tailwind v4 は `@custom-variant` でclass戦略へ切替可能（v3 の `darkMode: 'class'` 設定相当）

**トレードオフ**:
- リロード後の `aria-pressed` 表示がUIボタン上で「自動」を示すケースがある（実classはdark）。QAで記録、Shouldとして後続セッションで取り組む。実ユーザーの見た目はダークなので実害低。

---

## 10. テスト戦略: Vitest 126 件 / 20 ファイル + Playwright Chromium 11 シナリオ

**決定**: Vitest **126 件 / 20 ファイル** (server/utils/{cache,rate-limit,daily-limit,summary-parse,article-text,summary-helpers,summary-access,content-query,summary-control,summary-durable-objects,summary-quality,summary-ai-client} / composables/useAiSummary / components/{ArticleCard,AiSummaryButton,ThemeToggle} / server/api/{summary.post,__sitemap__/urls} / utils/article-filter)、Playwright Chromiumで記事一覧 / 検索とタグ絞り込み / 詳細遷移 / 一覧へ戻る導線 / ダークモード + AI要約 (成功 / 429 rate_limit / 500 upstream_unavailableの応答置き換え) + a11y target-sizeの 11 シナリオ 通過。

**理由**:
- AI要約フロー (Anthropic APIの応答置き換え + cache + rate limit) を **E2E + handler unit (8 ケース) + composables unit (8 ケース)** の三層で確認し、本番疎通確認に到達する前でも回帰検知できる
- handler本体は `executeSummaryHandler` をnamed export + `SummaryHandlerDeps` で依存注入可能化し、Anthropic SDK境界を `summary-ai-client` adapterへ閉じ込め、route本体は `summaryClient` / queryCollection / runtimeConfigを差し替える
- Markdownレンダ → ProseスタイルはNuxt Content 3 の責務でアプリ側のテスト価値が低い
- coverage閾値 は `vitest.config.ts` の閾値 (lines 60 / branches 50 / funcs 70 / statements 60) で機械的に強制、現状stmts 85.51 / branches 79.54 / funcs 90.74 / lines 87.10

**トレードオフ**:
- `server/api/summary.post.ts` のcoverageは 0% → 88.37% まで引き上げたが、per-IP rate-limit / global daily-limit Hit時の `setResponseHeader` ブロック (72-73 / 79-80 / 183 行) はcost-benefitからテスト対象外として許容
- Anthropic AbortSignal伝播 (`event.req.signal` → `messages.create(params, { signal })`) は実装 + unit test通過。本番Cloudflare Workersでの `enable_request_signal` flagの実動作は 公開URL確認 で検証する
- Cross-browser (Firefox / WebKit) は現時点ではChromiumのみで通過。Firefox / WebKitはブラウザ導入済みの環境で別途確認する
