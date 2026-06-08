// Nuxt 4 用Vitest設定
// @nuxt/test-utilsはNuxt runtime込みのテスト (`describe('...', () => {}, { environment: 'nuxt' })`)
// を可能にする。環境defaultはhappy-dom、Vueコンポーネントテストに十分。
import { defineVitestConfig } from '@nuxt/test-utils/config';

export default defineVitestConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['**/*.{test,spec}.{ts,tsx,vue}'],
    exclude: [
      'node_modules/**',
      '.nuxt/**',
      '.output/**',
      '.data/**',
      'dist/**',
      'e2e/**',
      'playwright-report/**',
      'test-results/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['app/**', 'components/**', 'composables/**', 'server/**', 'utils/**', 'stores/**'],
      exclude: ['**/*.d.ts', '**/*.config.*', '**/index.ts'],
      thresholds: {
        lines: 60,
        functions: 70,
        branches: 50,
        statements: 60,
      },
    },
  },
});
