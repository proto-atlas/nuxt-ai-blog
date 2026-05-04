# Reviewer Guide

## 30秒で見る

- Public demo: https://nuxt-ai-blog.atlas-lab.workers.dev
- Public UX: article list, search, tag filtering, article detail pages, and dark mode are visible without an access key.
- Source: https://github.com/proto-atlas/nuxt-ai-blog

## 5分で見る

- Read the README feature list and known constraints.
- Check the evidence map: [docs/evidence/REVIEWER-INDEX.md](./evidence/REVIEWER-INDEX.md)
- Review the summary API boundary: `server/api/summary.post.ts`
- Review summary abuse protection: [evidence/summary-abuse-protection-2026-04-29.md](./evidence/summary-abuse-protection-2026-04-29.md)
- Review design tradeoffs: [DESIGN-DECISIONS.md](./DESIGN-DECISIONS.md)

## 技術的な見どころ

- Nuxt Content 3 の Markdown 記事を Cloudflare D1-backed content storage としてSSR表示している。
- `/api/summary` は access key、per-IP guard、Durable Objects cache、global daily quota を分けて扱う。
- SummaryCacheDO は同一記事・同一model・同一本文hashの再生成を抑え、live AI costを下げる。
- server route 本体は `executeSummaryHandler` と依存注入でテスト可能にし、Anthropic SDK境界を adapter に閉じ込めている。
- 公開ブログUIはキーなし、live AI要約だけキー保護という公開範囲を分けている。

## 公開範囲とキー保護範囲

| Area | Access key | Notes |
|---|---:|---|
| Article list, search, tags, and article pages | No | Public blog UI. |
| Screenshots | No | Generated with mocked `/api/summary`, so no external AI API cost is incurred. |
| Live AI summary | Yes | Access-key gated to reduce abuse and unexpected API cost. |
| Live AI summary smoke | Manual | Small fixture only; not normal CI. |

## Evidence 方針

Evidence files are point-in-time logs, not a claim of latest HEAD. For third-party review, the reviewed commit and CI run should be specified externally.

Evidence should not include secrets, access keys, cookies, API keys, local filesystem paths, self-scoring context, or internal implementation-plan notes.

## デフォルトでは実施しないこと

- No credential guessing.
- No load test.
- No uncontrolled live AI calls.
- No production 429 burst test unless the threshold can be reached safely with a small number of requests.
- No claim that production `cached:true` has been re-smoke-tested until manual-live-summary-smoke is rerun after deploy.
- No claim that the remaining in-memory per-IP guard is exact global accounting.
