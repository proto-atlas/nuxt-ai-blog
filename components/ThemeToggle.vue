<script setup lang="ts">
/**
 * 3 択テーマトグル (ライト / 自動 / ダーク)。
 * @nuxtjs/color-mode が提供する useColorMode() を直接操作する。
 * preference: 'system' で OS 追従、preference: 'light' / 'dark' で固定。
 * classSuffix: '' の設定により <html class="dark"> が自動付与される。
 *
 * SSR 時 colorMode.preference は 'system' (default) で出力されるが、
 * クライアントマウント直後に localStorage から復元した値で更新されるまで
 * aria-pressed が古い state を指してしまう (リロード後 "自動" のまま見えるバグ)。
 * mounted で activePreference を localStorage 由来の値に同期させて UI を一致させる。
 */
const colorMode = useColorMode();
const mounted = ref(false);

const options = [
  { value: 'light', label: 'ライト', icon: '☀' },
  { value: 'system', label: '自動', icon: '◐' },
  { value: 'dark', label: 'ダーク', icon: '☾' },
] as const;

// マウント前は preference 'system' (SSR と一致) を表示し、ハイドレーションミスマッチを起こさない。
// マウント後に colorMode.preference を直接参照することで localStorage の値で aria-pressed を更新する。
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
