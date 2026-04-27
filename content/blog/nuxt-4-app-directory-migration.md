---
title: 'Nuxt 4 の新ディレクトリ構造 app/ への移行'
description: 'Nuxt 4 で標準採用された app/ ディレクトリの構造と、Nuxt 3 プロジェクトからの移行ポイントを整理する。'
date: '2026-04-10'
tags: ['nuxt', 'vue', 'migration']
category: 'tutorial'
---

Nuxt 4 では、プロジェクトの主要なソースコードを `app/` ディレクトリに集約する構造が正式採用されました。従来の Nuxt 3 では `pages/` `components/` `composables/` などがプロジェクトルート直下に並ぶ設計でしたが、Nuxt 4 ではそれらを `app/` 配下にまとめることで、設定ファイル・ビルド成果物・ドキュメント類とソースコードを視覚的に分離できます。

## 新しいディレクトリ配置

`app/` 配下に入れる主なディレクトリは以下のとおりです。

- `app/pages/` — ファイルベースルーティングの対象
- `app/components/` — 自動インポート対象の Vue コンポーネント
- `app/composables/` — `use*` 関数の自動インポート源
- `app/layouts/` — レイアウトコンポーネント
- `app/middleware/` — ルートミドルウェア
- `app/plugins/` — Nuxt プラグイン
- `app/app.vue` — ルートコンポーネント

ルート直下には `nuxt.config.ts` `package.json` `tsconfig.json` `content/` `public/` `server/` などが残ります。`server/` は Nitro 側の API/ミドルウェアで、フロント側の `app/` とは明確に責務が分かれます。

## 移行ポイント

1. **`srcDir` の自動推論**: Nuxt 4 は `app/` の存在を検出して自動的に `srcDir: 'app'` として扱います。`nuxt.config.ts` に追加設定は不要です。
2. **tsconfig パスのずれ**: IDE の TypeScript サーバーがキャッシュを持っていると、自動インポートの型解決がずれることがあります。`.nuxt/` を削除して `nuxt prepare` を再実行すれば解消します。
3. **テストのパス**: Vitest や Playwright の include/exclude 設定で `src/**` としていた箇所を `app/**` に書き直す必要があります。
4. **新規プロジェクトは迷わず app/**: 空のプロジェクトを `nuxi init` で作ると `app/` 構造で生成されます。旧構造も互換で残っていますが、ドキュメントや最新モジュールは `app/` 前提で書かれているため、新規は素直に app/ を採用するのが無難です。

## 体感の変化

プロジェクト直下に並ぶ設定ファイルの数が減り、エディタのサイドバーで「このファイルはコードか設定か」を一瞬で判別できるようになりました。モノレポで複数パッケージを同居させるときも、`app/` のスコープが明確なぶん読みやすさが上がります。
