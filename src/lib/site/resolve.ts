import "server-only";

import { getTranslations } from "next-intl/server";
import { PUBLIC_PAGES, type PublicPage } from "./pages";
import { newestLastModified } from "./last-modified";
import { docSourcePath } from "@/lib/docs/updated";
import { loadDoc } from "@/lib/docs/load";
import { isDocSlug } from "@/lib/docs/slugs";
import { loadLegal } from "@/lib/legal/load";
import { isLegalSlug, EFFECTIVE_DATE } from "@/lib/legal";
import type { Locale } from "@/lib/locale";

/**
 * The public page list with its copy and its dates filled in, for one locale.
 *
 * **This is the server half of `./pages.ts`.** The list itself is pure so a
 * test can read it; resolving it needs the `.mdx` modules, the message
 * catalogue and the filesystem, all three of which are server-side. The sitemap
 * needs only the paths and the dates, `llms.txt` needs the titles as well, and
 * both go through here so they cannot disagree about what is public.
 *
 * **`getTranslations` is called with an explicit `locale`.** Open thread 4:
 * `next/root-params` throws in Route Handlers, and both callers are Route
 * Handlers. A bare `getTranslations()` here would fail at runtime with every
 * static check green.
 */

export type ResolvedPage = {
  /** Unprefixed. `/` is the landing page. */
  path: string;
  title: string;
  /** One sentence, for `llms.txt` and F30b's `<meta name="description">`. */
  description: string;
  /** `null` when no real date could be established — never a fabricated one. */
  lastModified: Date | null;
};

async function copyFor(
  page: PublicPage,
  locale: Locale,
): Promise<{ title: string; description: string }> {
  switch (page.copy.from) {
    case "messages": {
      // `meta.pages.<key>` — written by F30 and consumed again by F30b's
      // `generateMetadata`, so the sitemap's description and the page's own
      // `<meta>` tag are one string rather than two that drift.
      const t = await getTranslations({ locale, namespace: "meta.pages" });
      return {
        title: t(`${page.copy.key}.title`),
        description: t(`${page.copy.key}.description`),
      };
    }
    case "docMeta": {
      if (!isDocSlug(page.copy.slug)) {
        throw new Error(`unknown doc slug in PUBLIC_PAGES: ${page.copy.slug}`);
      }
      const { meta } = await loadDoc(locale, page.copy.slug);
      // F26 wrote `meta.description` as one sentence expressly so it could
      // serve as the index card's line *and* this one.
      return { title: meta.title, description: meta.description };
    }
    case "legalMeta": {
      if (!isLegalSlug(page.copy.slug)) {
        throw new Error(`unknown legal slug in PUBLIC_PAGES: ${page.copy.slug}`);
      }
      const { meta } = await loadLegal(locale, page.copy.slug);
      return { title: meta.title, description: meta.description };
    }
  }
}

async function dateFor(
  page: PublicPage,
  locale: Locale,
): Promise<Date | null> {
  switch (page.date.from) {
    case "source":
      return newestLastModified(page.date.files);
    case "docMdx": {
      if (!isDocSlug(page.date.slug)) return null;
      return newestLastModified([docSourcePath(locale, page.date.slug)]);
    }
    case "legalEffectiveDate":
      return EFFECTIVE_DATE;
  }
}

export async function listPublicPages(
  locale: Locale,
): Promise<ResolvedPage[]> {
  return Promise.all(
    PUBLIC_PAGES.map(async (page) => {
      const [copy, lastModified] = await Promise.all([
        copyFor(page, locale),
        dateFor(page, locale),
      ]);
      return { path: page.path, ...copy, lastModified };
    }),
  );
}
