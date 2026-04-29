# Reviewer Evidence Index

## Scope

- Project: `nuxt-ai-blog`
- Public URL: https://nuxt-ai-blog.atlas-lab.workers.dev
- Source: https://github.com/proto-atlas/nuxt-ai-blog
- Evidence files are point-in-time logs, not a claim of latest HEAD.
- For third-party review, the reviewed commit and CI run should be specified externally.

## Evidence Map

| Claim | Evidence | Generated commit | Result |
|---|---|---:|---|
| Typecheck, lint, coverage, E2E, build, publish scan, audit, public URL, and Actions were checked | [release-baseline-2026-04-29.md](./release-baseline-2026-04-29.md) | See file | pass snapshot |
| Public URL and protected summary routes were smoke-tested | [production-smoke-2026-04-29.md](./production-smoke-2026-04-29.md) | See file | pass snapshot with noted constraints |
| Summary endpoint abuse controls are documented | [summary-abuse-protection-2026-04-29.md](./summary-abuse-protection-2026-04-29.md) | See file | Durable Objects design verified; production live smoke recorded |
| Summary Durable Objects implementation was verified | [summary-durable-objects-2026-04-29.md](./summary-durable-objects-2026-04-29.md) | See file | unit/typecheck/build/wrangler dry-run/deploy pass; production `cached:true` smoke pass |
| Summary quota internals are tested without public API exposure | [summary-quota-diagnostics-2026-04-29.md](./summary-quota-diagnostics-2026-04-29.md) | See file | reserve/succeeded/failed-after-upstream behavior documented |
| Summary quality has a repeatable non-billable eval | [summary-quality-eval-2026-04-29.md](./summary-quality-eval-2026-04-29.md) | See file | fixture-based checks documented |
| Cloudflare build/deploy warnings are documented | [cloudflare-build-warnings-2026-04-29.md](./cloudflare-build-warnings-2026-04-29.md) | See file | D1 / sourcemap / unenv warnings scoped |
| Lighthouse desktop and mobile scores were recorded | [lighthouse-2026-04-28.md](./lighthouse-2026-04-28.md) | See file | desktop 99/100/100/100, mobile 93/100/100/100 |
| Target-size checks were recorded | [a11y-target-size-2026-04-27.md](./a11y-target-size-2026-04-27.md) | See file | pass snapshot |
| High and critical dependency advisories are blocked | [dependency-audit-2026-04-28.md](./dependency-audit-2026-04-28.md) | See file | 0 vulnerabilities |

## Key-Gated / Keyless

| Area | Key required | Notes |
|---|---:|---|
| Blog index, search, tags, article detail | No | Public UI. |
| AI-summary preview | No | Fixed preview. No external AI API call. |
| Screenshot evidence | No | `/api/summary` is mocked. |
| `/api/summary` live generation | Yes | Access-key gated and rate-limited. |
| Live summary smoke | Manual | Small fixture only; not normal CI. |

## Known Constraints

| Constraint | Severity | Current handling | Next production-grade option |
|---|---|---|---|
| Production `cached:true` evidence is limited to one manual fixture | Medium | `SummaryCacheDO` production smoke confirmed first request `cached:false`, second request `cached:true` for `nuxt-on-cloudflare-workers`. | Add more manual fixtures only if cost/rate-limit budget allows. |
| Global daily quota depends on DO binding being present | Medium | Production route fails loud with `server_misconfigured` if `SUMMARY_QUOTA` / `SUMMARY_CACHE` is missing; deploy log confirmed both bindings. | Keep binding verification in deploy evidence. |
| Per-IP short-window guard is still in-memory | Medium | Used only as a short-window guard; global daily live-generation quota is centralized in `GlobalSummaryQuotaDO`. | Add Cloudflare Rate Limiting binding or Turnstile for production SaaS abuse protection. |
| Nuxt Content / D1 / sourcemap / unenv warnings remain | Medium | Build succeeds; warning scope is documented in [cloudflare-build-warnings-2026-04-29.md](./cloudflare-build-warnings-2026-04-29.md). | Track after Nuxt/Nitro/Cloudflare updates. |
| Live summary eval is limited | Medium | Static smoke, mock E2E, manual live smoke, and non-billable fixture quality eval exist. | Add live quality eval only with a fixed small fixture and cost warning. |

## Not Performed

- No credential guessing.
- No load test.
- No uncontrolled live AI calls.
- No production 429 burst test unless a safe low threshold is configured.
- No public API exposure of quota internals such as reserved/succeeded/failed-after-upstream counts; diagnostics are kept in tests and evidence.
