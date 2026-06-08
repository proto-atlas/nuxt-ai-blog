/**
 * /api/__sitemap__/urlsのunitテスト。
 *
 * server/api/summary.post.tsと同じ依存注入パターン (`SitemapHandlerDeps`
 * でqueryCollectionを差し替え可能) を使い、handler本体をnamed export化して
 * unitテストできるようにしている。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { H3Event } from 'h3';
import { executeUrlsHandler } from './urls';

// urls.tsのトップレベル `export default defineEventHandler(...)` のimport評価を
// 通すため、vi.hoistedでglobalThis.defineEventHandlerをidentity化する。
// vi.hoisted / vi.mockはvitestがimportより前にhoistする。
vi.hoisted(() => {
  (globalThis as unknown as { defineEventHandler: (h: unknown) => unknown }).defineEventHandler = (
    h,
  ) => h;
});

vi.mock('#imports', () => ({
  queryCollection: vi.fn(),
}));

interface SitemapMockArticle {
  path: string;
  date: string;
}

/**
 * queryCollection chain (`.select().order().all()`) のmockを生成する。
 * `.all()` がarticles配列を返す。throwシナリオでは `.all()` でreject。
 */
function makeQueryCollectionChain(
  articlesOrError: SitemapMockArticle[] | Error,
): ReturnType<typeof vi.fn> {
  const allFn =
    articlesOrError instanceof Error
      ? vi.fn().mockRejectedValue(articlesOrError)
      : vi.fn().mockResolvedValue(articlesOrError);
  const orderFn = vi.fn(() => ({ all: allFn }));
  const selectFn = vi.fn(() => ({ order: orderFn }));
  return vi.fn(() => ({ select: selectFn }));
}

/** test用の最小H3Event (urls.tsはeventをqueryCollectionに渡すだけ) */
function makeEvent(): H3Event {
  return {} as unknown as H3Event;
}

describe('GET /api/__sitemap__/urls (sitemap route handler)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('5 記事のcollectionをsitemap entries 5 件にマップする', async () => {
    const articles: SitemapMockArticle[] = [
      { path: '/blog/eslint-10-flat-config-practical', date: '2026-04-22' },
      { path: '/blog/typescript-6-vue-composable-patterns', date: '2026-04-20' },
      { path: '/blog/nuxt-on-cloudflare-workers', date: '2026-04-18' },
      { path: '/blog/tailwind-css-4-features', date: '2026-04-15' },
      { path: '/blog/nuxt-4-app-directory-migration', date: '2026-04-10' },
    ];

    const result = await executeUrlsHandler(makeEvent(), {
      queryCollection: makeQueryCollectionChain(articles),
    });

    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({
      loc: '/blog/eslint-10-flat-config-practical',
      lastmod: '2026-04-22',
      changefreq: 'monthly',
      priority: 0.8,
    });
    expect(result[4]?.loc).toBe('/blog/nuxt-4-app-directory-migration');
  });

  it('空collectionなら空sitemap (空配列を返す)', async () => {
    const result = await executeUrlsHandler(makeEvent(), {
      queryCollection: makeQueryCollectionChain([]),
    });
    expect(result).toEqual([]);
  });

  it('queryCollectionがthrowするとhandlerもthrowを伝播する', async () => {
    const error = new Error('D1 connection failed');
    await expect(
      executeUrlsHandler(makeEvent(), {
        queryCollection: makeQueryCollectionChain(error),
      }),
    ).rejects.toThrow('D1 connection failed');
  });
});
