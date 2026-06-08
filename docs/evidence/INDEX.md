# 検証記録の対応表

## 対象

- Project: `nuxt-ai-blog`
- 公開URL: https://nuxt-ai-blog.atlas-lab.workers.dev
- Source: https://github.com/proto-atlas/nuxt-ai-blog
- 検証記録は特定時点の記録であり、最新HEADの状態を常に示すものではありません。
- 確認時は対象commitとCI runを指定してください。

## 対応表

| 確認内容 | 検証記録 | commit | 結果 |
|---|---|---:|---|
| typecheck、lint、coverage、E2E、build、publish scan、audit、公開URL、Actionsを確認した | [release-baseline-2026-04-29.md](./release-baseline-2026-04-29.md) | ファイル参照 | 成功記録 |
| 公開URLと保護された要約APIの疎通を確認した | [production-check-2026-04-29.md](./production-check-2026-04-29.md) | ファイル参照 | 制約つきの成功記録 |
| `/api/summary` の濫用対策を確認した | [summary-abuse-protection-2026-04-29.md](./summary-abuse-protection-2026-04-29.md) | ファイル参照 | Durable Objects設計とproduction実API確認を記録 |
| Durable Objectsの要約キャッシュ実装を確認した | [summary-durable-objects-2026-04-29.md](./summary-durable-objects-2026-04-29.md) | ファイル参照 | unit / typecheck / build / wrangler dry-run / deployが通過、本番 `cached:true` の疎通を確認 |
| quotaの内部状態を公開APIに出さずに確認した | [summary-quota-diagnostics-2026-04-29.md](./summary-quota-diagnostics-2026-04-29.md) | ファイル参照 | reserve / succeeded / failed-after-upstreamの挙動を記録 |
| 要約品質を課金なしで再確認できる形にした | [summary-quality-eval-2026-04-29.md](./summary-quality-eval-2026-04-29.md) | ファイル参照 | fixtureベースの確認内容を記録 |
| Cloudflare build / deploy warningの影響範囲を整理した | [cloudflare-build-warnings-2026-04-29.md](./cloudflare-build-warnings-2026-04-29.md) | ファイル参照 | D1 / sourcemap / unenv warningの扱いを記録 |
| Lighthouseのデスクトップ/モバイルのスコアを記録した | [lighthouse-2026-04-28.md](./lighthouse-2026-04-28.md) | ファイル参照 | desktop 99/100/100/100, mobile 93/100/100/100 |
| Target Size 44×44 の確認結果を記録した | [a11y-target-size-2026-04-27.md](./a11y-target-size-2026-04-27.md) | ファイル参照 | 成功記録 |
| high / criticalの依存脆弱性が残っていないことを確認した | [dependency-audit-2026-04-28.md](./dependency-audit-2026-04-28.md) | ファイル参照 | 0 vulnerabilities |

## 公開範囲とアクセスキー範囲

| 範囲 | キー必須 | 補足 |
|---|---:|---|
| 記事一覧、検索、タグ、記事詳細 | 不要 | 公開UI。 |
| スクリーンショット記録 | 不要 | `/api/summary` は応答置き換え。 |
| `/api/summary` 実生成 | 必要 | アクセスキーとrate limitで保護。 |
| 実要約の確認 | 手動確認 | 小さいfixtureのみ。通常CIには含めない。 |

## 壊れやすいケースと扱い

| ケース | 実装上の扱い | 見える結果 |
|---|---|---|
| アクセスキーなしで実要約を呼ぶ | `/api/summary` で拒否する | UIはアクセスキー入力を促す |
| 短時間に連続実行する | IP単位の短期制限と日次上限で抑える | 429と再試行目安を返す |
| 同じ記事を再要約する | `SummaryCacheDO` で同じ記事hashとmodelの結果を再利用する | `cached:true` の記録で確認できる |
| Anthropic側の失敗 | 内部messageをUIへ出さず、日本語のエラー文言に寄せる | 利用者には原因を絞ったエラーだけ表示する |
| Nuxt Content / D1まわりの警告 | warningの影響範囲を証跡に分けて記録する | build成功と未解消課題を分けて読める |

## 既知の制約

| 制約 | 重要度 | 現在の扱い | 運用時の追加案 |
|---|---|---|---|
| 本番 `cached:true` の記録は手動fixture 1件に限られる | Medium | `SummaryCacheDO` 公開URL確認で、`nuxt-on-cloudflare-workers` の1回目 `cached:false`、2回目 `cached:true` を確認した。 | cost / rate limitの予算に余裕がある場合だけ、手動fixtureを増やす。 |
| global daily quotaはDurable Objects bindingの存在に依存する | Medium | `SUMMARY_QUOTA` / `SUMMARY_CACHE` がないproduction routeは `server_misconfigured` で失敗する。deploy logで両bindingを確認済み。 | deploy記録でbinding確認を継続する。 |
| per-IP short-window guardはin-memoryのまま | Medium | 短時間の連投抑制に限定して使い、実API生成のglobal daily quotaは `GlobalSummaryQuotaDO` に集約している。 | より強い濫用対策が必要ならCloudflare Rate Limiting bindingやTurnstileを追加する。 |
| Nuxt Content / D1 / sourcemap / unenv warningが残る | Medium | buildは成功。warningの影響範囲、次回確認条件、解消条件は [cloudflare-build-warnings-2026-04-29.md](./cloudflare-build-warnings-2026-04-29.md) に記録。 | Nuxt / Nitro / Cloudflare更新後に再確認し、runtime、疎通確認、typecheck、deployに影響する場合は修正対象にする。 |
| 実要約評価は限定的 | Medium | 静的疎通確認、応答置き換えE2E、手動の実API確認、課金なしfixture品質評価を用意している。 | 実品質評価を追加する場合は、小さい固定fixtureとコスト注意を添える。 |

## 実施していないこと

- 認証情報の推測。
- 負荷試験。
- 制御なしの実API呼び出し。
- 安全な低い閾値を設定しない状態でのproduction 429 連打試験。
- reserved / succeeded / failed-after-upstream countsなどquota内部状態の公開API露出。診断情報はtestsとevidenceに残す。
