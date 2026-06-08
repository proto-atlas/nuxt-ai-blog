import { defineCollection, defineContentConfig, z } from '@nuxt/content';

// Nuxt Content 3 コレクション定義。
// frontmatterの型をzodで強制し、@nuxt/contentが生成する型 (`.nuxt/content.d.ts`) を通じて
// `queryCollection` 等で型安全にアクセスできるようにする。
export default defineContentConfig({
  collections: {
    blog: defineCollection({
      type: 'page',
      source: 'blog/*.md',
      schema: z.object({
        title: z.string(),
        description: z.string(),
        date: z.string(), // ISO形式 (YYYY-MM-DD)
        tags: z.array(z.string()),
        category: z.enum(['tech', 'tutorial', 'reference']),
      }),
    }),
  },
});
