import { useTranslations } from "next-intl";
import { DecisionReasons } from "@/components/airspace/decision-reasons";
import type { AirspaceDecision } from "@/lib/airspace/types";
import { formatDateTime } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { ZONE_FILL } from "@/lib/maps/zone-palette";

/**
 * The airspace decision, **re-run now** and shown to the reviewer.
 *
 * This is the whole reason `/admin/bookings/[id]` is not just the pilot's page
 * with two buttons bolted on. `booking.decisionSnapshot` records what was true
 * when the pilot asked; between then and now a closure may have been published
 * or a registration may have lapsed, and a reviewer approving from the stored
 * snapshot would be authorising a flight against facts that have expired.
 *
 * **It is a preview, not the authority.** `approveBooking` runs the identical
 * `buildContextForBooking` + `evaluateAirspace` pair *inside* the approving
 * transaction and refuses on its own answer, so the two can legitimately
 * disagree if something changes in the seconds between. When they do, the
 * reviewer sees the transactional refusal in the decision panel — which renders
 * the same `DecisionReasons` this does, so the refusal reads identically
 * whichever half produced it.
 *
 * The colours are `ZONE_FILL`, the map's own palette, so "denied" is the same
 * red on the reviewer's screen as on the map the pilot was refused by.
 */

const STATUS_FILL: Record<AirspaceDecision["status"], string> = {
  allowed: ZONE_FILL.permitted,
  needs_review: ZONE_FILL.restricted,
  denied: ZONE_FILL.no_fly,
};

export function AirspaceRecheck({
  decision,
  locale,
}: {
  /** `null` when the booking's zone could not be resolved into a rule. */
  decision: AirspaceDecision | null;
  locale: Locale;
}) {
  const t = useTranslations("review");
  const tAirspace = useTranslations("airspace");

  if (!decision) {
    /*
      No rule, no evaluation — and **no green tick**. Rendering `allowed` from
      an empty context would be the one lie this screen must never tell, so it
      says what it does not know and warns that approval will refuse.
    */
    return (
      <section className="border-destructive flex flex-col gap-2 rounded-lg border border-s-4 p-5">
        <h2 className="text-lg font-medium">{t("airspaceHeading")}</h2>
        <p className="text-sm">{t("airspaceNoZone")}</p>
      </section>
    );
  }

  const { status } = decision;
  const title =
    status === "allowed"
      ? tAirspace("decisionAllowed")
      : status === "needs_review"
        ? tAirspace("decisionNeedsReview")
        : tAirspace("decisionDenied");

  return (
    <section
      className="bg-card flex flex-col gap-3 rounded-lg border border-s-4 p-5"
      style={{ borderInlineStartColor: STATUS_FILL[status] }}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{t("airspaceHeading")}</h2>
        <p className="text-muted-foreground text-sm">{t("airspaceIntro")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          aria-hidden
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: STATUS_FILL[status] }}
        />
        {/*
          The word, not only the colour. A status carried by a coloured dot
          alone is invisible to anyone who cannot distinguish the colours, and
          this is the one line on the page that decides what the reviewer does.
        */}
        <p className="font-medium">{title}</p>
        <span className="text-muted-foreground text-xs">
          {t("airspaceEvaluatedAt", {
            at: formatDateTime(new Date(decision.evaluatedAt), locale),
          })}
        </span>
      </div>

      {decision.reasons.length > 0 ? (
        <DecisionReasons reasons={decision.reasons} locale={locale} />
      ) : null}

      {status === "denied" ? (
        <p className="text-sm">{t("airspaceDeniedNotice")}</p>
      ) : null}
    </section>
  );
}
