import { getTranslations } from "next-intl/server";
import { listPublicPages } from "@/lib/site/resolve";
import { localePath } from "@/lib/site/pages";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/locale";
import { absoluteUrl } from "@/lib/url";

/**
 * `/llms.txt` — a plain-markdown map of the public site, generated from the
 * same `PUBLIC_PAGES` the sitemap reads. An assistant pointed at Ajniha finds
 * the map instead of parsing navigation out of HTML.
 *
 * **Be clear about what this file is not.** `llms.txt` is a *proposed
 * convention*; no major AI crawler has publicly committed to reading it. It is
 * an invitation, not a policy. **What a crawler is permitted to do lives in
 * `robots.txt` and nowhere else** — this file neither grants nor withholds
 * anything, and treating it as a control is how somebody ends up believing a
 * page is protected because it was left out of a list.
 *
 * **Arabic first, then English**, because Arabic is the authored language and
 * the English is its translation. Both locales are listed in full: a reader
 * asking about Ajniha in English should be handed `/en/remote-id`, not an
 * Arabic URL with an apology.
 *
 * **No `/rid/` URL appears here**, and not because it was filtered out —
 * `PUBLIC_PAGES` contains no scan route to filter. `site.test.ts` pins it.
 *
 * `getTranslations` is called with an explicit `locale`: this is a Route
 * Handler, where `next/root-params` throws (open thread 4).
 */
export async function GET(): Promise<Response> {
  const t = await getTranslations({
    locale: DEFAULT_LOCALE,
    namespace: "meta",
  });

  const lines: string[] = [
    `# ${t("siteName")}`,
    "",
    // `meta.pages.home.description` is the site's own blurb — there is no
    // second site-level description to drift away from it. A `meta.description`
    // key used to exist and this line used to read it; deleting the key left
    // next-intl printing the raw path `meta.description` into the file, with
    // typecheck, lint, i18n:check and the whole suite green. Open thread 60,
    // in a new costume: a missing key is not an error, it is text.
    `> ${t("pages.home.description")}`,
    "",
    t("llmsIntro"),
    "",
  ];

  for (const locale of LOCALES) {
    const heading = await getTranslations({ locale, namespace: "meta" });
    lines.push(`## ${heading("llmsSection")}`, "");
    for (const page of await listPublicPages(locale)) {
      const url = absoluteUrl(localePath(page.path, locale));
      lines.push(`- [${page.title}](${url}): ${page.description}`);
    }
    lines.push("");
  }

  return new Response(lines.join("\n"), {
    headers: {
      // `charset=utf-8` is not decoration here: the whole file is Arabic.
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
