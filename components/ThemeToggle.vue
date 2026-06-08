<script setup lang="ts">
/**
 * 3 択テーマトグル (ライト / 自動 / ダーク)。
 * @nuxtjs/color-modeが提供するuseColorMode() を直接操作する。
 * preference: 'system' でOS追従、preference: 'light' / 'dark' で固定。
 * classSuffix: '' の設定により <html class="dark"> が自動付与される。
 *
 * SSR時colorMode.preferenceは 'system' (default) で出力されるが、
 * クライアントマウント直後にlocalStorageから復元した値で更新されるまで
 * aria-pressedが古いstateを指してしまう (リロード後 "自動" のまま見えるバグ)。
 * mountedでactivePreferenceをlocalStorage由来の値に同期させてUIを一致させる。
 */
const colorMode = useColorMode();
const mounted = ref(false);

const options = [
  { value: 'light', label: 'ライト', icon: '☀' },
  { value: 'system', label: '自動', icon: '◐' },
  { value: 'dark', label: 'ダーク', icon: '☾' },
] as const;

// マウント前はpreference 'system' (SSRと一致) を表示し、ハイドレーションミスマッチを起こさない。
// マウント後にcolorMode.preferenceを直接参照することでlocalStorageの値でaria-pressedを更新する。
const activePreference = computed(() => (mounted.value ? colorMode.preference : 'system'));

function setPreference(value: 'light' | 'system' | 'dark') {
  colorMode.preference = value;
}

onMounted(() => {
  mounted.value = true;
});
</script>

<template>
  <div
    role="group"
    aria-label="テーマ切替"
    class="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5 text-xs dark:border-slate-800 dark:bg-slate-900"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      :aria-pressed="activePreference === opt.value"
      class="inline-flex min-h-11 items-center justify-center rounded px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      :class="
        activePreference === opt.value
          ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
      "
      @click="setPreference(opt.value)"
    >
      <span aria-hidden class="mr-1">{{ opt.icon }}</span>
      {{ opt.label }}
    </button>
  </div>
</template>
