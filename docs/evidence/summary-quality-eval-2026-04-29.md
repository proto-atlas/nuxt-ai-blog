# Summary Quality Eval - 2026-04-29

`/api/summary` の出力品質を、live AI APIを追加で叩かずに検査するためのfixture-based evalです。

## Scope

- Project: `nuxt-ai-blog`
- Check type: deterministic fixture eval
- Live AI call: not performed
- External data sent: none

## Evaluation Criteria

`server/utils/summary-quality.ts` で以下を検査する:

| Check | Purpose |
|---|---|
| `non-empty` | 空の要約を拒否 |
| `within-length` | 既定150文字以内 |
| `japanese-text` | 日本語要約であること |
| `plain-prose` | Markdown見出し・箇条書き・コードフェンスを混ぜない |
| `no-secret-like-text` | API key / env var / private key らしき文字列を含めない |
| `required-terms` | source textに存在する必須語がsummaryにも入る |
| `forbidden-terms` | fixtureで指定した本文外・範囲外の語を追加しない |

## Fixtures

| Fixture | Required terms | Forbidden terms | Result |
|---|---|---|---|
| `nuxt-on-cloudflare-workers` | `Nuxt 4`, `Cloudflare Workers`, `Nitro`, `wrangler`, `D1` | `Firebase`, `React Native`, `AWS Lambda` | pass |
| `tailwind-css-4-features` length guard | `Tailwind CSS 4`, `CSS-first`, `カスタムバリアント` | `Firebase` | expected fail for `within-length` |
| `typescript-6-vue-composable-patterns` forbidden-output guard | `TypeScript 6`, `Vue 3.5`, `composable` | `Firebase` | expected fail for forbidden / secret-like terms |

## Confirmed Commands

```bash
node node_modules/vitest/vitest.mjs run server/utils/summary-quality.test.ts
```

Expected result:

- 1 passing fixture
- 2 negative fixtures that fail the intended guard checks
- 5 files / 28 targeted tests pass when run together with quota diagnostics and the Anthropic adapter test

## Interpretation

This does not prove the quality of every future live Anthropic response.

It gives the project a repeatable, non-billable quality gate for the rules the UI/API can enforce around generated summaries: length, language, plain prose, secret-like output, and configured source-term coverage.
