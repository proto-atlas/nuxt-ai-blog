// Nuxt 4 ESLint (flat config)
// withNuxt() は @nuxt/eslint モジュールが生成する .nuxt/eslint.config.mjs を拡張する。
// npm install (→ nuxt prepare) 後にのみこのファイルが機能する点に注意。
import withNuxt from './.nuxt/eslint.config.mjs';
import prettierConfig from 'eslint-config-prettier';

export default withNuxt(
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  // CLI スクリプト (scripts/*.mjs) は console.log で進捗を stdout に出すのが正しい用途
  // のため no-console を無効化。
  {
    files: ['scripts/**/*.mjs'],
    rules: {
      'no-console': 'off',
    },
  },
  prettierConfig,
);
