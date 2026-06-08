export interface ArticleFilterItem {
  title?: string;
  description?: string;
  category?: string;
  tags?: readonly string[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function collectArticleTags(articles: readonly ArticleFilterItem[]): string[] {
  return Array.from(new Set(articles.flatMap((article) => article.tags ?? []))).sort((a, b) =>
    a.localeCompare(b),
  );
}

export function filterArticles<T extends ArticleFilterItem>(
  articles: readonly T[],
  query: string,
  selectedTag: string,
): T[] {
  const normalizedQuery = normalize(query);
  const normalizedTag = normalize(selectedTag);

  return articles.filter((article) => {
    const matchesTag =
      !normalizedTag || (article.tags ?? []).some((tag) => normalize(tag) === normalizedTag);
    const text = [article.title, article.description, article.category, ...(article.tags ?? [])]
      .filter((value): value is string => typeof value === 'string')
      .join(' ')
      .toLowerCase();
    const matchesQuery = !normalizedQuery || text.includes(normalizedQuery);

    return matchesTag && matchesQuery;
  });
}
