# 要約API濫用対策 - 2026-04-29

`/api/summary` の公開AI生成コストと濫用リスクに対する保護を確認した記録です。

## 実装済みの防御

| 層 | 実装 | 目的 |
|---|---|---|
| アクセスキー | `X-Summary-Access-Key` とserver-only `NUXT_SUMMARY_ACCESS_KEY` を照合 | 公開ページは読めるまま、実API生成だけ利用条件を設ける |
| IP単位の短期制限 | `checkRateLimit(ip)` / 10 req / 60s | 同一IPの連投抑制 |
| 日次全体上限 | 固定名 `GlobalSummaryQuotaDO` / 200 実API生成のreservations / UTC日 | IPローテーション時の全体消費を抑制。slug / IP / articleHash / cache keyでは分散しない |
| summary cache | `SummaryCacheDO` / `summary:v1:<model>:<slug>:<articleHash>` / TTL 1h | 同一記事・同一modelの再生成を抑制。記事更新やmodel変更時はcache miss |
| duplicate generation guard | `SummaryCacheDO` のpending marker + route側の再確認 | 同一cache keyの同時リクエストで複数の実API生成が走ることを抑制 |
| SDK retry抑制 | `maxRetries: 0` | 429 / 5xx時の自動再試行による多重課金を避ける |
| timeout | `timeout: 30_000` | 長時間接続を避ける |
| abort | `enable_request_signal` + SDK `signal` | クライアント離脱時に外部APIリクエストを中断する |

## 確認済みテスト

- `server/utils/summary-access.test.ts`
  - 正しいキーなら許可
  - 未指定 / 長さ違いのキーは `access_required`
  - productionで設定キーが空なら `server_misconfigured`
  - test環境では設定キーなしでも既存ユニットテストを実行可能
- `server/api/summary.post.test.ts`
  - `summaryAccessKey` 設定時にヘッダが無ければ 401 `access_required`
  - 正しいヘッダならAnthropic SDK呼び出しへ進む
  - productionで `SUMMARY_QUOTA` / `SUMMARY_CACHE` が無い場合はmemory fallbackせず `server_misconfigured`
- `server/utils/summary-control.test.ts`
  - slug / model / sourceTextからarticle hash入りcache keyを生成
  - Cloudflare bindingsが揃うとdurable controlを返す
  - binding欠落時はdev / test用memory fallbackを返す
  - memory fallbackでもpending / store / cache hitの基本挙動を確認
- `server/utils/summary-durable-objects.test.ts`
  - `SummaryCacheDO` のclaim / pending / store / hit / expiry
  - `GlobalSummaryQuotaDO` のreserve / quota exceeded / succeeded / failed-after-upstream-call記録
- `composables/useAiSummary.test.ts`
  - UI側はraw errorを出さず、`access_required` を日本語ラベル化
- `e2e/ai-summary.spec.ts`
  - アクセスキー入力後の成功 / 429 / 500 表示をmockで確認
- `wrangler deploy --dry-run`
  - `SUMMARY_QUOTA` / `SUMMARY_CACHE` / `DB` / `ASSETS` bindingが認識されることを確認

## 残存制約

- アクセスキーは確認用の利用条件であり、ユーザーごとの権限管理ではない。
- IP単位の短期制限はin-memory実装のため、Cloudflare Workersの複数isolateでは短期連投抑止として扱う。日次全体上限のsource of truthにはしない。
- `SummaryCacheDO` / `GlobalSummaryQuotaDO` は `wrangler deploy --dry-run` とdeploy後のmanual-live-summary-checkで確認済み。
- 本格SaaS化する場合はCloudflare Rate Limiting binding、Turnstile、Cloudflare Access、またはアカウント制の認証を追加検討する。
- 本番 `cached:true` は [`production-check-2026-04-29.md`](./production-check-2026-04-29.md) と [`summary-durable-objects-2026-04-29.md`](./summary-durable-objects-2026-04-29.md) に記録済み。
- quotaRemaining / reserve / succeeded / failed-after-upstream-callは公開APIレスポンスへ出さず、[`summary-quota-diagnostics-2026-04-29.md`](./summary-quota-diagnostics-2026-04-29.md) のunit-level diagnosticsで確認する。
