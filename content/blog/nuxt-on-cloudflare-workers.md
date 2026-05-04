---
title: 'Cloudflare Workers で Nuxt 4 をデプロイするまで'
description: 'Nitro の cloudflare_module preset を使って Nuxt 4 アプリを Cloudflare Workers に乗せる手順と、途中で踏みやすい落とし穴をまとめる。'
date: '2026-04-15'
tags: ['nuxt', 'cloudflare', 'workers', 'deploy']
category: 'tutorial'
---

Nuxt 4 はサーバーランタイム Nitro を介して 15 種類以上のデプロイターゲットに対応しており、Cloudflare Workers もそのひとつです。ここでは、ローカル開発から本番デプロイまでの流れを整理します。

## 1. preset を指定する

`nuxt.config.ts` で Nitro の preset を `cloudflare_module` に切り替えます。

```ts
export default defineNuxtConfig({
  nitro: {
    preset: 'cloudflare_module',
  },
});
```

`cloudflare_module` は Worker の Module 形式（`export default { fetch }`）で出力され、wrangler からそのまま deploy できる形です。Pages Functions 形式を使いたい場合は `cloudflare-pages` preset に切り替えます。

## 2. wrangler.jsonc を用意する

プロジェクト直下に `wrangler.jsonc` を置き、Nitro が生成するエントリを参照します。

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

## 3. Secrets を登録する

API Key のような秘匿値は `wrangler secret put` で登録します。ソース管理対象の `.env` に入れてはいけません。

```bash
npx wrangler secret put NUXT_ANTHROPIC_API_KEY
```

Nuxt 側では `useRuntimeConfig()` を介して参照できます。`runtimeConfig` は server 側のみで読み取れる値と、client に公開する `public` 値を分ける設計になっています。

## 4. ビルド・デプロイ

```bash
npm run build
npx wrangler deploy
```

Nuxt のビルドは `.output/` に成果物を生成し、wrangler がそれを Workers に送ります。初回 deploy 時は `https://<worker>.<subdomain>.workers.dev` という URL が発行されます。

## 落とし穴

- **3 MiB 制限**: Free プランでは gzip 圧縮後 3 MiB を超えるとデプロイが拒否されます。`@nuxt/image` のような重い依存を Worker バンドルに入れるときは注意が必要です。
- **Request.signal の abort イベント**: クライアント切断を検知するには compatibility flag `enable_request_signal` を追加しないと発火しません。ストリーミング API で課金が続く事故を防ぐため、AI 系エンドポイントには必ず入れておきます。
- **SQLite 系モジュール**: Nuxt Content 3 はデフォルトで SQLite を使います。ローカルでは Node.js 組み込みの `node:sqlite` または `better-sqlite3` が必要、本番 Workers では D1 に切り替える必要があります。

デプロイまでいけば、あとはエッジ配信の恩恵を受けられます。世界中のロケーションから数十ミリ秒でレスポンスが返るのは、Nitro + Cloudflare の組み合わせの大きな魅力です。
