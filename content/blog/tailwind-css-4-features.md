---
title: 'Tailwind CSS 4 の注目機能 5 選'
description: 'Tailwind CSS 4 で導入された CSS-first 設定、カスタムバリアント、ビルド速度の向上など、日常使いで効く変化を 5 つ紹介する。'
date: '2026-04-17'
tags: ['tailwindcss', 'css', 'frontend']
category: 'reference'
---

Tailwind CSS 4 は、設定の書き方からビルドパイプラインまで大きく刷新されました。実務でとくに効果が大きい 5 つの変化を並べます。

## 1. `@import 'tailwindcss';` 一行で完結

v3 までは `@tailwind base;` `@tailwind components;` `@tailwind utilities;` の 3 行が必要でした。v4 では 1 行で済みます。

```css
@import 'tailwindcss';
```

PostCSS 構成も最小限で、Vite 経由なら `@tailwindcss/vite` プラグインを 1 つ足すだけで動きます。`postcss.config.*` や `tailwind.config.js` の管理コストが一気に下がりました。

## 2. CSS-first な設定（`@theme`）

テーマの拡張が CSS の `@theme` ブロックで完結するようになりました。JavaScript のオブジェクト記法ではなく、CSS 変数として定義します。

```css
@theme {
  --color-brand-500: oklch(0.58 0.17 245);
  --font-display: 'Inter', sans-serif;
}
```

`bg-brand-500` や `font-display` のようなユーティリティが即座に使えるようになります。

## 3. `@custom-variant` でダークモードを class 戦略に

`dark:` バリアントは標準では `prefers-color-scheme: dark` メディアクエリに連動しますが、UI トグルで手動切り替えしたい場合は `@custom-variant` で上書きします。

```css
@import 'tailwindcss';
@custom-variant dark (&:where(.dark, .dark *));
```

これで `<html class="dark">` を付け外しするだけで配色が切り替わり、ユーザー設定の永続化（localStorage）と組み合わせやすくなります。

## 4. コンテナクエリが第一級サポート

v4 では `@container` とコンテナクエリ用バリアント（`@md:` `@lg:` など）が標準で入っています。親要素のサイズに応じてスタイルを切り替えられるため、カード UI やサイドバーで使える場面が多く、メディアクエリ駆動のレイアウトより再利用性が上がります。

## 5. Rust ベースのビルダーで速い

v4 のビルダーは Rust で書き直されており、差分ビルドが体感で数倍速くなっています。大規模プロジェクトでの `npm run dev` 起動時間や、`content/` の追加時の再ビルド時間が短くなるのは地味に効きます。

## 移行時の注意

- `tailwind.config.js` の中身（`theme.extend` など）は `@theme` に書き直す必要があります。
- 一部のプラグイン（v3 時代の community プラグイン）は v4 未対応のものがあり、使っていれば代替探しが必要です。
- `@apply` は引き続き使えますが、使いすぎると CSS-first のメリットが薄れるので、コンポーネントの共通スタイル以外は控えめに。

小さいプロジェクトなら半日で移行できます。設定ファイルの削減と dev サーバーの体感速度だけでも元が取れる更新です。
