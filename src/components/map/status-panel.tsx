"use client";

import { useTranslations } from "next-intl";
import { DecisionReasons } from "@/components/airspace/decision-reasons";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { riyadhWeekdayOf, riyadhYmd } from "@/lib/airspace/time";
import type { AirspaceDecision, ZoneRule } from "@/lib/airspace/types";
import {
  formatAltitude,
  formatDateTime,
  formatMinuteOfDay,
  formatNumber,
  formatWeekday,
} from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { ZONE_FILL } from "@/lib/maps/zone-palette";

/**
 * The answer to "can I fly here?", in three states.
 *
 * **Three, not two.** `needs_review` is not a shade of allowed and not a soft
 * denial: the query passes every rule but lands in a zone whose `autoApprove`
 * is false, so the honest sentence is *"you may request this and a human will
 * decide"*. Collapsing it into green would promise an authorisation nobody has
 * given; collapsing it into red would hide a route that is open.
 *
 * **A denial always offers something.** Every refusal the engine raises carries
 * its own fix — the next opening for a closed zone, a workable altitude for
 * `above_ceiling`, "pick a point inside a permitted zone" for the default-deny
 * case. `DecisionReasons` renders both halves, and it is shared with F21's
 * booking form precisely so the two cannot drift on what a refusal says.
 *
 * **"Book this zone" carries the answer forward.** The zone, the altitude and
 * the chosen time go into `/bookings/new` as query parameters, so F21's wizard
 * opens on the first question the map has *not* already answered. Nothing is
 * re-asked, and nothing is trusted either: `createBooking` re-runs the whole
 * evaluation over rows it reads itself.
 *
 * It appears for `allowed` and `needs_review` alike. Amber is not a soft
 * refusal — it is a booking a human will decide on — and hiding the control
 * would turn "you may request this" into "you may not".
 */

/** Which token paints the panel's edge and dot. Same three the polygons use. */
const STATUS_FILL: Record<AirspaceDecision["status"], string> = {
  allowed: ZONE_FILL.permitted,
  needs_review: ZONE_FILL.restricted,
  denied: ZONE_FILL.no_fly,
};

export function StatusPanel({
  decision,
  zone,
  locale,
  altitudeAglM,
  confirming,
  onUseNextOpening,
  bookingHref,
}: {
  /** `null` before the first tap — the panel then explains what to do. */
  decision: AirspaceDecision | null;
  /**
   * The full rule for the matched zone. `decision.zone` is a `MatchedZone` and
   * deliberately thin; hours, capacity and the approval mode live here.
   */
  zone: ZoneRule | null;
  locale: Locale;
  altitudeAglM: number;
  /**
   * True while the server's authoritative answer is in flight. The local answer
   * is already shown — this only says it is still being confirmed, because a
   * panel that blanked on every keystroke would be unreadable.
   */
  confirming: boolean;
  /**
   * Moves the time controls to `decision.nextOpenAt`.
   *
   * **This is what turns a fix from advice into an action.** The engine already
   * answers a closed zone with the instant it next opens; naming that instant
   * and then leaving the reader to hunt for it in two selects is most of the
   * way to being unhelpful.
   */
  onUseNextOpening: (iso: string) => void;
  /**
   * `/bookings/new?…` with everything the map already knows, or `null` when
   * there is nothing to book — no zone matched, or the reader is signed out and
   * the wizard would only bounce them to sign-in.
   */
  bookingHref: string | null;
}) {
  const t = useTranslations("map");
  const tAirspace = useTranslations("airspace");

  if (!decision) {
    return (
      <div className="bg-card rounded-lg border p-5">
        <p className="text-muted-foreground text-sm">{t("clickToCheck")}</p>
      </div>
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
      className="bg-card flex flex-col gap-4 rounded-lg border border-s-4 p-5"
      style={{ borderInlineStartColor: STATUS_FILL[status] }}
      aria-live="polite"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          aria-hidden
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: STATUS_FILL[status] }}
        />
        <h2 className="text-lg font-medium">{title}</h2>
        {confirming ? (
          <span className="text-muted-foreground text-xs">{t("confirming")}</span>
        ) : null}
      </header>

      {decision.zone ? (
        <p className="font-medium">
          {locale === "ar" ? decision.zone.nameAr : decision.zone.nameEn}
        </p>
      ) : null}

      {/**
       * The zone's own facts, shown for **allowed and needs-review alike**. A
       * pilot who has just been told a human must approve their flight still
       * needs the ceiling and the hours in order to plan it.
       */}
      {status !== "denied" && zone ? (
        <ZoneFacts zone={zone} locale={locale} altitudeAglM={altitudeAglM} />
      ) : null}

      {status === "needs_review" ? (
        <p className="text-sm">{t("needsReviewNote")}</p>
      ) : null}

      {status === "denied" ? (
        <DecisionReasons reasons={decision.reasons} locale={locale} />
      ) : null}

      {decision.nextOpenAt ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onUseNextOpening(decision.nextOpenAt as string)}
          >
            {t("useNextOpening")}
          </Button>
          {/**
           * Through `format.ts`, so it is Gregorian with Latin numerals in
           * Arabic as well as English — `ar-SA` would otherwise print a Hijri
           * date here, on the one line whose whole job is to name a moment.
           */}
          <span dir="ltr" className="text-muted-foreground text-sm">
            {formatDateTime(new Date(decision.nextOpenAt), locale)}
          </span>
        </div>
      ) : null}

      {status !== "denied" ? (
        bookingHref ? (
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href={bookingHref}>{t("bookThisZone")}</ButtonLink>
            <span className="text-muted-foreground text-sm">
              {zone?.autoApprove === false ? t("bookNoteReview") : t("bookNoteInstant")}
            </span>
          </div>
        ) : (
          // Signed out: the honest next step is an account, not a booking form
          // that would redirect straight to sign-in.
          <p className="text-muted-foreground text-sm">{t("nextStep")}</p>
        )
      ) : null}
    </section>
  );
}

