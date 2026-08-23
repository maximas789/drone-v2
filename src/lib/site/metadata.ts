import "server-only";

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { localePath, PUBLIC_PAGES } from "./pages";
import { resolvePage } from "./resolve";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/locale";
import { absoluteUrl } from "@/lib/url";

/**
 * The `<head>` of one public page, from the one list.
 *
 * **Every public page calls this and passes only its own path.** The title, the
 * description, the canonical and the `hreflang` set are then decided in one
 * place — which matters more than it sounds, because a canonical is a
 * *machine-readable claim about which URL is the real one* and getting it wrong
 * on one page tells a search engine to drop that page in favour of another.
 * Fourteen hand-written `alternates` blocks is fourteen chances to write
 * `/ar/zones` on the English page.
 *
 * The copy comes from the same resolver the sitemap and `llms.txt` use, so a
 * page's description in a search result is the same sentence `llms.txt` hands
 * an assistant. There is no second string to drift.
 */

/**
 * `canonical` and the full `hreflang` set for one page in one locale.
 *
 * **Absolute, not relative.** `metadataBase` would make a relative canonical
 * absolute, and for `canonical` alone that would be enough — but the language
 * alternates have to name the *other* locale's URL, which is not relative to
 * this page at all. One form for both is one rule to hold in your head.
 *
 * **Reciprocal**: each page lists every language *including itself*, which is
 * what makes a crawler landing on either URL able to reach the other. A page
 * that lists only the alternate is a one-way link, and Google discards
 * non-reciprocal `hreflang` pairs.
 *
 * `x-default` is Arabic. Arabic is authored first and `/` already redirects
 * there with `localeDetection: false`, so this says what the app does rather
 * than a politer version of it.
 */
export function alternatesFor(path: string, locale: Locale) {
  const languages: Record<string, string> = {
    "x-default": absoluteUrl(localePath(path, DEFAULT_LOCALE)),
  };
  for (const other of LOCALES) {
    languages[other] = absoluteUrl(localePath(path, other));
  }
  return { canonical: absoluteUrl(localePath(path, locale)), languages };
}

/**
 * `path` is the unprefixed route — `/`, `/zones`, `/docs/remote-id`. It **must**
 * be in `PUBLIC_PAGES`; a typo throws at build rather than silently emitting a
 * page with no title, which is the failure this whole feature exists to end.
 */
export async function publicPageMetadata(
  path: string,
  locale: Locale,
): Promise<Metadata> {
  if (!PUBLIC_PAGES.some((page) => page.path === path)) {
    throw new Error(
      `publicPageMetadata("${path}") — not in PUBLIC_PAGES. A public page must ` +
        "be in the list the sitemap and llms.txt are generated from, or it is " +
        "titled but unfindable.",
    );
  }

  const { title, description } = await resolvePage(path, locale);

  return {
    // The landing page is the one page whose title must **not** take the
    // template: `title.default` is already its own title, and letting the
    // suffix apply would render `أجنحة — … · أجنحة`.
    title: path === "/" ? { absolute: title } : title,
    description,
    alternates: alternatesFor(path, locale),
  };
}

/**
 * What every page behind a sign-in carries, set **once per route group** rather
 * than once per page.
 *
 * `(app)`, `(admin)` and `(public)/(auth)` each export this from their layout
 * and every page underneath inherits it — metadata merges field by field, so a
 * page setting only its own `title` keeps this. Thirty pages each repeating a
 * `robots` block is thirty places for one to go missing, and the one that went
 * missing would be indexed without anything failing.
 *
 * **This is not the security boundary** and must never be read as one — the
 * layout guard is. It stops a sign-in form being indexed under the app's name,
 * which is a different problem with a different fix.
 */
export const PRIVATE_ROBOTS = {
  index: false,
  follow: false,
} as const;

/**
 * The `<title>` of one page behind a sign-in.
 *
 * **A tab is a navigation control once there are three of them open.** Every
 * signed-in page inherited `title.default` until F30b, so a reviewer with the
 * queue, a drone and the audit browser open saw the same twenty-nine Arabic
 * characters three times. Nothing was *broken*; it was simply unusable, and no
 * check anywhere would ever have said so.
 *
 * `key` is a **dotted path from the root of the catalogue**, not a namespace and
 * a key — the pages reuse the string they already render as their own heading,
 * so the tab and the `<h1>` cannot drift. `robots` is not set: the route group's
 * layout already carries `PRIVATE_ROBOTS`, and metadata merges field by field.
 *
 * **A detail page takes its section's title, not the record's.** `/drones/[id]`
 * is titled "My aircraft", not the drone's nickname — resolving the nickname
 * would mean running the ownership-checked query a second time, in
 * `generateMetadata`, on every detail page in the app. The `<h1>` shows the
 * nickname; the tab shows where you are.
 */
export async function privatePageTitle(
  locale: Locale,
  key: string,
): Promise<Metadata> {
  const t = await getTranslations({ locale });
  return { title: t(key) };
}
