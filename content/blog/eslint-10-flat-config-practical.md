---
title: 'ESLint 10 flat config の実務設定'
description: 'ESLint 10 で flat config が事実上必須になった後、TypeScript / Vue / Nuxt プロジェクトで機能する最小設定とハマりどころを整理する。'
date: '2026-04-19'
tags: ['eslint', 'typescript', 'flat-config']
category: 'reference'
---

ESLint 10 では `.eslintrc.*` のレガシー設定が削除され、`eslint.config.js`（flat config）のみが使えるようになりました。移行は一度やれば難しくありませんが、プラグインが flat config に対応しているかで負荷が変わります。

## 最小構成（TypeScript + Prettier）

```js
// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', '.next/**', '.nuxt/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  prettierConfig, // 最後に置いてフォーマット系ルールを無効化
);
```

ポイントは 3 つ:

1. `ignores` はトップレベルのオブジェクトで書く（`.eslintignore` は廃止）。
2. `typescript-eslint` の `projectService: true` で、`tsconfig.json` の自動検出が有効になります。従来の `project: true` より高速で、モノレポでもマッピングが不要です。
3. `eslint-config-prettier` は最後に読み込む。順番を間違えると Prettier と衝突する装飾ルールが残ります。

## Nuxt プロジェクトでは `@nuxt/eslint`

Nuxt 4 では `@nuxt/eslint` モジュールが推奨です。`modules: ['@nuxt/eslint']` を追加すると、`.nuxt/eslint.config.mjs` が自動生成され、そこに Nuxt 固有のルール（自動インポート対応など）が含まれます。

```js
import withNuxt from './.nuxt/eslint.config.mjs';
import prettierConfig from 'eslint-config-prettier';

export default withNuxt(
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  prettierConfig,
);
```

`nuxt prepare` を一度走らせないと `.nuxt/eslint.config.mjs` が生成されないため、初回 clone 時は `npm install` の postinstall 内で `nuxt prepare` が動いている前提になります。

## ハマりどころ

- **Vue ファイルのパース**: Vue 3 の SFC は `vue-eslint-parser` が必要です。`typescript-eslint` の設定だけだと `.vue` 内の `<script lang="ts">` が解析できません。`@nuxt/eslint` は内部で面倒を見てくれますが、Nuxt 以外の Vue プロジェクトでは明示設定が必要です。
- **プラグインの flat config 対応**: コミュニティプラグインの一部はまだ legacy config しかサポートしていません。その場合は `@eslint/compat` の `fixupPluginRules` でラップして読み込みます。
- **`projectService` のコスト**: 型情報を使うルール（`no-unsafe-assignment` など）はファイル数に比例して重くなります。モノレポで IDE が重いときは、型情報を使わない `recommended` セットに落とすことも検討します。

最低限の設定は 20 行程度で済むので、レガシー `.eslintrc` から移行するハードルはそれほど高くありません。むしろ、plugin 一個ずつ挙動を確認しながら整えるほうが結果的に早く終わります。
