# 確認ガイド

## 30秒で見る

- 公開URL: https://nuxt-ai-blog.atlas-lab.workers.dev
- キーなしで確認できる範囲: 記事一覧、検索、タグ絞り込み、記事詳細、ダークモード
- GitHub: https://github.com/proto-atlas/nuxt-ai-blog

## 5分で見る

- READMEの機能一覧と既知制約を読む
- 検証記録の対応表を見る: [docs/evidence/INDEX.md](./evidence/INDEX.md)
- 要約APIの境界を見る: `server/api/summary.post.ts`
- AI要約の濫用対策を見る: [evidence/summary-abuse-protection-2026-04-29.md](./evidence/summary-abuse-protection-2026-04-29.md)
- 設計判断を見る: [DESIGN-DECISIONS.md](./DESIGN-DECISIONS.md)

## 技術的な見どころ

- Nuxt Content 3 のMarkdown記事を、Cloudflare Workers上でSSR表示している。
- `/api/summary` はアクセスキー、IP単位の短期制限、Durable Objectsのキャッシュ、日次上限を分けて扱う。
- `SummaryCacheDO` は同一記事、同一モデル、同一本文ハッシュの再生成を抑え、実APIの呼び出し回数を減らす。
- server route本体は `executeSummaryHandler` と依存注入でテストしやすくし、Anthropic SDKとのやり取りをadapterに閉じ込めている。
- 公開ブログUIはキーなし、実API要約だけキー保護という境界にしている。

## 公開範囲とキー保護範囲

| 項目 | アクセスキー | 補足 |
|---|---:|---|
| 記事一覧、検索、タグ、記事詳細 | 不要 | ブログUIは公開 |
| スクリーンショット | 不要 | `/api/summary` をモックして生成。外部AI APIの課金は発生しない |
| 実API要約 | 必要 | 課金と乱用を抑えるためアクセスキーで保護 |
| 実API要約の確認 | 手動 | 小さな固定入力だけで実施。通常CIには含めない |

## 検証記録の扱い

`docs/evidence/` のファイルは特定時点の記録です。最新HEADと一致することは主張しません。再確認するときは、対象commitとCI runを別途指定します。

検証記録には、secret、アクセスキー、cookie、APIキー、ローカルファイルパスなど公開しない情報を除外し、確認日時・確認対象・確認手順・結果を公開文書に記録しています。

## 通常は実施しないこと

- 認証情報の総当たり
- 負荷試験
- 明示判断なしの実API呼び出し
- 本番429の連続リクエスト確認
- `cached:true` の本番再確認を、deploy後の `manual-live-summary-check` 実行前に主張すること
- in-memoryのIP単位制限を、厳密なグローバル上限として主張すること
