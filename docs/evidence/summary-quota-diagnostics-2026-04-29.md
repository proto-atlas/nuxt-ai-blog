# Summary quota診断 - 2026-04-29

`/api/summary` のquota内部状態を公開APIへ露出しないまま確認するための診断証跡です。

## 対象

- Project: `nuxt-ai-blog`
- 確認種別: productionではないquota診断
- 実API呼び出し: 実施なし
- 公開API露出: quota内部状態は公開しない

## この記録を置く理由

本番 `/api/summary` responseには `quotaRemaining`、`reserved`、`succeeded`、`failedAfterUpstreamCall` を含めない。理由は、公開APIへ運用内部状態を過剰に出さないため。

その代わり、Durable Object Storage相当のfake storageを使うunit testで、以下を確認する:

- quotaは実API呼び出しを開始する権利としてreserveされる
- cache hitではquotaを消費しない設計である
- 成功とupstream call後failureはreserved countと別に記録できる
- quota上限到達時は `allowed:false` と `retryAfterSeconds` を返す

## 診断一覧

| シナリオ | 根拠 | 結果 |
|---|---|---|
| First reservation with limit 2 | `server/utils/summary-durable-objects.test.ts` | `allowed:true`, `remaining:1` |
| Second reservation with limit 2 | `server/utils/summary-durable-objects.test.ts` | `allowed:true`, `remaining:0` |
| Third reservation with limit 2 | `server/utils/summary-durable-objects.test.ts` | `allowed:false`, `remaining:0`, `retryAfterSeconds` returned |
| Mark succeeded after one reservation | `server/utils/summary-durable-objects.test.ts` | storage: `reserved:1`, `succeeded:1` |
| Mark failed after upstream call | `server/utils/summary-durable-objects.test.ts` | storage: `failedAfterUpstreamCall:1` |
| Same-key duplicate generation guard | `server/utils/summary-durable-objects.test.ts` / `server/utils/summary-control.test.ts` | pending marker prevents duplicate live generation path |
| Production binding missing | `server/api/summary.post.test.ts` | production fails with `server_misconfigured`, not memory fallback |

## 公開APIの境界

`quotaRemaining` はpublic responseに出していない。確認時は、以下を組み合わせて読む:

- unit test: quota state transitionsの確認
- `summary-durable-objects-2026-04-29.md`: DO cache / quota implementation evidence
- `production-check-2026-04-29.md`: 本番 `cached:true` 疎通確認
- deploy log: `SUMMARY_QUOTA` / `SUMMARY_CACHE` bindings recognized

## 確認したコマンド

この記録は、以下の対象テストコマンドで確認しています。

```bash
node node_modules/vitest/vitest.mjs run server/utils/summary-durable-objects.test.ts server/utils/summary-control.test.ts server/api/summary.post.test.ts server/utils/summary-quality.test.ts server/utils/summary-ai-client.test.ts
```

品質確認の結果はrelease-baselineとCIに記録しています。

2026-04-29 targeted result:

- `server/utils/summary-durable-objects.test.ts`
- `server/utils/summary-control.test.ts`
- `server/api/summary.post.test.ts`
- `server/utils/summary-quality.test.ts`
- `server/utils/summary-ai-client.test.ts`
- 結果: 5 files / 28 tests通過
