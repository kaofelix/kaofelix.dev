import type { CollectionEntry } from "astro:content";
import type { RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { mdxFromMarkdown } from "mdast-util-mdx";
import { mdxjs } from "micromark-extension-mdxjs";

export type Post = CollectionEntry<"posts">;

export const sortByDate = (a: Post, b: Post) =>
  a.data.pubDate < b.data.pubDate ? 1 : -1;

const inlineText = (node: RootContent): string => {
  if (node.type === "text" || node.type === "inlineCode") {
    return node.value;
  }

  if ("children" in node) {
    return node.children.map(inlineText).join("");
  }

  return "";
};

export const postExcerpt = (post: Post, wordLimit = 40): string => {
  const tree = fromMarkdown(post.body ?? "", {
    extensions: [mdxjs()],
    mdastExtensions: [mdxFromMarkdown()],
  });

  const text = tree.children
    .filter((node) => node.type === "paragraph")
    .map(inlineText)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const words = text.split(" ");
  const excerpt = words.slice(0, wordLimit).join(" ");
  const wasTruncated = words.length > wordLimit;

  return wasTruncated && !/[.,?!;…]$/.test(excerpt) ? `${excerpt}…` : excerpt;
};
