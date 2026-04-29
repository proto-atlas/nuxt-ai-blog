# Summary Durable Objects Verification - 2026-04-29

`/api/summary` の summary cache と global daily quota を Durable Objects に移行した実装確認メモです。

このファイルは deploy 前の実装検証ログです。第三者確認では、このファイルを含むcommit、CI run、deploy log、manual-live-summary-smoke を外部入力として対応づけてください。

## 実装方針

| 項目 | 方針 |
|---|---|
| Summary cache | `SummaryCacheDO` が `summary:v1:<model>:<slug>:<articleHash>` を key に保存 |
| Cache TTL | 1 hour |
| Article update handling | `sourceText` の SHA-256 hash を key に含め、記事本文変更で cache miss |
| Model update handling | model 名を key に含め、model 変更で cache miss |
| Global daily quota | 固定名 `GlobalSummaryQuotaDO` に live AI generation reservation を集約 |
| Quota sharding | slug / IP / articleHash / cache key ごとに分散させない |
| Quota consumption | live AI API call を開始する権利として reserve。upstream call 開始後の失敗も cost exposure として別カウント |
| Duplicate generation guard | `SummaryCacheDO` の pending marker と route 側の cache再確認で同一keyの重複生成を抑制 |
| Production fallback | `SUMMARY_QUOTA` / `SUMMARY_CACHE` が欠けている production では memory fallback せず `server_misconfigured` |
| Dev/test fallback | local unit test と dev では in-memory fallback を許容 |

## 変更ファイル

- `server/utils/summary-control-types.ts`
- `server/utils/summary-durable-objects.ts`
- `server/utils/summary-control.ts`
- `server/utils/cloudflare-env.ts`
- `server/api/summary.post.ts`
- `worker/index.mjs`
- `wrangler.jsonc`

## 確認済み

| Check | Result |
|---|---|
| Targeted unit tests | `server/utils/summary-control.test.ts`, `server/utils/summary-durable-objects.test.ts`, `server/utils/cloudflare-env.test.ts`, `server/api/summary.post.test.ts` pass: 27 tests |
| Full unit tests | `vitest run --passWithNoTests --maxWorkers=1` pass: 18 files / 121 tests |
| Coverage | `vitest run --coverage --passWithNoTests --maxWorkers=1` pass: stmts 84.86 / branches 79.20 / funcs 90.00 / lines 86.49 |
| Typecheck | `nuxt typecheck` exit 0 |
| ESLint | `eslint .` exit 0 |
| Prettier | `prettier --check .` exit 0 |
| Build | `nuxt build` exit 0 |
| Wrangler dry-run | `wrangler deploy --dry-run` exit 0; `SUMMARY_QUOTA`, `SUMMARY_CACHE`, `DB`, `ASSETS` bindings recognized |

## 未確認

- Cloudflare production deploy after this Durable Objects change.
- Manual live summary smoke after deploy.
- Production `cached:true` for same slug / same articleHash / same model.
- Production quotaRemaining behavior.
- Production 429 burst test. This is intentionally not part of normal smoke unless a safe low threshold is configured.

## Warning Notes

`nuxt build` / `wrangler deploy --dry-run` still reports warnings that should be treated as operational notes, not hidden:

- Nuxt Content switches to D1 binding `DB` for Cloudflare deployment.
- Vite / Tailwind sourcemap warnings appear during build.
- Wrangler reports Cloudflare unenv bare import warnings and a duplicate `euro` key warning from generated Nitro output.

These warnings did not make the local build or dry-run fail, but production smoke should still be rerun after deploy.
