// @vue/test-utilsでArticleCard.vueの描画を検証。
// NuxtLinkは実際のrouterを持たないため、slotを透過するstubに置き換える。
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ArticleCard from './ArticleCard.vue';

const baseArticle = {
  path: '/blog/sample-article',
  title: 'サンプル記事',
  description: 'これはサンプル記事の説明文です',
  date: '2026-04-15',
  tags: ['nuxt', 'vue'],
  category: 'tutorial' as const,
};

describe('ArticleCard', () => {
  it('タイトルとdescriptionと日付を表示する', () => {
    const wrapper = mount(ArticleCard, {
      props: { article: baseArticle },
      global: {
        stubs: { NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } },
      },
    });
    expect(wrapper.text()).toContain('サンプル記事');
    expect(wrapper.text()).toContain('これはサンプル記事の説明文です');
    expect(wrapper.text()).toContain('2026/04/15');
  });

  it('tagsを #tag形式で列挙する', () => {
    const wrapper = mount(ArticleCard, {
      props: { article: baseArticle },
      global: {
        stubs: { NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } },
      },
    });
    expect(wrapper.text()).toContain('#nuxt');
    expect(wrapper.text()).toContain('#vue');
  });

  it('categoryをバッジとして表示する', () => {
    const wrapper = mount(ArticleCard, {
      props: { article: baseArticle },
      global: {
        stubs: { NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } },
      },
    });
    expect(wrapper.text()).toContain('tutorial');
  });

  it('article.pathをNuxtLinkのtoとして渡す', () => {
    const wrapper = mount(ArticleCard, {
      props: { article: baseArticle },
      global: {
        stubs: { NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } },
      },
    });
    const link = wrapper.find('a');
    expect(link.attributes('href')).toBe('/blog/sample-article');
  });
});
