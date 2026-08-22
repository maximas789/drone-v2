import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * MDX, for the documentation pages only (F26).
 *
 * **No `pageExtensions`.** The Next guide adds `mdx` to it, which is what makes
 * an `app/**\/page.mdx` a route — and this app must never have one: every route
 * lives under `[locale]`, and a page that *is* a markdown file can only be
 * written in one language. The docs pages are ordinary `page.tsx` files that
 * import a locale's `.mdx` by path, so the loader is all we need and route
 * resolution stays exactly as it was.
 *
 * **`remark-gfm`, and it is not optional.** MDX parses CommonMark, which has no
 * tables: without this plugin a `| a | b |` block renders as a paragraph of
 * literal pipe characters. It shipped that way for an hour here with
 * `typecheck`, `lint`, `build` and 1019 tests green — thread 11 again — and was
 * found by counting `<table>` elements in the rendered page.
 *
 * **Named as a string, because Turbopack requires it.** Plugins cross into the
 * Rust bundler, so a JavaScript function cannot be passed; the name is resolved
 * on that side. That is also why there is no local plugin here for heading ids
 * or frontmatter — neither could be written in this repo and passed. Both are
 * done another way: ids in `src/mdx-components.tsx`, and frontmatter as an ESM
 * export from each content file. See `src/lib/docs/`.
 */
const withMDX = createMDX({ options: { remarkPlugins: ["remark-gfm"] } });

const nextConfig: NextConfig = {};

export default withNextIntl(withMDX(nextConfig));
