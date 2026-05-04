import { describe, expect, it, vi } from 'vitest';
import type { H3Event } from 'h3';
import { fetchBlogArticleBySlug, fetchBlogSitemapArticles } from './content-query';

vi.mock('#imports', () => ({
  queryCollection: vi.fn(),
}));

function makeEvent(): H3Event {
  return { node: { req: {} } } as unknown as H3Event;
}

describe('fetchBlogArticleBySlug', () => {
  it('server-side queryCollection に event と blog collection を渡して記事を取得する', async () => {
    const article = { title: '記事タイトル', description: '記事概要', body: null };
    const first = vi.fn().mockResolvedValue(article);
    const path = vi.fn(() => ({ first }));
    const queryCollection = vi.fn(() => ({ path }));
    const event = makeEvent();

    const result = await fetchBlogArticleBySlug(event, 'sample-slug', queryCollection);

    expect(queryCollection).toHaveBeenCalledWith(event, 'blog');
    expect(path).toHaveBeenCalledWith('/blog/sample-slug');
    expect(first).toHaveBeenCalledTimes(1);
    expect(result).toEqual(article);
  });

  it('記事がなければ null を返す', async () => {
    const first = vi.fn().mockResolvedValue(null);
    const path = vi.fn(() => ({ first }));
    const queryCollection = vi.fn(() => ({ path }));

    await expect(
      fetchBlogArticleBySlug(makeEvent(), 'missing-slug', queryCollection),
    ).resolves.toBe(null);
  });

  it('sitemap用の記事 path/date を date DESC 指定で取得する', async () => {
    const articles = [{ path: '/blog/sample', date: '2026-04-25' }];
    const all = vi.fn().mockResolvedValue(articles);
    const order = vi.fn(() => ({ all }));
    const select = vi.fn(() => ({ order }));
    const queryCollection = vi.fn(() => ({ select }));
    const event = makeEvent();

    const result = await fetchBlogSitemapArticles(event, queryCollection);

    expect(queryCollection).toHaveBeenCalledWith(event, 'blog');
    expect(select).toHaveBeenCalledWith('path', 'date');
    expect(order).toHaveBeenCalledWith('date', 'DESC');
    expect(all).toHaveBeenCalledTimes(1);
    expect(result).toEqual(articles);
  });
});
