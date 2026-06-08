# 公開URL確認記録 - 2026-04-29

nuxt-ai-blogをCloudflare Workersにデプロイした後の確認記録です。
この証跡は公開リポの各commitと一緒に管理するため、自己参照になる固定HEADは本文に埋め込まない。
特定commitを確認する場合は、GitHubのcommit画面、Actions run、Cloudflareデプロイlogを対応させて確認する。

注意: この記録には2つの時点の記録が含まれます。前半の実API確認はDurable Objects実装前、後半の手動の実API要約確認はDurable Objects実装後の再デプロイで確認したものです。

## デプロイ

- Repository: `proto-atlas/nuxt-ai-blog`
- Branch: `main`
- 公開URL: `https://nuxt-ai-blog.atlas-lab.workers.dev`
- deploy command: `npm run deploy`
- 結果: 成功
- Cloudflare Version ID: デプロイごとに変わるため本文には固定値を埋め込まない。必要な場合はCloudflare deploy logで確認する。
- Worker startup time: 31 ms
- Upload量: 1168.57 KiB / gzip 298.68 KiB

Deploy時のwarning:

- `@nuxt/content` がCloudflare向けにD1 binding `DB` へ切り替えるwarning
- sourcemapに関するVite plugin warning
- Cloudflare unenv presetのsideEffectsによるbare import warning

## 基本導線の確認

| Check | Result |
|---|---|
| `HEAD /` | HTTP 200 |
| `POST /api/summary` without `X-Summary-Access-Key` | HTTP 401 |

未認証レスポンスは `access_required` 系の拒否として機能していることを確認した。アクセスキー値はチャット、stdout、Git、evidenceに記録していない。

## 実API確認

`X-Summary-Access-Key` をローカル `.env.local` から読み取り、公開記事 `nuxt-on-cloudflare-workers` の要約を1件だけ生成した。
アクセスキーと要約本文はstdout / Git / evidenceに記録していない。

| Field | Result |
|---|---|
| HTTP status | 200 |
| slug | `nuxt-on-cloudflare-workers` |
| model | `claude-haiku-4-5-20251001` |
| summary length | 153 characters |
| cached | `false` |
| generatedAt | `2026-04-29T02:06:45.317Z` |

同じslugを直後に再実行した結果:

| Field | Result |
|---|---|
| HTTP status | 200 |
| slug | `nuxt-on-cloudflare-workers` |
| model | `claude-haiku-4-5-20251001` |
| summary length | 161 characters |
| cached | `false` |
| generatedAt | `2026-04-29T02:06:49.189Z` |

## 読み方

- 実API生成は本番で成功した。
- アクセスキーなしの呼び出しは 401 で拒否された。
- 同一slugの直後再実行でも `cached:true` は確認できなかった。これは当時のin-memory cacheがWorker isolate単位で分かれる既知制約と整合する。成功扱いにはせず、cache hitの本番証跡は未取得として扱う。
- Durable Objects summary cache / global daily quota実装後の本番 `cached:true` は、下の手動の実API要約確認で確認した。

## Durable Objectsデプロイ後の手動の実API要約確認

Durable Objects RPC wrapper修正後に `wranglerデプロイ` を再実行し、同一slugを2回だけ呼び出した。
アクセスキーと要約本文はstdout / Git / evidenceに記録していない。

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
- Wranglerデプロイ: 成功。Cloudflare Version IDはデプロイごとに変わるため、この公開検証記録には固定値を残していません。

読み方:

- `SummaryCacheDO` による本番cache hitを確認した。
- 2回目は同じ `generatedAt` を返しているため、実API再生成ではなくcache hitと判断できる。
- `quotaRemaining` は公開APIレスポンスには含めていないため、この疎通確認では直接表示していない。quotaのreserve / succeeded / failed-after-upstream-call分類はunit testとDurable Objects実装で確認する。
