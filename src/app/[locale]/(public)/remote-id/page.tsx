import { locale as localeParam } from "next/root-params";
import { getTranslations } from "next-intl/server";
import { PublicPage, Section } from "@/components/layout/public-page";
import { ButtonLink } from "@/components/ui/button-link";
import { getSession } from "@/lib/auth-guards";
import { formatDate } from "@/lib/format";
import {
  REMOTE_ID_QUOTES,
  REMOTE_ID_SOURCES,
  type Quote,
} from "@/lib/landing/sources";
import { toLocale } from "@/lib/locale";

/**
 * The intellectual core of the pitch, and the one page here that is a research
 * job rather than a writing job.
 *
 * **Every citation on this page is to a document that was fetched and read**,
 * on the date recorded in `src/lib/landing/sources.ts`. That is not diligence
 * for its own sake: the honesty rule bans fabricated credibility, and a
 * plausible-looking reference to a regulation nobody opened is the most
 * effective fabricated credibility there is — it borrows a regulator's
 * authority for a sentence the regulator may never have written, on the one
 * page a GACA reviewer is most likely to check line by line.
 *
 * Two things that came out of actually reading them, and shape the page:
 *
 * 1. **GACAR Part 107's Subpart F really does say `1 January 2026`**, and
 *    § 107.302(b) really does require Direct or Network Remote ID on every
 *    registered UA. The project's premise survives contact with the source.
 * 2. **"GACA registration requires a manufacturer serial number" does not.**
 *    Volume 18's Table 1 lists the serial as essential information for the
 *    Specific Category only, and Note 3 says the identifier an aircraft
 *    displays may be *the registration certificate number* instead. So the
 *    page argues the accurate and stronger version: the regulator already
 *    contemplates an authority-issued identifier standing in for a serial, and
 *    from 2026 the thing that must be broadcast is a registration number, not
 *    an airframe's factory marking.
 *
 * The section that keeps the page honest is `notTitle` — **an Ajniha Remote ID
 * is a registry identifier, not a radio.** It is not a DRI or NRI system, it is
 * not certified, and it is not issued by GACA. Leaving that out would let a
 * reader conclude the aircraft is compliant because it has a sticker.
 *
 * Nothing in `<head>` is set here. F30 owns the title.
 */

const QUOTES_BY_ID = new Map<string, Quote>(
  REMOTE_ID_QUOTES.map((quote) => [quote.id, quote]),
);

