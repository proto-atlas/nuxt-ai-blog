---
title: 'TypeScript 6 で書く Vue 3 composable のベストプラクティス'
description: 'TypeScript 6 と Vue 3.5 の組み合わせで composable を書くときに押さえておきたい型付け・戻り値の設計・副作用の扱いをまとめる。'
date: '2026-04-12'
tags: ['typescript', 'vue', 'composable', 'pattern']
category: 'reference'
---

Vue 3 の composable は「関数として再利用可能な状態とロジックの単位」です。TypeScript 6 の strict 設定では型が厳格になり、雑に書くと `unknown` や `any` に落ちやすくなります。ここでは、実務で繰り返し遭遇する 4 つのパターンを整理します。

## 1. 戻り値は readonly で露出する

composable 内部で `ref` や `reactive` を作って返すとき、呼び出し元から中身を直接書き換えられると状態管理が崩れます。戻り値は `readonly()` で包むのが安全です。

```ts
import { ref, readonly, type Ref } from 'vue';

export function useCounter(initial = 0): {
  count: Readonly<Ref<number>>;
  increment: () => void;
} {
  const count = ref(initial);
  const increment = () => {
    count.value += 1;
  };
  return { count: readonly(count), increment };
}
```

呼び出し元が状態を変更するには composable が明示的に公開した関数（この例では `increment`）を通る必要があり、変更点が追跡しやすくなります。

## 2. ジェネリクスで再利用性を確保する

API レスポンスのように型が呼び出しごとに変わるものは、ジェネリクスで受けると再利用性が上がります。

```ts
export function useFetch<T>(url: string) {
  const data = ref<T | null>(null);
  const error = ref<Error | null>(null);
  // ... 実装
  return { data: readonly(data), error: readonly(error) };
}
```

呼び出し側で `useFetch<User>('/api/user')` のように型を指定すれば、そのまま型安全に使えます。

## 3. 副作用はライフサイクルに紐付ける

`setInterval` や `addEventListener` のような副作用は、コンポーネントのアンマウント時に必ず解除する必要があります。`onScopeDispose` を使えば、composable が使われたスコープ（コンポーネントでも `effectScope` でも）に自動で紐付きます。

```ts
import { onScopeDispose } from 'vue';

export function useInterval(fn: () => void, ms: number) {
  const id = setInterval(fn, ms);
  onScopeDispose(() => clearInterval(id));
}
```

## 4. SSR セーフに書く

Nuxt のような SSR 環境で composable を呼ぶと、サーバー側では `window` や `localStorage` が未定義です。TypeScript 6 は `typeof window === 'undefined'` を narrow してくれるので、分岐を書けば型的にも安全です。

```ts
export function useThemeFromStorage() {
  if (typeof window === 'undefined') return { theme: ref<'light' | 'dark'>('light') };
  const theme = ref<'light' | 'dark'>(
    (localStorage.getItem('theme') as 'light' | 'dark' | null) ?? 'light',
  );
  return { theme };
}
```

composable の品質は「戻り値の意図の明確さ」と「副作用の後始末」で決まります。TypeScript 6 の strict 設定は、このあたりを forgetting しないための強力な助けになります。
