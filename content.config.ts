import { defineCollection, defineContentConfig, z } from '@nuxt/content';

// Nuxt Content 3 コレクション定義。
// frontmatter の型を zod で強制し、@nuxt/content が生成する型 (`.nuxt/content.d.ts`) を通じて
// `queryCollection` 等で型安全にアクセスできるようにする。
export default defineContentConfig({
  collections: {
    blog: defineCollection({
      type: 'page',
      source: 'blog/*.md',
      schema: z.object({
        title: z.string(),
        description: z.string(),
        date: z.string(), // ISO 形式 (YYYY-MM-DD)
        tags: z.array(z.string()),
        category: z.enum(['tech', 'tutorial', 'reference']),
      }),
    }),
  },
});
