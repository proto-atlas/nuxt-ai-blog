# Evidence Index

`docs/evidence/` は nuxt-ai-blog の品質ゲート / 設計判断 / 評価根拠の証跡を集約するディレクトリです。各ファイルは特定の検証 (a11y / production smoke / Lighthouse 等) に対応する独立した evidence として管理します。

## 保存済み Evidence

| ファイル | 用途 | 作成日 |
|---|---|---|
| [`a11y-target-size-2026-04-27.md`](a11y-target-size-2026-04-27.md) | WCAG 2.2 Target Size 44×44 の主要操作検査結果 (Chromium / 主要画面 3 ケース pass) | 2026-04-27 |
| [`production-smoke-2026-04-28.md`](production-smoke-2026-04-28.md) | production URL に対する smoke 結果 (`/`、記事ページ、SEO 静的ファイル、OG 画像、`/api/summary` invalid payload) | 2026-04-28 |
| [`dependency-audit-2026-04-28.md`](dependency-audit-2026-04-28.md) | `npm audit --audit-level=high --json` の結果 (0 vulnerabilities) | 2026-04-28 |
| [`lighthouse-2026-04-28.md`](lighthouse-2026-04-28.md) | production URL の Lighthouse 13.0.1 計測結果 (desktop 99 / 100 / 100 / 100、mobile 93 / 100 / 100 / 100) | 2026-04-28 |
| [`release-baseline-2026-04-29.md`](release-baseline-2026-04-29.md) | 公開前再検証のpoint-in-time snapshot (公開 URL、Actions、typecheck、lint、coverage、E2E、build、publish scan、audit) | 2026-04-29 |
| [`summary-abuse-protection-2026-04-29.md`](summary-abuse-protection-2026-04-29.md) | `/api/summary` のアクセスキー、rate limit、daily limit、cache、abort の濫用対策確認 | 2026-04-29 |
| [`summary-durable-objects-2026-04-29.md`](summary-durable-objects-2026-04-29.md) | `/api/summary` の Durable Objects summary cache / global daily quota 実装確認 | 2026-04-29 |
| [`production-smoke-2026-04-29.md`](production-smoke-2026-04-29.md) | deploy後の公開URL、未認証拒否、本番live AI要約smoke結果 | 2026-04-29 |

## 今後追加する Evidence

| ファイル例 | 用途 |
|---|---|
| `summary-eval-live-YYYY-MM-DD.md` | `RUN_LIVE_ANTHROPIC=1` で実行する live Anthropic eval 結果、token usage / cost、出力品質基準との突き合わせ |
| `build-size-YYYY-MM-DD.md` | Nitro build 出力の bundle size (server / client / sqlite-wasm)、D1 切替後の wasm 削減状況 |

## 運用ルール

- 各 evidence は作成日付を含むファイル名 (`YYYY-MM-DD`) で管理する
- 同種類の evidence を再計測した場合は新規ファイルを追加し、古いファイルは履歴として残す
- evidence の中身が実測と乖離した場合は、新規ファイルを追加し、古いファイルは履歴として残す
- README.md の `## Quality Gate` テーブルから直接リンクする evidence は、確認時点の代表snapshotとして扱う
