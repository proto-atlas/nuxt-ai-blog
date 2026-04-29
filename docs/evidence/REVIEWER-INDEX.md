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
| Summary endpoint abuse controls are documented | [summary-abuse-protection-2026-04-29.md](./summary-abuse-protection-2026-04-29.md) | See file | Durable Objects design verified locally; production live smoke still manual |
| Summary Durable Objects implementation was locally verified | [summary-durable-objects-2026-04-29.md](./summary-durable-objects-2026-04-29.md) | See file | unit/typecheck/build/wrangler dry-run pass; production smoke pending |
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
| Production cached:true evidence must be regenerated | High | `SummaryCacheDO` is implemented and `wrangler deploy --dry-run` recognizes `SUMMARY_CACHE`; prior production smoke predates the DO cache. | Rerun manual-live-summary-smoke after deploy with a known-cold key, then record second request `cached:true`. |
| Global daily quota depends on DO binding being present | High | Production route fails loud with `server_misconfigured` if `SUMMARY_QUOTA` / `SUMMARY_CACHE` is missing. | Confirm bindings after deploy and record manual-live-summary-smoke quota behavior. |
| Per-IP short-window guard is still in-memory | Medium | Used only as a short-window guard; global daily live-generation quota is centralized in `GlobalSummaryQuotaDO`. | Add Cloudflare Rate Limiting binding or Turnstile for production SaaS abuse protection. |
| Nuxt Content / D1 warning remains | Medium | Build succeeds; warning is documented as an operational constraint. | Clarify the actual Workers/Pages deployment mode and configure D1 according to that mode. |
| Live summary eval is limited | Medium | Static smoke, mock E2E, and manual live smoke exist. | Add a fixture-based summary eval for faithfulness, length, and forbidden-output checks. |

## Not Performed

- No credential guessing.
- No load test.
- No uncontrolled live AI calls.
- No production 429 burst test unless a safe low threshold is configured.
- No claim that production `cached:true` has been re-smoke-tested after the Durable Objects deployment until the manual-live-summary-smoke is rerun.
