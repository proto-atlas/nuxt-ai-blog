# Summary Durable Objects検証 - 2026-04-29

`/api/summary` のsummary cacheとglobal daily quotaをDurable Objectsに移行した実装確認メモです。

このファイルはdeploy前の実装検証ログです。確認時は、このファイルを含むcommit、CI run、deploy log、manual-live-summary-checkを外部入力として対応づけてください。

## 実装方針

| 項目 | 方針 |
|---|---|
| Summary cache | `SummaryCacheDO` が `summary:v1:<model>:<slug>:<articleHash>` をkeyに保存 |
| Cache TTL | 1 hour |
| Article update handling | `sourceText` のSHA-256 hashをkeyに含め、記事本文変更でcache miss |
| Model update handling | model名をkeyに含め、model変更でcache miss |
| 日次全体上限 | 固定名 `GlobalSummaryQuotaDO` に実API生成のreservationを集約 |
| Quota sharding | slug / IP / articleHash / cache keyごとに分散させない |
| 上限消費 | 実API呼び出しを開始する権利としてreserve。upstream call開始後の失敗もcost exposureとして別カウント |
| Duplicate generation guard | `SummaryCacheDO` のpending markerとroute側のcache再確認で同一keyの重複生成を抑制 |
| Production fallback | `SUMMARY_QUOTA` / `SUMMARY_CACHE` が欠けているproductionではmemory fallbackせず `server_misconfigured` |
| Dev/test fallback | local unit testとdevではin-memory fallbackを許容 |
| Durable Object RPC | Worker entrypointで `DurableObject` を継承したwrapper classをexportし、Cloudflare RPC要件を満たす |

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
| 対象ユニットテスト | `server/utils/summary-control.test.ts`, `server/utils/summary-durable-objects.test.ts`, `server/api/summary.post.test.ts`, `server/utils/summary-quality.test.ts`, `server/utils/summary-ai-client.test.ts` 通過: 28 tests |
| 全ユニットテスト | `vitest run --coverage --maxWorkers=1` 通過: 20 files / 126 tests |
| Coverage | `vitest run --coverage --maxWorkers=1` 通過: stmts 85.51 / branches 79.67 / funcs 90.74 / lines 87.10 |
| Typecheck | `nuxt typecheck` exit 0 |
| ESLint | `eslint .` exit 0 |
| Prettier | `prettier --check .` exit 0 |
| Build | `nuxt build` exit 0 |
| Wrangler dry-run | `wrangler deploy --dry-run` exit 0; `SUMMARY_QUOTA`, `SUMMARY_CACHE`, `DB`, `ASSETS` bindings recognized |
| 本番デプロイ | `wrangler deploy` exit 0。`SUMMARY_QUOTA`、`SUMMARY_CACHE`、`DB`、`ASSETS` bindingsを認識。Cloudflare Version IDはdeployごとに変わるため、この公開記録では固定値として扱いません。 |
| 手動の実API要約確認 | 同じslug / articleHash / modelで、1回目は `cached:false`、2回目は `cached:true`。summary length 100。`generatedAt` `2026-04-29T07:10:09.254Z` |

## 診断

- productionの `quotaRemaining` は、意図的に公開APIレスポンスへ出していません。
- Reserve / succeeded / failed-after-upstream-callの挙動は [`summary-quota-diagnostics-2026-04-29.md`](./summary-quota-diagnostics-2026-04-29.md) に記録。
- production 429 burst testは、安全な低しきい値を設定しない限り、通常の疎通確認には含めません。

## 本番で見つかった問題と修正

最初のDurable Objects deploy後、authorized `/api/summary` はHTTP 500 を返した。
Wrangler tailで確認した本番エラーは以下。

> 受信側のDurable Object classが`extends DurableObject`で宣言されていないため、RPCに対応していない、という内容のエラー。

原因:

- `wrangler.jsonc` のDurable Object class exportがRPC対象だったが、export classがCloudflareの `DurableObject` を継承していなかった。

修正:

- `worker/index.mjs` で `cloudflare:workers` から `DurableObject` をimport。
- `SummaryCacheDO` / `GlobalSummaryQuotaDO` の薄いwrapper classを `extends DurableObject` としてexport。
- 実装ロジックは `server/utils/summary-durable-objects.ts` に残し、wrapperから委譲。

修正後:

- `wrangler deploy --dry-run`: 通過
- `wrangler deploy`: 通過
- manual-live-summary-check: first request `cached:false`, second request `cached:true`

## warningの補足

`nuxt build` / `wrangler deploy --dry-run` では、隠さず運用メモとして扱うwarningがまだ出ます。

- Nuxt ContentはCloudflare deployment向けにD1 binding `DB` へ切り替わる。
- build中にVite / Tailwindのsourcemap warningが出る。
- Wrangler reports Cloudflare unenv bare import warnings and a duplicate `euro` key warning from generated Nitro output.

これらのwarningでlocal buildやdry-runが失敗したわけではありません。ただし、deploy後は公開URL確認を再実行します。
