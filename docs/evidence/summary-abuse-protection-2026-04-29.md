# Summary Abuse Protection - 2026-04-29

`/api/summary` の公開AI生成コストと濫用リスクに対する保護を確認した記録です。

## 実装済みの防御

| 層 | 実装 | 目的 |
|---|---|---|
| アクセスキー | `X-Summary-Access-Key` と server-only `NUXT_SUMMARY_ACCESS_KEY` を照合 | 公開ページは読めるまま、live AI生成だけ利用条件を設ける |
| per-IP rate limit | `checkRateLimit(ip)` / 10 req / 60s | 同一IPの連投抑制 |
| global daily limit | `checkDailyLimit()` / 200 req / UTC日 | IPローテーション時の全体消費を抑制 |
| cache | `summary:<slug>` / TTL 1h | 同一記事の再生成を抑制 |
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
- `composables/useAiSummary.test.ts`
  - UI側は raw error を出さず、`access_required` を日本語ラベル化
- `e2e/ai-summary.spec.ts`
  - アクセスキー入力後の成功 / 429 / 500 表示を mock で確認

## 残存制約

- access key は面接・デモ用の利用条件であり、ユーザーごとの権限管理ではない。
- per-IP rate limit / daily limit / cache は in-memory 実装のため、Cloudflare Workers の複数 isolate ではカウンタが独立する。
- 本格SaaS化する場合は Cloudflare Rate Limiting binding、Durable Objects、Turnstile、または Cloudflare Access の前段導入を検討する。
- 本番 live smoke は deploy 後に別 evidence として記録する。

