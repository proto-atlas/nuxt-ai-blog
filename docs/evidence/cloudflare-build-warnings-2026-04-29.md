# Cloudflare build警告の記録 - 2026-04-29

`nuxt build` / `wrangler deploy --dry-run` / `wrangler deploy` で見えるwarningを、隠さず運用メモとして整理する。

## 対象

- Project: `nuxt-ai-blog`
- デプロイ方式: Cloudflare Workers (`nitro.preset = cloudflare_module`)
- 確認日: 2026-04-29
- 最終更新: 2026-06-11
- 実API呼び出し: 実施なし
- 結果: 現在残っているwarningと解消済みwarningを分けて記録。buildとdeployはpass

## 現在の設定

| 領域 | 現在の設定 |
|---|---|
| Nitro deploy mode | `cloudflare_module` |
| Wrangler entrypoint | `worker/index.mjs` |
| D1 binding | `DB` / `nuxt-ai-blog-content` |
| Durable Objects | `SUMMARY_QUOTA`, `SUMMARY_CACHE` |
| Durable Object migration | `new_sqlite_classes`: `GlobalSummaryQuotaDO`, `SummaryCacheDO` |

## warning一覧

| warning | このプロジェクトでの意味 | 現在の影響 | 次回確認 | 解消条件 |
|---|---|---|---|---|
| Nuxt ContentがCloudflareデプロイ向けにD1 binding `DB` へ切り替える | このプロジェクトはWorkersへデプロイし、`wrangler.jsonc` に `DB` D1 bindingを持つ。Nuxt Contentの保存先はAI要約のquota/cacheとは別。 | build/deploy通過。公開URL確認で記事ページを表示できる。 | Nuxt Contentまたはデプロイ方式を変えた後に再確認する。 | Workers+D1を採用する限り記録として残す。本番の記事表示が壊れる、またはPages/static outputへ変える場合だけ分類を見直す。 |
| Vite module-preload / Tailwind sourcemap warning | 生成されたbuild outputでsourcemap品質のwarningが出る（`nuxt:module-preload-polyfill`, `@tailwindcss/vite`）。 | build/deploy通過。公開URL確認でruntime failureは観測していない。 | stack trace debuggingやsourcemap品質がrelease要件になった時点で再確認する。 | debugging、sourcemap upload、本番deployを妨げない限りtooling noiseとして扱う。 |
| Nitro virtual storage external dependency warning | 生成されたNitro outputが `@nuxt/nitro-server/dist/runtime/utils/cache-driver.js` をexternal dependencyとして扱う。 | build exit 0。既存の公開URL確認は通過。 | Nuxt/Nitro更新後に再確認する。 | 生成されたNitro outputがwarningを出さず、公開URL確認もpassなら削除する。 |
| Cloudflare unenv bare import warning | 生成されたNitro outputにCloudflare/unenvが警告するimportが含まれる。 | `wrangler deploy --dry-run` とdeployは通過。 | Nuxt/Nitro/Cloudflare runtime更新後に再確認する。 | dry-run deployと本番デプロイがwarningなしで通過した場合だけ削除する。 |
| 生成outputのduplicate `euro` key warning | 依存パッケージ由来の生成output warningで、アプリ側の手書きロジックではない。 | build/deploy通過。 | 依存更新後に再確認する。 | 生成outputがduplicate-key warningを出さなくなった場合だけ削除する。 |

## 解消済みのwarning

| warning | 対応 | 確認結果 |
|---|---|---|
| Vue language plugin export warning | root dependencyの `vue-router` をNuxtが利用する5.1.0系に揃えた。 | 2026-06-11に `npm run typecheck` を再実行し、`vue-router/volar/sfc-route-blocks` のexport warningが出ないことを確認した。 |

## 追跡方針

- これらのwarningはCI出力で隠さない。
- build/deployがexit 0でも、それだけでwarning解消とは扱わない。
- 上の解消条件を満たした場合だけ、この記録からwarningを外す。
- runtime behavior、公開URL確認、typecheck、deployに影響し始めたwarningは、情報メモではなくrelease blockerとして扱う。

## D1とDurable Objectsの境界

このWorkers deploymentでは、Nuxt Content storageが `DB` binding経由でD1を使います。

AI要約の制御は別です:

- `SummaryCacheDO`: summary cache keyed by `summary:v1:<model>:<slug>:<articleHash>`
- `GlobalSummaryQuotaDO`: fixed-name daily live-generation quota source of truth

D1はAI要約のquota集計には使いません。Durable ObjectsはNuxt Contentの記事データベースとしては使いません。

## CSPとNuxt Content WebAssembly

Nuxt Contentはclient-side navigation中にsqlite-wasmを初期化する場合があります。CSPでは一般的なJavaScript evalを無効のままにし、WebAssembly compilationだけを明示的に許可しています:

- `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'`
- `unsafe-eval` は許可しない。

この境界は、一般的なJavaScript evalを許可するより狭くしています。今後このprojectでNuxt Contentのclient-side sqlite-wasm経路が不要になった場合は、`wasm-unsafe-eval` を外して記事navigation確認を再実行します。

## 参照

- Nuxt Content deployment docs for Cloudflare Workers D1 adapter / `bindingName`: https://content.nuxt.com/deploy/cloudflare
- Cloudflare Workers D1 binding configuration: https://developers.cloudflare.com/workers/wrangler/configuration/#d1-databases
- Cloudflare Durable Objects storage overview: https://developers.cloudflare.com/durable-objects/
- MDN CSP `script-src` reference for `wasm-unsafe-eval`: https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src
