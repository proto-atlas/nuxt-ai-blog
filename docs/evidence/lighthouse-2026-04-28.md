# Lighthouse Production Report (2026-04-28)

## 対象

- URL: https://nuxt-ai-blog.atlas-lab.workers.dev/
- Tool: Lighthouse 13.0.1
- 実行環境: Windows + Microsoft Edge headless (`CHROME_PATH`)
- JSON:
  - [`lighthouse-desktop-2026-04-28.json`](./lighthouse-desktop-2026-04-28.json)
  - [`lighthouse-mobile-2026-04-28.json`](./lighthouse-mobile-2026-04-28.json)

## スコア

| Strategy | Performance | Accessibility | Best Practices | SEO |
|---|---:|---:|---:|---:|
| desktop | 99 | 100 | 100 | 100 |
| mobile | 93 | 100 | 100 | 100 |

## Core Web Vitals / 主要指標

| Strategy | FCP | LCP | TBT | CLS |
|---|---:|---:|---:|---:|
| desktop | 0.6 s | 0.6 s | 0 ms | 0 |
| mobile | 1.6 s | 1.6 s | 290 ms | 0 |

## 注意

Lighthouse CLI は計測 JSON 作成後、Windows Temp 内の profile cleanup で `EPERM` を返して exit 1 になった。JSON は生成済みで、上記スコアは JSON から抽出した値。
