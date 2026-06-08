# Lighthouse本番測定記録 (2026-04-28)

## 対象

- URL: https://nuxt-ai-blog.atlas-lab.workers.dev/
- tool: Lighthouse 13.0.1
- 実行環境: Windows + Microsoft Edge headless (`CHROME_PATH`)
- JSON:
  - [`lighthouse-desktop-2026-04-28.json`](./lighthouse-desktop-2026-04-28.json)
  - [`lighthouse-mobile-2026-04-28.json`](./lighthouse-mobile-2026-04-28.json)

## スコア

| strategy | Performance | Accessibility | Best Practices | SEO |
|---|---:|---:|---:|---:|
| desktop | 99 | 100 | 100 | 100 |
| mobile | 93 | 100 | 100 | 100 |

## Core Web Vitals / 主要指標

| strategy | FCP | LCP | TBT | CLS |
|---|---:|---:|---:|---:|
| desktop | 0.6 s | 0.6 s | 0 ms | 0 |
| mobile | 1.6 s | 1.6 s | 290 ms | 0 |

## 注意

Lighthouse CLIは計測JSON作成後、Windows Temp内のprofile cleanupで `EPERM` を返してexit 1 になった。JSONは生成済みで、上記スコアはJSONから抽出した値。
