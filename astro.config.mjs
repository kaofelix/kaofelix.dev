// @ts-check
import { defineConfig } from "astro/config";

import icon from "astro-icon";

import tailwindcss from "@tailwindcss/vite";

import preact from "@astrojs/preact";

import mdx from '@astrojs/mdx';

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  integrations: [icon(), preact(), mdx()],

  markdown: {
    shikiConfig: {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: cloudflare(),
});