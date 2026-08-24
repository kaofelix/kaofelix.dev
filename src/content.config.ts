import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

const posts = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/data/posts" }),
  schema: z.object({
    title: z.string(),
    pubDate: z.date().transform((date) => date.toISOString().slice(0, 10)),
    bskyUri: z.string().optional(),
    mastodonUrl: z.string().optional(),
  }),
});

export const collections = { posts };
