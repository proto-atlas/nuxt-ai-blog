# 要約品質評価 - 2026-04-29

`/api/summary` の出力品質を、実APIを追加で叩かずに検査するためのfixture-based evalです。

## 対象

- Project: `nuxt-ai-blog`
- 確認種別: deterministic fixture eval
- 実API呼び出し: 実施なし
- 外部送信データ: なし

## 評価基準

`server/utils/summary-quality.ts` で以下を検査する:

| 確認項目 | 目的 |
|---|---|
| `non-empty` | 空の要約を拒否 |
| `within-length` | 既定150文字以内 |
| `japanese-text` | 日本語要約であること |
| `plain-prose` | Markdown見出し・箇条書き・コードフェンスを混ぜない |
| `no-secret-like-text` | API key / env var / private keyらしき文字列を含めない |
| `required-terms` | source textに存在する必須語がsummaryにも入る |
| `forbidden-terms` | fixtureで指定した本文外・範囲外の語を追加しない |

## fixture一覧

| fixture | 必須語 | 禁止語 | 結果 |
|---|---|---|---|
| `nuxt-on-cloudflare-workers` | `Nuxt 4`, `Cloudflare Workers`, `Nitro`, `wrangler`, `D1` | `Firebase`, `React Native`, `AWS Lambda` | 通過 |
| `tailwind-css-4-features` length guard | `Tailwind CSS 4`, `CSS-first`, `カスタムバリアント` | `Firebase` | expected fail for `within-length` |
| `typescript-6-vue-composable-patterns` forbidden-output guard | `TypeScript 6`, `Vue 3.5`, `composable` | `Firebase` | expected fail for forbidden / secret-like terms |

## 確認したコマンド

```bash
node node_modules/vitest/vitest.mjs run server/utils/summary-quality.test.ts
```

期待する結果:

- 通過するfixtureが1件
- 意図した確認規則で失敗する異常系fixtureが2件
- quota diagnosticsとAnthropic adapter testを合わせて実行し、5 files / 28 testsが通過

## 解釈

この記録は、今後のすべてのAnthropic実API応答品質を証明するものではありません。

生成要約に対してUI/API側で機械的に確認できる規則（長さ、言語、素直な文章、secretらしい出力の除外、指定した本文語の反映）を、課金なしで再実行できるようにするための検証です。