export default async function RemoteIdPage() {
  const locale = toLocale(await localeParam());
  const t = await getTranslations("remoteIdPage");
  const session = await getSession();
  const signedIn = Boolean(session);

  return (
    <PublicPage signedIn={signedIn}>
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold text-balance sm:text-4xl">
          {t("pageTitle")}
        </h1>
        <p className="text-muted-foreground text-lg">{t("pageLead")}</p>
      </header>

      <Section title={t("whatTitle")} lead={t("whatBody")}>
        <p className="text-muted-foreground">{t("whatBody2")}</p>
      </Section>

      <Section title={t("faaTitle")} lead={t("faaBody")}>
        <ul className="flex flex-col gap-3">
          {(["standard", "module", "fria"] as const).map((route) => (
            <li key={route} className="flex flex-col gap-1 border-s-2 ps-4">
              <h3 className="text-sm font-medium">{t(`faaRoutes.${route}.title`)}</h3>
              <p className="text-muted-foreground text-sm">
                {t(`faaRoutes.${route}.body`)}
              </p>
            </li>
          ))}
        </ul>

        <p className="text-muted-foreground">{t("faaIdentityBody")}</p>
        <Quotation id="faaIdentity" />
        <p className="text-muted-foreground">{t("faaModuleBody")}</p>
        <Quotation id="faaModule" />
      </Section>

      <Section title={t("gacaTitle")} lead={t("gacaBody")}>
        <Quotation id="gacaDate" />
        <Quotation id="gacaMandate" />

        <p className="text-muted-foreground">{t("gacaDriBody")}</p>
        <Quotation id="gacaDri" />
        <p className="text-muted-foreground">{t("gacaNriBody")}</p>
        <Quotation id="gacaNri" />

        {/**
         * The current published edition is 5.0, and Subpart F is quoted from
         * 4.0 — the edition that was obtainable. Saying which version a
         * quotation came from is the difference between a citation and an
         * assertion, so the page says it rather than rounding to "GACA says".
         */}
        <p className="text-muted-foreground text-sm">{t("gacaVersionNote")}</p>
      </Section>

      <Section title={t("gapTitle")} lead={t("gapBody")}>
        <Quotation id="gacaSerialOptional" />
        <Quotation id="gacaIdentifier" />
        <p className="text-muted-foreground">{t("gapBody2")}</p>
        <p className="text-muted-foreground">{t("gapBody3")}</p>
      </Section>

      <Section title={t("ajnihaTitle")} lead={t("ajnihaBody")}>
        <ul className="flex flex-col gap-3">
          {(["code", "record", "scan", "reveal", "renewal"] as const).map(
            (item) => (
              <li key={item} className="flex flex-col gap-1 border-s-2 ps-4">
                <h3 className="text-sm font-medium">{t(`ajniha.${item}.title`)}</h3>
                <p className="text-muted-foreground text-sm">
                  {t(`ajniha.${item}.body`)}
                </p>
              </li>
            ),
          )}
        </ul>
        <Quotation id="gacaLabel" />
      </Section>

      {/**
       * The section that stops the rest of the page from being read as a
       * compliance claim. A reader who leaves believing a sticker makes their
       * aircraft legal has been misled by a page that was accurate throughout.
       */}
      <Section title={t("notTitle")} lead={t("notBody")}>
        <ul className="flex flex-col gap-3">
          {(["notRadio", "notCertified", "notGaca", "notLegal"] as const).map(
            (item) => (
              <li key={item} className="flex flex-col gap-1 border-s-2 ps-4">
                <h3 className="text-sm font-medium">{t(`not.${item}.title`)}</h3>
                <p className="text-muted-foreground text-sm">
                  {t(`not.${item}.body`)}
                </p>
              </li>
            ),
          )}
        </ul>
        <Quotation id="faaDoc" />
      </Section>

      <Section title={t("sourcesTitle")} lead={t("sourcesLead")}>
        <ol className="flex flex-col gap-4">
          {REMOTE_ID_SOURCES.map((source) => (
            <li key={source.id} className="flex flex-col gap-1">
              <a
                href={source.url}
                /**
                 * `noopener` because these open a new tab; `noreferrer` because
                 * a regulator's server log has no business learning that the
                 * visitor came from a page arguing about their own rules.
                 */
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="text-primary text-start text-sm underline underline-offset-4"
              >
                {source.title}
              </a>
              <p className="text-muted-foreground text-xs">
                {locale === "ar" ? source.publisherAr : source.publisherEn}
                {" · "}
                {t("retrievedOn", {
                  date: formatDate(new Date(source.retrievedOn), locale),
                })}
              </p>
              <p className="text-muted-foreground text-sm">
                {t(`sources.${source.id}`)}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      <section className="bg-card flex flex-col gap-3 rounded-lg border p-5">
        <h2 className="text-lg font-medium">{t("nextTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("nextBody")}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={signedIn ? "/drones/new" : "/sign-up"}>
            {t("nextCta")}
          </ButtonLink>
          <ButtonLink variant="outline" href="/how-it-works">
            {t("howItWorksCta")}
          </ButtonLink>
        </div>
      </section>
    </PublicPage>
  );
}

/**
 * A verbatim passage, in the document's own language and direction.
 *
 * **`dir="ltr"` on the quotation itself, always.** Every source here is written
 * in English; dropping English legal text into an RTL paragraph makes the bidi
 * algorithm reorder its punctuation and section numbers, so `§ 107.302(b)`
 * arrives as `(b)107.302 §` and the quotation stops being a quotation. The
 * gloss around it is translated; the words inside the marks are not.
 */
async function Quotation({ id }: { id: string }) {
  const quote = QUOTES_BY_ID.get(id);
  // A missing quote is a programming error, not a runtime state to render.
  if (!quote) throw new Error(`Unknown remote-id quote: ${id}`);

  const source = REMOTE_ID_SOURCES.find((item) => item.id === quote.sourceId);
  if (!source) throw new Error(`Quote ${id} cites an unknown source`);

  return (
    <figure className="border-primary/40 bg-muted/40 flex flex-col gap-2 rounded-e-lg border-s-4 p-4">
      <blockquote dir="ltr" cite={source.url} className="text-start text-sm">
        {`“${quote.text}”`}
      </blockquote>
      <figcaption
        dir="ltr"
        className="text-muted-foreground text-start font-mono text-xs"
      >
        {quote.cite}
      </figcaption>
    </figure>
  );
}
