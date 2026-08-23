import type { Metadata } from "next";
import { locale as localeParam } from "next/root-params";
import { ForGaca } from "@/components/landing/for-gaca";
import { Hero } from "@/components/landing/hero";
import { MapPreview } from "@/components/landing/map-preview";
import { Problem } from "@/components/landing/problem";
import { RemoteIdExplainer } from "@/components/landing/remote-id-explainer";
import { Steps } from "@/components/landing/steps";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getSession } from "@/lib/auth-guards";
import { toLocale } from "@/lib/locale";
import { publicPageMetadata } from "@/lib/site/metadata";

/**
 * The front door.
 *
 * Two jobs at once: explain the gap to somebody who has never thought about
 * drone registration, and be credible to a regulator who has thought about
 * little else. The order is the argument — the problem comes **before** any
 * list of what the product does, because a reader who does not believe there is
 * a problem has no use for the list.
 *
 * **F30b sets `<head>` here**, from `PUBLIC_PAGES` — the list the sitemap and
 * `llms.txt` are generated from, so a search result carries the same sentence
 * the assistant-facing file does. This is the one page whose title takes
 * `title.absolute`: `title.default` in the layout is *already* this page's
 * title, and letting the `%s · أجنحة` template apply would render
 * `أجنحة — … · أجنحة`. `publicPageMetadata` owns that rule so no page has to
 * remember it.
 *
 * Dynamic rather than prerendered: the primary action depends on whether the
 * reader is signed in, and the airspace preview reads the seeded zones.
 */
export default async function LandingPage() {
  const locale = toLocale(await localeParam());
  const session = await getSession();
  const signedIn = Boolean(session);

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader signedIn={signedIn} />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 sm:px-6">
        <Hero signedIn={signedIn} />
        <Problem />
        <RemoteIdExplainer locale={locale} />

        {/* The anchor the hero's secondary action points at. */}
        <div id="airspace" className="scroll-mt-8">
          <MapPreview locale={locale} />
        </div>

        <Steps />
        <ForGaca />
      </main>

      <SiteFooter />
    </div>
  );
}

/**
 * Title, description, canonical and `hreflang` from `PUBLIC_PAGES` — the same
 * list the sitemap and `llms.txt` read, so a search result and the file an
 * assistant reads carry one sentence rather than two that drift.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  return publicPageMetadata("/", toLocale((await params).locale));
}
