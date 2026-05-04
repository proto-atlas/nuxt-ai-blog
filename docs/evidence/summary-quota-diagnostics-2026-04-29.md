# Summary Quota Diagnostics - 2026-04-29

`/api/summary` の quota 内部状態を公開APIへ露出しないまま確認するための診断証跡です。

## Scope

- Project: `nuxt-ai-blog`
- Check type: non-production quota diagnostics
- Live AI call: not performed
- Public API exposure: no quota internals exposed

## Why This Exists

本番 `/api/summary` response には `quotaRemaining`、`reserved`、`succeeded`、`failedAfterUpstreamCall` を含めない。理由は、公開APIへ運用内部状態を過剰に出さないため。

その代わり、Durable Object Storage相当のfake storageを使うunit testで、以下を確認する:

- quotaはlive AI API callを開始する権利としてreserveされる
- cache hitではquotaを消費しない設計である
- successとupstream call後failureはreserved countと別に記録できる
- quota上限到達時は `allowed:false` と `retryAfterSeconds` を返す

## Diagnostic Matrix

| Scenario | Evidence | Result |
|---|---|---|
| First reservation with limit 2 | `server/utils/summary-durable-objects.test.ts` | `allowed:true`, `remaining:1` |
| Second reservation with limit 2 | `server/utils/summary-durable-objects.test.ts` | `allowed:true`, `remaining:0` |
| Third reservation with limit 2 | `server/utils/summary-durable-objects.test.ts` | `allowed:false`, `remaining:0`, `retryAfterSeconds` returned |
| Mark succeeded after one reservation | `server/utils/summary-durable-objects.test.ts` | storage: `reserved:1`, `succeeded:1` |
| Mark failed after upstream call | `server/utils/summary-durable-objects.test.ts` | storage: `failedAfterUpstreamCall:1` |
| Same-key duplicate generation guard | `server/utils/summary-durable-objects.test.ts` / `server/utils/summary-control.test.ts` | pending marker prevents duplicate live generation path |
| Production binding missing | `server/api/summary.post.test.ts` | production fails with `server_misconfigured`, not memory fallback |

## Public API Boundary

`quotaRemaining` はpublic responseに出していない。第三者確認では、以下を組み合わせて読む:

- unit test: quota state transitions
- `summary-durable-objects-2026-04-29.md`: DO cache / quota implementation evidence
- `production-smoke-2026-04-29.md`: production `cached:true` smoke
- deploy log: `SUMMARY_QUOTA` / `SUMMARY_CACHE` bindings recognized

## Confirmed Commands

This evidence is confirmed by the targeted test command:

```bash
node node_modules/vitest/vitest.mjs run server/utils/summary-durable-objects.test.ts server/utils/summary-control.test.ts server/api/summary.post.test.ts server/utils/summary-quality.test.ts server/utils/summary-ai-client.test.ts
```

Full quality gates are recorded in release baseline and CI.

2026-04-29 targeted result:

- `server/utils/summary-durable-objects.test.ts`
- `server/utils/summary-control.test.ts`
- `server/api/summary.post.test.ts`
- `server/utils/summary-quality.test.ts`
- `server/utils/summary-ai-client.test.ts`
- Result: 5 files / 28 tests pass
