# Astro Starter Kit: Minimal

## Runtime and Astro upgrade

This site uses Astro 7.4.12 with its matching Cloudflare, MDX, and Preact
integrations. Use Node.js **22.23.4 or newer** and npm **9.6.5 or newer** locally
and in the build environment. Install reproducibly with `npm ci`.

- Run `npm run check` for Astro/TypeScript diagnostics and `npm run build` for the
  production build. `npm test` runs the Smalltalk tutorial's interpreter and
  page-example tests (`src/smalltalk/*.test.js`). There is no lint command.
- `npm run dev` runs Astro directly on `http://localhost:4321` with hot
  reloading (no preliminary build), using the Cloudflare Workers runtime.
- `npm run preview` previews a production build in the Workers runtime. Stop it
  with `npm run astro -- preview stop` if it runs as a background preview server.
- `npm run deploy` still builds and deploys using Wrangler. The source Wrangler
  config now uses `@astrojs/cloudflare/entrypoints/server`; the build generates
  deployable assets in `dist/client` and Wrangler deployment metadata in
  `.wrangler/deploy/config.json`. Do not deploy the old `dist/_worker.js` path.

The site uses the supported unified Markdown processor (including smart
punctuation), keeps article body headings below the page title, and optimizes
images at build time (`imageService: "compile"`) without requiring Cloudflare Images.
Content schemas import Zod from `astro/zod`. Post excerpts use the project's
Markdown parser rather than a Node-only excerpt dependency.

Edit the homepage biography in `src/data/about.md`. Its Astro wrapper keeps the
photo, social links, styled heading, and latest-posts list separate from the copy.

```sh
npm create astro@latest -- --template minimal
```

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/withastro/astro/tree/latest/examples/minimal)
[![Open with CodeSandbox](https://assets.codesandbox.io/github/button-edit-lime.svg)](https://codesandbox.io/p/sandbox/github/withastro/astro/tree/latest/examples/minimal)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/withastro/astro?devcontainer_path=.devcontainer/minimal/devcontainer.json)

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm ci`                  | Installs dependencies from the lockfile          |
| `npm run check`           | Check Astro templates and TypeScript             |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
