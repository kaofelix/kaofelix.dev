import type { CollectionEntry } from "astro:content";

export type Post = CollectionEntry<"posts">;

export const sortByDate = (a: Post, b: Post) =>
  a.data.pubDate < b.data.pubDate ? 1 : -1;
