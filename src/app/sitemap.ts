import type { MetadataRoute } from "next";
import { listPublicPages } from "@/lib/site/resolve";
import { localePath } from "@/lib/site/pages";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/locale";
import { absoluteUrl } from "@/lib/url";

/**
 * Every public page, in both languages.
 *
 * **One entry per locale, not one per page.** `localePrefix: "always"` means
 * `/ar/zones` and `/en/zones` are two real URLs and a crawler has to be told
 * about both; a single `<loc>` with the other language hidden in an alternate
 * is how the English half of a bilingual site goes uncrawled. Each entry then
 * lists **every** language including itself, which is what the sitemap protocol
 * asks for and what makes the set reciprocal — a crawler that lands on either
 * URL can reach the other.
 *
 * `x-default` points at Arabic. Arabic is authored first and `/` already
 * redirects there with `localeDetection: false`, so the sitemap says the same
 * thing the app does rather than a politer version of it.
 *
 * **`/rid/` is absent, and it is absent structurally.** The list comes from
 * `PUBLIC_PAGES`, which has no scan route in it at all — there is nothing here
 * to remember to exclude. `site.test.ts` asserts it anyway, because the cost of
 * this one being wrong is a browsable national drone registry.
 *
 * **No `priority`, no `changeFrequency`.** Google ignores both, and a number
 * nobody reads is a number that will eventually be wrong.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const byLocale = new Map(
    await Promise.all(
      LOCALES.map(
        async (locale) =>
          [locale, await listPublicPages(locale)] as const,
      ),
    ),
  );

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    for (const page of byLocale.get(locale) ?? []) {
      const languages: Record<string, string> = {
        "x-default": absoluteUrl(localePath(page.path, DEFAULT_LOCALE)),
      };
      for (const other of LOCALES) {
        languages[other] = absoluteUrl(localePath(page.path, other));
      }

      entries.push({
        url: absoluteUrl(localePath(page.path, locale)),
        // A real content date or nothing at all. `new Date()` on every build
        // would claim the whole site changed today, which tells a crawler
        // exactly as much as omitting the field and is less honest.
        ...(page.lastModified ? { lastModified: page.lastModified } : {}),
        alternates: { languages },
      });
    }
  }

  return entries;
}
