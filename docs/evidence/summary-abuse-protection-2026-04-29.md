# Summary Abuse Protection - 2026-04-29

`/api/summary` の公開AI生成コストと濫用リスクに対する保護を確認した記録です。

## 実装済みの防御

| 層 | 実装 | 目的 |
|---|---|---|
| アクセスキー | `X-Summary-Access-Key` と server-only `NUXT_SUMMARY_ACCESS_KEY` を照合 | 公開ページは読めるまま、live AI生成だけ利用条件を設ける |
| per-IP rate limit | `checkRateLimit(ip)` / 10 req / 60s | 同一IPの連投抑制 |
| global daily quota | 固定名 `GlobalSummaryQuotaDO` / 200 live AI generation reservations / UTC日 | IPローテーション時の全体消費を抑制。slug / IP / articleHash / cache key では分散しない |
| summary cache | `SummaryCacheDO` / `summary:v1:<model>:<slug>:<articleHash>` / TTL 1h | 同一記事・同一modelの再生成を抑制。記事更新やmodel変更時はcache miss |
| duplicate generation guard | `SummaryCacheDO` の pending marker + route側の再確認 | 同一cache keyの同時リクエストで複数のlive AI生成が走ることを抑制 |
| SDK retry抑制 | `maxRetries: 0` | 429 / 5xx 時の自動再試行による多重課金を避ける |
| timeout | `timeout: 30_000` | 長時間接続を避ける |
| abort | `enable_request_signal` + SDK `signal` | クライアント離脱時に外部APIリクエストを中断する |

## 確認済みテスト

- `server/utils/summary-access.test.ts`
  - 正しいキーなら許可
  - 未指定 / 長さ違いのキーは `access_required`
  - production で設定キーが空なら `server_misconfigured`
  - test 環境では設定キーなしでも既存ユニットテストを実行可能
- `server/api/summary.post.test.ts`
  - `summaryAccessKey` 設定時にヘッダが無ければ 401 `access_required`
  - 正しいヘッダなら Anthropic SDK 呼び出しへ進む
  - production で `SUMMARY_QUOTA` / `SUMMARY_CACHE` が無い場合は memory fallback せず `server_misconfigured`
- `server/utils/summary-control.test.ts`
  - slug / model / sourceText から article hash 入りcache keyを生成
  - Cloudflare bindingsが揃うと durable control を返す
  - binding欠落時は dev / test 用memory fallbackを返す
  - memory fallbackでもpending / store / cache hitの基本挙動を確認
- `server/utils/summary-durable-objects.test.ts`
  - `SummaryCacheDO` の claim / pending / store / hit / expiry
  - `GlobalSummaryQuotaDO` の reserve / quota exceeded / succeeded / failed-after-upstream-call記録
- `composables/useAiSummary.test.ts`
  - UI側は raw error を出さず、`access_required` を日本語ラベル化
- `e2e/ai-summary.spec.ts`
  - アクセスキー入力後の成功 / 429 / 500 表示を mock で確認
- `wrangler deploy --dry-run`
  - `SUMMARY_QUOTA` / `SUMMARY_CACHE` / `DB` / `ASSETS` binding が認識されることを確認

## 残存制約

- access key は面接・デモ用の利用条件であり、ユーザーごとの権限管理ではない。
- per-IP rate limit は in-memory 実装のため、Cloudflare Workers の複数 isolate では短期連投抑止として扱う。global daily quota の source of truth にはしない。
- `SummaryCacheDO` / `GlobalSummaryQuotaDO` は `wrangler deploy --dry-run` とdeploy後の manual-live-summary-smoke で確認済み。
- 本格SaaS化する場合は Cloudflare Rate Limiting binding、Turnstile、Cloudflare Access、またはアカウント制の認証を追加検討する。
- 本番 `cached:true` は [`production-smoke-2026-04-29.md`](./production-smoke-2026-04-29.md) と [`summary-durable-objects-2026-04-29.md`](./summary-durable-objects-2026-04-29.md) に記録済み。
- quotaRemaining / reserve / succeeded / failed-after-upstream-call は公開APIレスポンスへ出さず、[`summary-quota-diagnostics-2026-04-29.md`](./summary-quota-diagnostics-2026-04-29.md) のunit-level diagnosticsで確認する。
