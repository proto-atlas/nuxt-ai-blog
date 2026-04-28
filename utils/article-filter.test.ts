import { describe, expect, it } from 'vitest';
import { collectArticleTags, filterArticles } from './article-filter';

const articles = [
  {
    title: 'Nuxt 4 の移行',
    description: 'app directory の設計',
    category: 'nuxt',
    tags: ['nuxt', 'vue'],
  },
  {
    title: 'Cloudflare Workers デプロイ',
    description: 'D1 と Workers の構成',
    category: 'cloudflare',
    tags: ['cloudflare', 'nuxt'],
  },
  {
    title: 'TypeScript composable',
    description: 'Vue 3 の型設計',
    category: 'typescript',
    tags: ['typescript', 'vue'],
  },
];

describe('article-filter', () => {
  it('collectArticleTags は重複を除いて昇順に並べる', () => {
    expect(collectArticleTags(articles)).toEqual(['cloudflare', 'nuxt', 'typescript', 'vue']);
  });

  it('filterArticles はタイトルと説明文を検索する', () => {
    expect(filterArticles(articles, 'workers', '')).toEqual([articles[1]]);
    expect(filterArticles(articles, '型設計', '')).toEqual([articles[2]]);
  });

  it('filterArticles はタグで絞り込む', () => {
    expect(filterArticles(articles, '', 'vue')).toEqual([articles[0], articles[2]]);
  });

  it('filterArticles は検索語とタグを同時に適用する', () => {
    expect(filterArticles(articles, 'nuxt', 'cloudflare')).toEqual([articles[1]]);
  });
});
