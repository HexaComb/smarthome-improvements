import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    // Set when the content is materially revised; feeds BlogPosting
    // dateModified (freshness signal for answer engines). Honest dates only.
    updated: z.coerce.date().optional(),
    author: z.string().default('Smart Home Improvements'),
    category: z.string().default('Home Improvement'),
    // Optional FAQ block rendered under the post + emitted as FAQPage JSON-LD.
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  }),
});

export const collections = { blog };
