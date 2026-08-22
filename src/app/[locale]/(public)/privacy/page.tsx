import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DocsShell } from "@/components/docs/shell";
import { LegalToc } from "@/components/legal/toc";
import { getSession } from "@/lib/auth-guards";
import { formatDate } from "@/lib/format";
import { EFFECTIVE_DATE, loadLegal } from "@/lib/legal";
import { toLocale } from "@/lib/locale";

/**
 * `/[locale]/privacy` — the privacy policy.
 *
 * **`DocsShell`, not a shell of its own.** The frame a legal page needs is the
 * frame a documentation page needs: public chrome, a reading column, and an
 * aside for the contents. Copying thirty lines to get a component whose name
 * said `Legal` would buy a name and cost a second place for the grid to be
 * fixed. What goes in the aside is what differs, and that is the argument.
 *
 * **Reachable signed out**, like every other page in the `(public)` group —
 * `getSession()` is read for the header's sign-in link and nothing else. A
 * privacy policy behind a sign-in is a privacy policy nobody can read before
 * deciding whether to sign up.
 */
export default async function PrivacyPage({
  params,
}: PageProps<"/[locale]/privacy">) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);

  const [session, doc, t] = await Promise.all([
    getSession(),
    loadLegal(locale, "privacy"),
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
 * drift. No `robots` override: this page is meant to be found, and F30 owns
 * what else is.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const doc = await loadLegal(locale, "privacy");
  return { title: doc.meta.title, description: doc.meta.description };
}