function ZoneFacts({
  zone,
  locale,
  altitudeAglM,
}: {
  zone: ZoneRule;
  locale: Locale;
  altitudeAglM: number;
}) {
  const t = useTranslations("map");

  /**
   * Today's windows, in Riyadh civil time. **Not run through the +3 offset
   * again** — a `zone_hour` is already a Riyadh wall-clock minute, and
   * `formatMinuteOfDay` formats in UTC for exactly that reason (F16b).
   */
  const weekday = riyadhWeekdayOf(riyadhYmd(new Date()));
  const today = zone.hours
    .filter((window) => window.weekday === weekday)
    .sort((a, b) => a.opensMinute - b.opensMinute);

  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      <div className="flex justify-between gap-3 sm:block">
        <dt className="text-muted-foreground">{t("ceiling")}</dt>
        <dd dir="ltr" className="text-start">
          {zone.ceilingAglM === null
            ? t("ceilingNone")
            : formatAltitude(zone.ceilingAglM, locale)}
        </dd>
      </div>

      <div className="flex justify-between gap-3 sm:block">
        <dt className="text-muted-foreground">{t("requestedAltitude")}</dt>
        <dd dir="ltr" className="text-start">
          {formatAltitude(altitudeAglM, locale)}
        </dd>
      </div>

      <div className="flex justify-between gap-3 sm:block">
        <dt className="text-muted-foreground">{t("capacity")}</dt>
        <dd>{t("capacityValue", { count: formatNumber(zone.capacity, locale) })}</dd>
      </div>

      <div className="flex justify-between gap-3 sm:block">
        <dt className="text-muted-foreground">
          {t("hoursToday", { weekday: formatWeekday(weekday, locale) })}
        </dt>
        <dd>
          {today.length === 0 ? (
            t("hoursClosedToday")
          ) : (
            /**
             * `dir="ltr"` on the range: `06:00 – 10:00` inside an Arabic
             * paragraph otherwise reorders into `10:00 – 06:00`, which reads as
             * a zone that opens when it shuts.
             */
            <span dir="ltr" className="text-start">
              {today
                .map(
                  (window) =>
                    `${formatMinuteOfDay(window.opensMinute, locale)} – ${formatMinuteOfDay(window.closesMinute, locale)}`,
                )
                .join(", ")}
            </span>
          )}
        </dd>
      </div>
    </dl>
  );
}
