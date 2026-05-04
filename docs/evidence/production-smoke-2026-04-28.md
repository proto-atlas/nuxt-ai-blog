# Production Smoke (2026-04-28)

## 対象

- Production URL: https://nuxt-ai-blog.atlas-lab.workers.dev
- Cloudflare Workers version: `5b6104f4-6161-46c9-8297-1f83079ee70e`
- 実行日: 2026-04-28

## 結果

| Check | Method | Path | Expected | Actual | Content-Type | Elapsed |
|---|---|---|---:|---:|---|---:|
| home | GET | `/` | 200 | 200 | `text/html; charset=utf-8` | 2067 ms |
| robots | GET | `/robots.txt` | 200 | 200 | `text/plain` | 407 ms |
| sitemap | GET | `/sitemap.xml` | 200 | 200 | `text/xml; charset=UTF-8` | 188 ms |
| og-image | GET | `/og-image.svg` | 200 | 200 | `image/svg+xml` | 342 ms |
| article | GET | `/blog/nuxt-on-cloudflare-workers` | 200 | 200 | `text/html; charset=utf-8` | 212 ms |
| summary-invalid-body | POST | `/api/summary` | 400 | 400 | n/a | 214 ms |

## 判定

Production smoke は pass。ホーム、静的 SEO ファイル、OG 画像、記事詳細ページが 200 で応答し、`/api/summary` は不正 body に対して 400 を返すことを確認した。

## 未実施

- 有効な `/api/summary` リクエストは Anthropic API 呼び出しと課金が発生するため、この smoke では実行していない。
- Lighthouse / `npm audit` は別 evidence として管理する。
