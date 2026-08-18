import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";

/**
 * The gap in one sentence, and one thing to press.
 *
 * **The eyebrow says what this is before anything else does.** A page that
 * looks like a civil aviation authority's and does not say "proposed" is the
 * one thing here that could cause real trouble, so the claim is the first line
 * on the page rather than a footnote under it.
 *
 * One primary action. "Explore the map" is deliberately secondary: the pitch is
 * that a pilot with no serial number can register, and sending them to a map
 * first answers a question they have not asked yet.
 */
export async function Hero({ signedIn }: { signedIn: boolean }) {
  const t = await getTranslations("landing");

  return (
    <section className="flex flex-col items-start gap-5 py-10 sm:py-16">
      <Badge variant="secondary">{t("eyebrow")}</Badge>

      <h1 className="max-w-3xl text-3xl font-semibold text-balance sm:text-4xl md:text-5xl">
        {t("heroTitle")}
      </h1>

      <p className="text-muted-foreground max-w-2xl text-lg">{t("heroSubtitle")}</p>

      <div className="flex flex-wrap items-center gap-3">
        {/**
         * Signed in, "register your drone" means the wizard; signed out it
         * means make an account first. Sending a signed-in pilot to sign-up is
         * the front door forgetting who they are.
         */}
        <ButtonLink href={signedIn ? "/drones/new" : "/sign-up"}>
          {t("ctaRegister")}
        </ButtonLink>
        <ButtonLink variant="outline" href="#airspace">
          {t("ctaExploreMap")}
        </ButtonLink>
      </div>
    </section>
  );
}
