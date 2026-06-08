# 公開URL確認記録 (2026-04-28)

## 対象

- 公開URL: https://nuxt-ai-blog.atlas-lab.workers.dev
- Cloudflare Workers version: `5b6104f4-6161-46c9-8297-1f83079ee70e`
- 実行日: 2026-04-28

## 結果

| 確認項目 | method | path | 期待値 | 観測値 | Content-Type | 経過時間 |
|---|---|---|---:|---:|---|---:|
| home | GET | `/` | 200 | 200 | `text/html; charset=utf-8` | 2067 ms |
| robots | GET | `/robots.txt` | 200 | 200 | `text/plain` | 407 ms |
| sitemap | GET | `/sitemap.xml` | 200 | 200 | `text/xml; charset=UTF-8` | 188 ms |
| og-image | GET | `/og-image.svg` | 200 | 200 | `image/svg+xml` | 342 ms |
| article | GET | `/blog/nuxt-on-cloudflare-workers` | 200 | 200 | `text/html; charset=utf-8` | 212 ms |
| summary-invalid-body | POST | `/api/summary` | 400 | 400 | n/a | 214 ms |

## 判定

公開URL確認 は通過。ホーム、静的SEOファイル、OG画像、記事詳細ページが 200 で応答し、`/api/summary` は不正bodyに対して 400 を返すことを確認した。

## 未実施

- 有効な `/api/summary` リクエストはAnthropic API呼び出しと課金が発生するため、この 疎通確認 では実行していない。
- Lighthouse / `npm audit` は別evidenceとして管理する。
