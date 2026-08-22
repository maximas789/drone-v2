import { locale as localeParam } from "next/root-params";
import { getTranslations } from "next-intl/server";
import { PublicPage } from "@/components/layout/public-page";
import { ButtonLink } from "@/components/ui/button-link";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth-guards";
import { listDocs } from "@/lib/docs";
import { toLocale } from "@/lib/locale";

/**
 * `/[locale]/docs` — the six pages, in `order`.
 *
 * **Public, and it has to stay public.** Half of what these pages are for is
 * someone deciding whether to sign up, and a documentation link that bounces a
 * stranger to a sign-in form answers a question nobody asked.
 *
 * No search box. Six pages is fewer than a browser's own find handles better,
 * and a search field over them is a control that mostly returns nothing —
 * `docs.searchPlaceholder` was in the catalogue from F02 and is deleted rather
 * than honoured.
 *
 * Nothing in `<head>` is set here. F30 owns the title.
 */
export default async function DocsIndexPage() {
  const locale = toLocale(await localeParam());
  const t = await getTranslations("docs");
  const session = await getSession();
  const docs = await listDocs(locale);

  return (
    <PublicPage signedIn={Boolean(session)}>
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold text-balance sm:text-4xl">
          {t("indexTitle")}
        </h1>
        <p className="text-muted-foreground text-lg">{t("indexLead")}</p>
      </header>

      <ul className="flex flex-col gap-4">
        {docs.map((doc) => (
          <li key={doc.slug}>
            {/**
             * The whole card is the link, so the target is the size of the
             * card rather than the size of the words — which is what makes it
             * usable with a thumb.
             */}
            <Link
              href={`/docs/${doc.slug}`}
              className="bg-card hover:border-primary/50 flex flex-col gap-1 rounded-lg border p-5 transition-colors"
            >
              <span className="font-medium">{doc.meta.title}</span>
              <span className="text-muted-foreground text-sm">
                {doc.meta.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="bg-card flex flex-col gap-3 rounded-lg border p-5">
        <h2 className="text-lg font-medium">{t("indexNextTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("indexNextBody")}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={session ? "/drones/new" : "/sign-up"}>
            {t("indexNextCta")}
          </ButtonLink>
          <ButtonLink variant="outline" href="/how-it-works">
            {t("indexHowItWorksCta")}
          </ButtonLink>
        </div>
      </section>
    </PublicPage>
  );
}
