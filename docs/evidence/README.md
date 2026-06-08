# 検証記録の目次

`docs/evidence/` はnuxt-ai-blogの品質確認、設計判断、評価根拠の証跡を集約するディレクトリです。各ファイルは特定の検証 (a11y / 公開URL確認 / Lighthouse等) に対応する独立したevidenceとして管理します。

## 保存済み検証記録

| ファイル | 用途 | 作成日 |
|---|---|---|
| [`a11y-target-size-2026-04-27.md`](a11y-target-size-2026-04-27.md) | WCAG 2.2 Target Size 44×44 の主要操作検査結果 (Chromium / 主要画面 3 ケース 通過) | 2026-04-27 |
| [`production-check-2026-04-28.md`](production-check-2026-04-28.md) | 公開URLに対する疎通確認結果 (`/`、記事ページ、SEO静的ファイル、OG画像、`/api/summary` invalid payload) | 2026-04-28 |
| [`dependency-audit-2026-04-28.md`](dependency-audit-2026-04-28.md) | `npm audit --audit-level=high --json` の結果 (0 vulnerabilities) | 2026-04-28 |
| [`lighthouse-2026-04-28.md`](lighthouse-2026-04-28.md) | 公開URLのLighthouse 13.0.1 計測結果 (desktop 99 / 100 / 100 / 100、mobile 93 / 100 / 100 / 100) | 2026-04-28 |
| [`release-baseline-2026-04-29.md`](release-baseline-2026-04-29.md) | リリース時検証の特定時点記録 (公開URL、Actions、typecheck、lint、coverage、E2E、build、audit) | 2026-04-29 |
| [`summary-abuse-protection-2026-04-29.md`](summary-abuse-protection-2026-04-29.md) | `/api/summary` のアクセスキー、rate limit、daily limit、cache、abortの濫用対策確認 | 2026-04-29 |
| [`summary-durable-objects-2026-04-29.md`](summary-durable-objects-2026-04-29.md) | `/api/summary` のDurable Objects summary cache / global daily quota実装確認 | 2026-04-29 |
| [`summary-quota-diagnostics-2026-04-29.md`](summary-quota-diagnostics-2026-04-29.md) | quota内部状態を公開APIへ出さずにunit test / DO storage相当で確認した記録 | 2026-04-29 |
| [`summary-quality-eval-2026-04-29.md`](summary-quality-eval-2026-04-29.md) | 実APIを追加実行しないfixture-based summary品質eval | 2026-04-29 |
| [`cloudflare-build-warnings-2026-04-29.md`](cloudflare-build-warnings-2026-04-29.md) | Nuxt Content / D1 / sourcemap / unenv warningの影響範囲と扱い | 2026-04-29 |
| [`production-check-2026-04-29.md`](production-check-2026-04-29.md) | deploy後の公開URL、未認証拒否、本番実API要約疎通確認結果 | 2026-04-29 |

## 今後追加する検証記録

| ファイル例 | 用途 |
|---|---|
| `build-size-YYYY-MM-DD.md` | Nitro build出力のbundle size (server / client / sqlite-wasm)、D1 切替後のwasm削減状況 |

## 運用ルール

- 各evidenceは作成日付を含むファイル名 (`YYYY-MM-DD`) で管理する
- 同種類のevidenceを再計測した場合は新規ファイルを追加し、古いファイルは履歴として残す
- evidenceの中身が実測と乖離した場合は、新規ファイルを追加し、古いファイルは履歴として残す
- README.mdの `## 品質確認` テーブルから直接リンクするevidenceは、確認時点の代表snapshotとして扱う
