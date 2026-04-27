// Nuxt 4 用 Vitest 設定
// @nuxt/test-utils は Nuxt runtime 込みのテスト (`describe('...', () => {}, { environment: 'nuxt' })`)
// を可能にする。環境 default は happy-dom、Vue コンポーネントテストに十分。
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
