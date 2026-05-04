import type { H3Event } from 'h3';
import { queryCollection as defaultQueryCollection } from '#imports';

export interface SummaryArticle {
  title?: unknown;
  description?: unknown;
  body?: unknown;
}

export interface SitemapArticle {
  path: string;
  date: string;
}

interface BlogPathQuery {
  first(): Promise<SummaryArticle | null>;
}

interface BlogAllQuery {
  all(): Promise<SitemapArticle[]>;
}

interface BlogOrderQuery {
  order(field: 'date', direction: 'DESC'): BlogAllQuery;
}

interface BlogCollectionQuery {
  path(path: string): BlogPathQuery;
  select(...fields: ('path' | 'date')[]): BlogOrderQuery;
}

type ServerQueryCollection = (event: H3Event, collection: 'blog') => BlogCollectionQuery;

export async function fetchBlogArticleBySlug(
  event: H3Event,
  slug: string,
  queryCollection: unknown = defaultQueryCollection,
): Promise<SummaryArticle | null> {
  const serverQueryCollection = queryCollection as ServerQueryCollection;
  return serverQueryCollection(event, 'blog').path(`/blog/${slug}`).first();
}

export async function fetchBlogSitemapArticles(
  event: H3Event,
  queryCollection: unknown = defaultQueryCollection,
): Promise<SitemapArticle[]> {
  const serverQueryCollection = queryCollection as ServerQueryCollection;
  return serverQueryCollection(event, 'blog').select('path', 'date').order('date', 'DESC').all();
}
