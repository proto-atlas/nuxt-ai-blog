# Cloudflare Build Warning Notes - 2026-04-29

`nuxt build` / `wrangler deploy --dry-run` / `wrangler deploy` で見えるwarningを、隠さず運用メモとして整理する。

## Scope

- Project: `nuxt-ai-blog`
- Deployment mode: Cloudflare Workers (`nitro.preset = cloudflare_module`)
- Tracking reviewed at: 2026-04-29
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

| Warning | What it means here | Current impact | Next check | Resolution condition |
|---|---|---|---|---|
| Nuxt Content switches to D1 binding `DB` for Cloudflare deployment | This project deploys to Workers and has a `DB` D1 binding in `wrangler.jsonc`. Nuxt Content storage is separate from AI summary quota/cache. | Build/deploy pass. Content pages load in production smoke. | Recheck after Nuxt Content or deployment-mode changes. | Keep as documented while Workers+D1 remains the chosen deployment mode. Reclassify only if production content loading fails or the deployment mode changes to Pages/static output. |
| Vue language plugin export warning | `nuxt typecheck` reports `vue-router/volar/sfc-route-blocks` export warning. | Typecheck exits 0. No emitted type error. | Recheck after Vue / vue-router / Nuxt updates. | Remove from warning list only when the upstream warning disappears while typecheck remains pass. |
| Vite module-preload / Tailwind sourcemap warning | Sourcemap quality warning during generated build output (`nuxt:module-preload-polyfill`, `@tailwindcss/vite`). | Build/deploy pass. No runtime failure observed in production smoke. | Recheck when stack-trace debugging or source-map quality becomes a release requirement. | Treat as tooling noise unless it blocks debugging, sourcemap upload, or production deploy. |
| Nitro virtual storage external dependency warning | Generated Nitro output treats `@nuxt/nitro-server/dist/runtime/utils/cache-driver.js` as external dependency. | Build exits 0. Existing production smoke passes. | Recheck after Nuxt/Nitro updates. | Remove only after the generated Nitro output no longer emits the warning and production smoke still passes. |
| Cloudflare unenv bare import warning | Generated Nitro output includes imports that Cloudflare/unenv warns about. | `wrangler deploy --dry-run` and deploy pass. | Recheck after Nuxt/Nitro/Cloudflare runtime updates. | Remove only after dry-run deploy and production deploy pass without the warning. |
| Duplicate `euro` key warning from generated output | Generated dependency output warning, not authored application logic. | Build/deploy pass. | Recheck after dependency updates. | Remove only after generated output no longer emits the duplicate-key warning. |

## Tracking Policy

- These warnings are not hidden or suppressed in CI output.
- A warning is not treated as resolved just because build/deploy exits 0.
- A warning can be removed from this evidence only when the matching resolution condition above is met.
- If a warning starts affecting runtime behavior, production smoke, typecheck, or deploy, it becomes a release blocker instead of an informational note.

## Boundary Between D1 and Durable Objects

Nuxt Content storage uses D1 through the `DB` binding for this Workers deployment.

AI summary control is separate:

- `SummaryCacheDO`: summary cache keyed by `summary:v1:<model>:<slug>:<articleHash>`
- `GlobalSummaryQuotaDO`: fixed-name daily live-generation quota source of truth

D1 is not used for AI summary quota accounting. Durable Objects are not used as the Nuxt Content article database.

## CSP and Nuxt Content WebAssembly

Nuxt Content can initialize sqlite-wasm during client-side navigation. The CSP keeps general JavaScript eval disabled, but allows WebAssembly compilation explicitly:

- `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'`
- `unsafe-eval` is not allowed.

This boundary is intentionally narrower than enabling general JavaScript eval. If Nuxt Content later removes the client-side sqlite-wasm path for this project, remove `wasm-unsafe-eval` and rerun the article navigation smoke.

## References

- Nuxt Content deployment docs for Cloudflare Workers D1 adapter / `bindingName`: https://content.nuxt.com/deploy/cloudflare
- Cloudflare Workers D1 binding configuration: https://developers.cloudflare.com/workers/wrangler/configuration/#d1-databases
- Cloudflare Durable Objects storage overview: https://developers.cloudflare.com/durable-objects/
- MDN CSP `script-src` reference for `wasm-unsafe-eval`: https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src
