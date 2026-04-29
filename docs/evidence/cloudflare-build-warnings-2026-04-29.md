# Cloudflare Build Warning Notes - 2026-04-29

`nuxt build` / `wrangler deploy --dry-run` / `wrangler deploy` で見えるwarningを、隠さず運用メモとして整理する。

## Scope

- Project: `nuxt-ai-blog`
- Deployment mode: Cloudflare Workers (`nitro.preset = cloudflare_module`)
- Live AI call: not performed
- Result: warnings documented; build and deploy still pass

## Current Configuration

| Area | Current setting |
|---|---|
| Nitro deploy mode | `cloudflare_module` |
| Wrangler entrypoint | `worker/index.mjs` |
| D1 binding | `DB` / `nuxt-ai-blog-content` |
| Durable Objects | `SUMMARY_QUOTA`, `SUMMARY_CACHE` |
| Durable Object migration | `new_sqlite_classes`: `GlobalSummaryQuotaDO`, `SummaryCacheDO` |

## Warning Matrix

| Warning | What it means here | Current impact | Next action |
|---|---|---|---|
| Nuxt Content switches to D1 binding `DB` for Cloudflare deployment | This project deploys to Workers and has a `DB` D1 binding in `wrangler.jsonc`. Nuxt Content storage is separate from AI summary quota/cache. | Build/deploy pass. Content pages load in production smoke. | Keep Workers D1 configuration explicit. If Pages deployment is introduced later, document that separately. |
| Vue language plugin export warning | `nuxt typecheck` reports `vue-router/volar/sfc-route-blocks` export warning. | Typecheck exits 0. No emitted type error. | Track after Vue / vue-router / Nuxt updates. |
| Vite module-preload / Tailwind sourcemap warning | Sourcemap quality warning during generated build output (`nuxt:module-preload-polyfill`, `@tailwindcss/vite`). | Build/deploy pass. No runtime failure observed in production smoke. | Treat as build tooling noise unless stack traces or source-map debugging become a release requirement. |
| Nitro virtual storage external dependency warning | Generated Nitro output treats `@nuxt/nitro-server/dist/runtime/utils/cache-driver.js` as external dependency. | Build exits 0. Existing production smoke passes. | Track after Nuxt/Nitro updates; do not hide the warning in evidence. |
| Cloudflare unenv bare import warning | Generated Nitro output includes imports that Cloudflare/unenv warns about. | `wrangler deploy --dry-run` and deploy pass. | Track after Nuxt/Nitro updates; do not hide the warning in evidence. |
| Duplicate `euro` key warning from generated output | Generated dependency output warning, not authored application logic. | Build/deploy pass. | Track after dependency updates. |

## Boundary Between D1 and Durable Objects

Nuxt Content storage uses D1 through the `DB` binding for this Workers deployment.

AI summary control is separate:

- `SummaryCacheDO`: summary cache keyed by `summary:v1:<model>:<slug>:<articleHash>`
- `GlobalSummaryQuotaDO`: fixed-name daily live-generation quota source of truth

D1 is not used for AI summary quota accounting. Durable Objects are not used as the Nuxt Content article database.

## References

- Nuxt Content deployment docs for Cloudflare Workers D1 adapter / `bindingName`: https://content.nuxt.com/deploy/cloudflare
- Cloudflare Workers D1 binding configuration: https://developers.cloudflare.com/workers/wrangler/configuration/#d1-databases
- Cloudflare Durable Objects storage overview: https://developers.cloudflare.com/durable-objects/
