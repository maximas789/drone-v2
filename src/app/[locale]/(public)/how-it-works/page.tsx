import { getTranslations } from "next-intl/server";
import { PublicPage, Section } from "@/components/layout/public-page";
import { ButtonLink } from "@/components/ui/button-link";
import { getSession } from "@/lib/auth-guards";

/**
 * The whole flow, end to end, for a pilot.
 *
 * The landing page's four steps are a summary; this is the version that answers
 * "and then what happens?" — including the two answers people actually want and
 * marketing pages usually skip: **what gets refused, and who sees what.**
 *
 * **Every stage here is something the platform does, in the order a pilot meets
 * it.** The review stage says a human reads it, because a human does; the scan
 * stage says what a stranger sees, because F11 decides that and it is
 * checkable. Nothing on this page claims an automated identity check, an SMS,
 * or a regulator's involvement.
 *
 * Nothing in `<head>` is set here. F30 owns the title.
 */

/**
 * Six stages. `book` and `fly` describe the booking flow the airspace and slot
 * engines already implement and [F21](../../../../../.claude/plans/features/F21-booking-flow.md)
 * puts a screen on — the same level of detail the landing page's step list
 * already commits to, and no more. There is no screenshot of an unbuilt screen.
 */
const STAGES = [
  "account",
  "register",
  "review",
  "identity",
  "book",
  "renew",
] as const;

export default async function HowItWorksPage() {
  const t = await getTranslations("howItWorks");
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

      <ol className="flex flex-col gap-8">
        {STAGES.map((stage, index) => (
          <li key={stage} className="flex flex-col gap-3 border-s-2 ps-5">
            {/**
             * Decorative: the list is already ordered, and a screen reader
             * announcing "1" twice is noise. Plain Latin text rather than a
             * formatted number, because it is a marker, not a quantity.
             */}
            <span aria-hidden className="text-primary font-mono text-sm">
              {`0${index + 1}`}
            </span>
            <h2 className="text-xl font-semibold">{t(`stages.${stage}.title`)}</h2>
            <p className="text-muted-foreground">{t(`stages.${stage}.body`)}</p>
            <p className="text-sm">
              <span className="font-medium">{t("detailLabel")}</span>{" "}
              <span className="text-muted-foreground">
                {t(`stages.${stage}.detail`)}
              </span>
            </p>
          </li>
        ))}
      </ol>

      <Section title={t("refusalsTitle")} lead={t("refusalsLead")}>
        <ul className="flex flex-col gap-3">
          {(["outside", "closed", "ceiling", "capacity", "status"] as const).map(
            (reason) => (
              <li key={reason} className="flex flex-col gap-1 border-s-2 ps-4">
                <h3 className="text-sm font-medium">
                  {t(`refusals.${reason}.title`)}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t(`refusals.${reason}.body`)}
                </p>
              </li>
            ),
          )}
        </ul>
      </Section>

      <Section title={t("privacyTitle")} lead={t("privacyLead")} />

      <section className="bg-card flex flex-col gap-3 rounded-lg border p-5">
        <h2 className="text-lg font-medium">{t("nextTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("nextBody")}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={signedIn ? "/drones/new" : "/sign-up"}>
            {t("nextCta")}
          </ButtonLink>
          <ButtonLink variant="outline" href="/remote-id">
            {t("remoteIdCta")}
          </ButtonLink>
          <ButtonLink variant="outline" href="/zones">
            {t("zonesCta")}
          </ButtonLink>
        </div>
      </section>
    </PublicPage>
  );
}
