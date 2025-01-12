import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/data/posts" }),
  schema: z.object({
    title: z.string(),
    pubDate: z.date().transform((date) => date.toISOString().slice(0, 10)),
  }),
});

export const collections = { posts };
