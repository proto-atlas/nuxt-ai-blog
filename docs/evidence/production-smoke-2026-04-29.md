# Production Smoke - 2026-04-29

nuxt-ai-blog を Cloudflare Workers に deploy した後の smoke 記録です。
この証跡は公開リポの各commitと一緒に管理するため、自己参照になる固定HEADは本文に埋め込まない。
特定commitを確認する場合は、GitHubのcommit画面、Actions run、Cloudflare deploy logを対応させて確認する。

注意: このsnapshotには2つの時点の記録が含まれます。前半のLive AI Smokeは Durable Objects 実装前、後半のManual Live Summary Smokeは Durable Objects 実装後の再deployで確認したものです。

## Deploy

- Repository: `proto-atlas/nuxt-ai-blog`
- Branch: `main`
- Public URL: `https://nuxt-ai-blog.atlas-lab.workers.dev`
- Deploy command: `npm run deploy`
- Result: success
- Cloudflare Version ID: deploy ごとに変わるため本文には固定値を埋め込まない。必要な場合は Cloudflare deploy log で確認する。
- Worker startup time: 31 ms
- Upload: 1168.57 KiB / gzip 298.68 KiB

Deploy 時の warning:

- `@nuxt/content` が Cloudflare 向けに D1 binding `DB` へ切り替える warning
- sourcemap に関する Vite plugin warning
- Cloudflare unenv preset の sideEffects による bare import warning

## Basic Smoke

| Check | Result |
|---|---|
| `HEAD /` | HTTP 200 |
| `POST /api/summary` without `X-Summary-Access-Key` | HTTP 401 |

未認証レスポンスは `access_required` 系の拒否として機能していることを確認した。アクセスキー値はチャット、stdout、Git、evidence に記録していない。

## Live AI Smoke

`X-Summary-Access-Key` をローカル `.env.local` から読み取り、公開記事 `nuxt-on-cloudflare-workers` の要約を1件だけ生成した。
アクセスキーと要約本文は stdout / Git / evidence に記録していない。

| Field | Result |
|---|---|
| HTTP status | 200 |
| slug | `nuxt-on-cloudflare-workers` |
| model | `claude-haiku-4-5-20251001` |
| summary length | 153 characters |
| cached | `false` |
| generatedAt | `2026-04-29T02:06:45.317Z` |

同じ slug を直後に再実行した結果:

| Field | Result |
|---|---|
| HTTP status | 200 |
| slug | `nuxt-on-cloudflare-workers` |
| model | `claude-haiku-4-5-20251001` |
| summary length | 161 characters |
| cached | `false` |
| generatedAt | `2026-04-29T02:06:49.189Z` |

## Interpretation

- live AI生成は本番で成功した。
- アクセスキーなしの呼び出しは 401 で拒否された。
- 同一 slug の直後再実行でも `cached:true` は確認できなかった。これは当時の in-memory cache が Worker isolate 単位で分かれる既知制約と整合する。成功扱いにはせず、cache hit の本番証跡は未取得として扱う。
- Durable Objects summary cache / global daily quota 実装後の本番 `cached:true` は、下のManual Live Summary Smokeで確認した。

## Manual Live Summary Smoke After Durable Objects Deploy

Durable Objects RPC wrapper修正後に `wrangler deploy` を再実行し、同一slugを2回だけ呼び出した。
アクセスキーと要約本文は stdout / Git / evidence に記録していない。

| Field | First request | Second request |
|---|---:|---:|
| HTTP status | 200 | 200 |
| slug | `nuxt-on-cloudflare-workers` | `nuxt-on-cloudflare-workers` |
| model | `claude-haiku-4-5-20251001` | `claude-haiku-4-5-20251001` |
| summary length | 100 characters | 100 characters |
| cached | `false` | `true` |
| generatedAt | `2026-04-29T07:10:09.254Z` | `2026-04-29T07:10:09.254Z` |

追加確認:

- `HEAD /`: HTTP 200, `text/html; charset=utf-8`
- `POST /api/summary` without `X-Summary-Access-Key`: HTTP 401, `access_required`
- Wrangler deploy: success. Cloudflare Version ID changes on each deploy, so this public evidence keeps it out of the committed file.

Interpretation:

- `SummaryCacheDO` による本番cache hitを確認した。
- 2回目は同じ `generatedAt` を返しているため、live AI再生成ではなくcache hitと判断できる。
- `quotaRemaining` は公開APIレスポンスには含めていないため、このsmokeでは直接表示していない。quotaのreserve / succeeded / failed-after-upstream-call分類はunit testとDurable Objects実装で確認する。
