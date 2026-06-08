---
title: 'Cloudflare WorkersでNuxt 4 をデプロイするまで'
description: 'Nitroのcloudflare_module presetを使ってNuxt 4 アプリをCloudflare Workersに乗せる手順と、途中で踏みやすい落とし穴をまとめる。'
date: '2026-04-15'
tags: ['nuxt', 'cloudflare', 'workers', 'deploy']
category: 'tutorial'
---

Nuxt 4 はサーバーランタイムNitroを介して 15 種類以上のデプロイターゲットに対応しており、Cloudflare Workersもそのひとつです。ここでは、ローカル開発から本番デプロイまでの流れを整理します。

## 1. presetを指定する

`nuxt.config.ts` でNitroのpresetを `cloudflare_module` に切り替えます。

```ts
export default defineNuxtConfig({
  nitro: {
    preset: 'cloudflare_module',
  },
});
```

`cloudflare_module` はWorkerのModule形式（`export default { fetch }`）で出力され、wranglerからそのままdeployできる形です。Pages Functions形式を使いたい場合は `cloudflare-pages` presetに切り替えます。

## 2. wrangler.jsoncを用意する

プロジェクト直下に `wrangler.jsonc` を置き、Nitroが生成するエントリを参照します。

```jsonc
{
  "name": "my-nuxt-app",
  "main": ".output/server/index.mjs",
  "compatibility_date": "2026-04-24",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "directory": ".output/public", "binding": "ASSETS" }
}
```

`nodejs_compat` フラグは `node:*` モジュールを使うライブラリのために必要です。

## 3. Secretsを登録する

API Keyのような秘匿値は `wrangler secret put` で登録します。ソース管理対象の `.env` に入れてはいけません。

```bash
npx wrangler secret put NUXT_ANTHROPIC_API_KEY
```

Nuxt側では `useRuntimeConfig()` を介して参照できます。`runtimeConfig` はserver側のみで読み取れる値と、clientに公開する `public` 値を分ける設計になっています。

## 4. ビルド・デプロイ

```bash
npm run build
npx wrangler deploy
```

Nuxtのビルドは `.output/` に成果物を生成し、wranglerがそれをWorkersに送ります。初回deploy時は `https://<worker>.<subdomain>.workers.dev` というURLが発行されます。

## 落とし穴

- **3 MiB制限**: Freeプランではgzip圧縮後 3 MiBを超えるとデプロイが拒否されます。`@nuxt/image` のような重い依存をWorkerバンドルに入れるときは注意が必要です。
- **Request.signalのabortイベント**: クライアント切断を検知するにはcompatibility flag `enable_request_signal` を追加しないと発火しません。ストリーミングAPIで課金が続く事故を防ぐため、AI系エンドポイントには必ず入れておきます。
- **SQLite系モジュール**: Nuxt Content 3 はデフォルトでSQLiteを使います。ローカルではNode.js組み込みの `node:sqlite` または `better-sqlite3` が必要、本番WorkersではD1 に切り替える必要があります。

デプロイまでいけば、あとはエッジ配信の恩恵を受けられます。世界中のロケーションから数十ミリ秒でレスポンスが返るのは、Nitro + Cloudflareの組み合わせの大きな魅力です。
