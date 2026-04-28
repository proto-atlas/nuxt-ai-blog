# Evidence Index

`docs/evidence/` は nuxt-ai-blog の品質ゲート / 設計判断 / 評価根拠の証跡を集約するディレクトリです。各ファイルは特定の検証 (a11y / production smoke / Lighthouse 等) に対応する独立した evidence として管理します。

## 保存済み Evidence

| ファイル | 用途 | 作成日 |
|---|---|---|
| [`a11y-target-size-2026-04-27.md`](a11y-target-size-2026-04-27.md) | WCAG 2.2 Target Size 44×44 の主要操作検査結果 (Chromium / 主要画面 3 ケース pass) | 2026-04-27 |
| [`production-smoke-2026-04-28.md`](production-smoke-2026-04-28.md) | production URL に対する smoke 結果 (`/`、記事ページ、SEO 静的ファイル、OG 画像、`/api/summary` invalid payload) | 2026-04-28 |
| [`dependency-audit-2026-04-28.md`](dependency-audit-2026-04-28.md) | `npm audit --audit-level=high --json` の結果 (0 vulnerabilities) | 2026-04-28 |

## 今後追加する Evidence

| ファイル例 | 用途 |
|---|---|
| `lighthouse-YYYY-MM-DD.md` + JSON | production URL の Lighthouse 計測結果 (Performance / Accessibility / Best Practices / SEO、Core Web Vitals) |
| `summary-eval-live-YYYY-MM-DD.md` | `RUN_LIVE_ANTHROPIC=1` で実行する live Anthropic eval 結果、token usage / cost、出力品質基準との突き合わせ |
| `build-size-YYYY-MM-DD.md` | Nitro build 出力の bundle size (server / client / sqlite-wasm)、D1 切替後の wasm 削減状況 |

## 運用ルール

- 各 evidence は作成日付を含むファイル名 (`YYYY-MM-DD`) で管理する
- 同種類の evidence を再計測した場合は新規ファイルを追加し、古いファイルは履歴として残す
- evidence の中身が実測と乖離した場合は、新規ファイルを追加して古いファイルから最新版へリンクする
- README.md の `## Quality Gate` テーブルから直接リンクする evidence は最新版のみとする
