import { ORGANISATION_NAME } from "@/lib/legal/fields";
import { localePath } from "@/lib/site/pages";
import type { Locale } from "@/lib/locale";
import { absoluteUrl } from "@/lib/url";

/**
 * `WebSite` and `Organization`, on the landing page and nowhere else.
 *
 * ---
 *
 * **`Organization` must never name, imply or claim affiliation with GACA.**
 *
 * This is the honesty rule in its most dangerous form. Fabricated credibility in
 * visible copy is at least legible to the person reading it; fabricated
 * credibility in structured data is consumed by aggregators, search engines and
 * assistants that will repeat it as fact without ever showing anyone the
 * sentence they got it from. An `Organization` block asserting a relationship to
 * a civil aviation regulator is a machine-readable lie about a *safety*
 * authority.
 *
 * So `name` is `ORGANISATION_NAME` — the project's own name and nothing more,
 * the same value `src/lib/legal/fields.ts` refuses to inflate into a legal
 * entity — and the description says "proposed" in both languages.
 *
 * **What is deliberately absent, and why each one:**
 *
 * - **`logo`, `image`** — there is no logo file. A missing image is better than
 *   one invented to fill a field.
 * - **`sameAs`** — no social profiles exist. `sameAs` is how an aggregator
 *   confirms an identity, and pointing it at nothing is worse than silence.
 * - **`address`, `legalName`, `taxID`, `foundingDate`** — Ajniha is a proposal,
 *   not a company. Every one of these would be invented.
 * - **`contactPoint`** — `CONTACT_EMAIL` is a real person's address. It is
 *   published on the legal pages because a data-subject request has to reach
 *   somebody; putting it in machine-readable form is a different act, and it
 *   invites the scrapers those pages do not.
 * - **`AggregateRating`, `Review`, `Offer`** — there are no customers, no
 *   ratings and no price. These are the types that carry rich results, which is
 *   exactly why fabricating them is what gets a domain manually penalised.
 * - **`FAQPage`** — considered for `/docs/remote-id` and **rejected**: its eight
 *   headings are topics ("What Remote ID means"), not questions anybody asked.
 *   Reshaping prose into questions to earn a rich result is the same fabrication
 *   with extra steps.
 *
 * `SearchAction` is absent too, for a duller reason: the site has no search.
 */

export type StructuredData = Record<string, unknown>;

export function siteStructuredData(
  locale: Locale,
  { siteName, description }: { siteName: string; description: string },
): StructuredData {
  const home = absoluteUrl(localePath("/", locale));
  const organisationId = `${absoluteUrl("/")}#organisation`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${absoluteUrl("/")}#website`,
        url: home,
        name: siteName,
        description,
        inLanguage: locale,
        publisher: { "@id": organisationId },
      },
      {
        "@type": "Organization",
        "@id": organisationId,
        // The project's own name. Not a regulator's, not an invented company's.
        name: ORGANISATION_NAME[locale],
        url: home,
        description,
      },
    ],
  };
}

/**
 * The JSON, ready for a `<script type="application/ld+json">`.
 *
 * **`<` is escaped.** A `</script>` sequence inside a JSON string would end the
 * element early and drop the rest of the block into the document as markup.
 * Nothing here is user-supplied today, which is exactly the condition that
 * changes without anyone revisiting the escaping.
 */
export function structuredDataJson(data: StructuredData): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
