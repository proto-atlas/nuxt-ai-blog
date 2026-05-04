import { describe, expect, it } from 'vitest';
import { countPassedChecks, evaluateSummaryQuality } from './summary-quality';

describe('evaluateSummaryQuality', () => {
  const secretLikeEnvReference = [
    'process',
    'env',
    ['NUXT', 'ANTHROPIC', 'API', 'KEY'].join('_'),
  ].join('.');

  it('必須語がsourceとsummaryにあり、文字数と禁止語条件を満たすとpassになる', () => {
    const result = evaluateSummaryQuality({
      slug: 'nuxt-on-cloudflare-workers',
      sourceText:
        'Nuxt 4 を Cloudflare Workers に deploy する。Nitro の cloudflare_module preset、wrangler、Secrets、D1 切替を扱う。',
      summary:
        'Nuxt 4をCloudflare Workersへデプロイする手順を、Nitro preset、wrangler、Secrets、D1切替の注意点とともに整理した記事。',
      requiredTerms: ['Nuxt 4', 'Cloudflare Workers', 'Nitro', 'wrangler', 'D1'],
      forbiddenTerms: ['Firebase', 'React Native', 'AWS Lambda'],
    });

    expect(result.passed).toBe(true);
    expect(countPassedChecks(result)).toBe(7);
  });

  it('summaryが長すぎるとwithin-lengthだけfailになる', () => {
    const result = evaluateSummaryQuality({
      slug: 'tailwind-css-4-features',
      sourceText: 'Tailwind CSS 4 は CSS-first 設定、カスタムバリアント、ビルド速度改善を扱う。',
      summary:
        'Tailwind CSS 4のCSS-first設定、カスタムバリアント、ビルド速度改善、ユーティリティ設計、デザイントークン運用、既存プロジェクト移行、日常のフロントエンド実装で注意したい変更点を幅広く説明した記事。',
      requiredTerms: ['Tailwind CSS 4', 'CSS-first', 'カスタムバリアント'],
      forbiddenTerms: ['Firebase'],
      maxCharacters: 40,
    });

    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.name === 'within-length')).toEqual({
      name: 'within-length',
      passed: false,
      detail: 'summary length <= 40',
    });
  });

  it('本文外の禁止語やsecret-like textを含むとfailになる', () => {
    const result = evaluateSummaryQuality({
      slug: 'typescript-6-vue-composable-patterns',
      sourceText:
        'TypeScript 6 と Vue 3.5 で composable を書くときの型付け、戻り値、副作用管理を扱う。',
      summary: `TypeScript 6とVue 3.5のcomposable設計を、Firebase移行と${secretLikeEnvReference}の扱いまで含めて整理した記事。`,
      requiredTerms: ['TypeScript 6', 'Vue 3.5', 'composable'],
      forbiddenTerms: ['Firebase'],
    });

    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.name === 'forbidden-terms')?.passed).toBe(false);
    expect(result.checks.find((check) => check.name === 'no-secret-like-text')?.passed).toBe(false);
  });
});
