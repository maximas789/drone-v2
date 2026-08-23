import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DocsShell } from "@/components/docs/shell";
import { LegalToc } from "@/components/legal/toc";
import { getSession } from "@/lib/auth-guards";
import { formatDate } from "@/lib/format";
import { EFFECTIVE_DATE, loadLegal, type LegalSlug } from "@/lib/legal";
import { toLocale } from "@/lib/locale";
import { publicPageMetadata } from "@/lib/site/metadata";

/**
 * The body of every legal page, and the metadata that goes with it.
 *
 * **The two routes are the same page with a different noun**, so the route
 * files hold the one thing that genuinely differs — their slug — and nothing
 * else. Written out twice, the second copy is where the effective-date line
 * silently stops matching the first.
 *
 * **`DocsShell`, not a shell of its own.** The frame a legal page needs is the
 * frame a documentation page needs: public chrome, a reading column, and an
 * aside for the contents. Copying thirty lines to get a component whose name
 * said `Legal` would buy a name and cost a second place for the grid to be
 * fixed. What goes in the aside is what differs, and that is the argument.
 *
 * **Reachable signed out**, like everything in the `(public)` group —
 * `getSession()` is read for the header's sign-in link and nothing else. Terms
 * behind a sign-in are terms nobody can read before agreeing to them.
 */
export async function LegalPage({
  slug,
  locale: rawLocale,
}: {
  slug: LegalSlug;
  locale: string;
}) {
  const locale = toLocale(rawLocale);

  const [session, doc, t] = await Promise.all([
    getSession(),
    loadLegal(locale, slug),
    getTranslations("legal"),
  ]);

  const { Content } = doc;

  return (
    <DocsShell
      signedIn={Boolean(session)}
      aside={<LegalToc sections={doc.meta.sections} />}
    >
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold text-balance">{doc.meta.title}</h1>
        <p className="text-muted-foreground text-lg">{doc.meta.description}</p>
        {/**
         * The **effective date**, from `legal.ts` — not the git date F26's docs
         * pages show. See `EFFECTIVE_DATE`: a typo fix must not announce itself
         * as a new version of the policy.
         */}
        <p className="text-muted-foreground text-xs">
          {t("effectiveDate", { date: formatDate(EFFECTIVE_DATE, locale) })}
        </p>
      </header>

      <article className="flex flex-col gap-5">
        <Content />
      </article>
    </DocsShell>
  );
}

/**
 * Title and description come from the document's own `meta`, so the browser
 * tab, the search result and the `<h1>` are one string rather than three that
 * drift. No `robots` override: these pages are meant to be found.
 *
 * **F30b routes it through `publicPageMetadata`** rather than returning the two
 * fields directly. That adds the canonical and the `hreflang` set — and, more
 * to the point, makes the legal pages read their copy through the same resolver
 * as the sitemap and `llms.txt` instead of loading the `.mdx` a second time
 * here. `PUBLIC_PAGES` already routes a legal slug to `loadLegal`, so the
 * strings are identical by construction rather than by coincidence.
 */
export async function legalMetadata(
  slug: LegalSlug,
  rawLocale: string,
): Promise<Metadata> {
  return publicPageMetadata(`/${slug}`, toLocale(rawLocale));
}
