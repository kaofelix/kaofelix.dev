// @ts-check
import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";

import icon from "astro-icon";

import tailwindcss from "@tailwindcss/vite";

import preact from "@astrojs/preact";

import mdx from "@astrojs/mdx";

import cloudflare from "@astrojs/cloudflare";

// Keep the post title as the document's only h1. This also helps Safari Reader
// identify the title and article body correctly.
function rehypeDemoteHeadings() {
  /** @param {import("hast").Root} tree */
  return (tree) => {
    /** @param {import("hast").Root | import("hast").RootContent} node */
    const visit = (node) => {
      if (node.type === "element" && node.tagName === "h1") {
        node.tagName = "h2";
      }
      if ("children" in node) {
        node.children.forEach(visit);
      }
    };
    visit(tree);
  };
}

// https://astro.build/config
export default defineConfig({
  site: "https://kaofelix.dev",
  integrations: [icon(), preact(), mdx()],

  markdown: {
    shikiConfig: {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
    },
    processor: unified({ rehypePlugins: [rehypeDemoteHeadings] }),
  },

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: cloudflare(),
});
