// @nuxtjs/sitemapが `sources: ['/api/__sitemap__/urls']` 経由で取得する動的URLソース。
// Nuxt Contentのblogコレクションを列挙してsitemapに動的記事を含める。
// 静的トップ (/) は @nuxtjs/sitemapがページディレクトリから自動検出するためここでは出さない。
import type { H3Event } from 'h3';
import { fetchBlogSitemapArticles } from '../../utils/content-query';
import { queryCollection as defaultQueryCollection } from '#imports';

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

/**
 * `executeUrlsHandler` の依存注入インターフェイス。
 * productionではdefault値を使うため指定不要、テストでは `queryCollection` をmockに
 * 差し替える経路として使う。
 */
export interface SitemapHandlerDeps {
  /** `@nuxt/content` のqueryCollection (server overload)。testではmock関数を渡す。 */
  queryCollection?: unknown;
}

/**
 * sitemap route handler本体。
 *
 * `defineEventHandler` のラッパーから分離してnamed exportにすることで、Vitestからも
 * mock event + 依存stubで直接呼び出してテストできる。default exportはこの関数を
 * `defineEventHandler` でラップしただけで、追加ロジックは持たない。
 */
export async function executeUrlsHandler(
  event: H3Event,
  deps: SitemapHandlerDeps = {},
): Promise<SitemapUrl[]> {
  const queryCollection =
    (deps.queryCollection as typeof defaultQueryCollection | undefined) ?? defaultQueryCollection;

  const articles = await fetchBlogSitemapArticles(event, queryCollection);

  return articles.map((article: { path: string; date: string }) => ({
    loc: article.path,
    lastmod: article.date,
    changefreq: 'monthly' as const,
    priority: 0.8,
  }));
}

export default defineEventHandler(executeUrlsHandler);
