import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LastUpdated } from "@/components/docs/last-updated";
import { DocsShell } from "@/components/docs/shell";
import { DocsSidebar } from "@/components/docs/sidebar";
import { getSession } from "@/lib/auth-guards";
import { listDocs, loadDoc } from "@/lib/docs";
import { isDocSlug } from "@/lib/docs/slugs";
import { docLastUpdated } from "@/lib/docs/updated";
import { toLocale } from "@/lib/locale";
import { publicPageMetadata } from "@/lib/site/metadata";

/**
 * `/[locale]/docs/[slug]` — one documentation page.
 *
 * **The locale comes from `params`, not from `next/root-params`.** Both work in
 * a page; this one needs the value to pick a *file* rather than to translate a
 * string, and reading it from the segment that actually decides which file is
 * loaded keeps the two from ever disagreeing.
 *
 * **An unknown slug is a 404, not an empty page.** `isDocSlug` is the same
 * narrowing the loader trusts, so a hand-typed `/docs/pricing` cannot reach a
 * dynamic import at all.
 *
 * The `<h1>` is rendered here from `meta.title` rather than by a `#` in the
 * content file. One title, in one place, and the sidebar and the index show the
 * same string as the page — a heading typed twice is a heading that drifts.
 */
export default async function DocPage({
  params,
}: PageProps<"/[locale]/docs/[slug]">) {
  const { locale: rawLocale, slug } = await params;
  if (!isDocSlug(slug)) notFound();
  const locale = toLocale(rawLocale);

  const [session, docs, doc, updated] = await Promise.all([
    getSession(),
    listDocs(locale),
    loadDoc(locale, slug),
    docLastUpdated(locale, slug),
  ]);

  const { Content } = doc;

  return (
    <DocsShell
      signedIn={Boolean(session)}
      aside={<DocsSidebar docs={docs} current={slug} />}
    >
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold text-balance">{doc.meta.title}</h1>
        <p className="text-muted-foreground text-lg">{doc.meta.description}</p>
        <LastUpdated date={updated} locale={locale} />
      </header>

      {/**
       * The gap, not `space-y-*`: the content is a flat stream of siblings from
       * MDX, and a flex column is the one thing that spaces them evenly without
       * every element carrying a margin of its own.
       */}
      <article className="flex flex-col gap-5">
        <Content />
      </article>
    </DocsShell>
  );
}

/**
 * The title and description are the `.mdx` file's own `meta` — the same strings
 * the `<h1>`, the sidebar and the index card render, resolved through
 * `PUBLIC_PAGES` so the sitemap and `llms.txt` cannot disagree with the tab.
 *
 * **An unknown slug returns `{}`** and lets the page's own `notFound()` do the
 * work. Metadata that invents a title for a record that does not exist is how a
 * 404 ends up indexed — and here it would also throw, because the path is not
 * in `PUBLIC_PAGES`.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/docs/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isDocSlug(slug)) return {};
  return publicPageMetadata(`/docs/${slug}`, toLocale(locale));
}
