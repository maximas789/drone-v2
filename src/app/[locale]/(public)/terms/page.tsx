import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/components/legal/legal-page";

/**
 * `/[locale]/terms` — the terms of use.
 *
 * The whole page is `LegalPage`; this file exists to name the slug and to be
 * the route. See `src/components/legal/legal-page.tsx`.
 */
export default async function TermsPage({
  params,
}: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  return <LegalPage slug="terms" locale={locale} />;
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/terms">): Promise<Metadata> {
  return legalMetadata("terms", (await params).locale);
}
