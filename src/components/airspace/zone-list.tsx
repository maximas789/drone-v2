import { getTranslations } from "next-intl/server";
import type { ZoneRow } from "@/components/airspace/zone-drawing";
import { ZONE_FILL } from "@/components/airspace/zone-drawing";
import { formatAltitude, formatMinuteOfDay, formatWeekday } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * Every active zone, read-only, with the permissions attached to it.
 *
 * **Cards, not a wide table.** A zone carries eight or nine facts and there are
 * twelve of them; a `<table>` of that shape is a horizontal scrollbar at 375 px
 * and an unreadable one at 768. Each zone is a `<dl>` instead, which is what
 * this actually is — a list of term/value pairs — and which reflows.
 *
 * **Hours belong to permitted zones only.** The seed writes `zone_hour` rows
 * for `kind === "permitted"` and nothing else, because a zone you may not fly
 * in has no opening time. So a missing hours block is not a gap in the data,
 * and the card says which of the two it is rather than leaving a silent blank.
 *
 * Nothing here is bookable from this page: booking needs an account, and the
 * airspace engine's answer depends on the aircraft. This is the published rule,
 * not a decision about a flight.
 */

/** A `zone_hour` row, narrowed to what a reader needs. */
export type HourRow = {
  zoneId: string;
  weekday: number;
  opensMinute: number;
  closesMinute: number;
};

/**
 * Permitted first. A pilot opening this page is looking for where they *can*
 * fly; leading with the restricted base would put the answer last.
 */
const KIND_ORDER = ["permitted", "restricted", "no_fly"] as const;

export async function ZoneList({
  zones,
  hours,
  locale,
}: {
  zones: readonly ZoneRow[];
  hours: readonly HourRow[];
  locale: Locale;
}) {
  const t = await getTranslations("zones");
  const tLanding = await getTranslations("landing");
  const tDrones = await getTranslations("drones");
  const tCommon = await getTranslations("common");

  const hoursByZone = new Map<string, HourRow[]>();
  for (const hour of hours) {
    const list = hoursByZone.get(hour.zoneId);
    if (list) list.push(hour);
    else hoursByZone.set(hour.zoneId, [hour]);
  }

  return (
    <div className="flex flex-col gap-10">
      {KIND_ORDER.map((kind) => {
        const inKind = zones.filter((zone) => zone.kind === kind);
        if (inKind.length === 0) return null;

        return (
          <section key={kind} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-3 rounded-sm"
                  style={{ backgroundColor: ZONE_FILL[kind] }}
                />
                <h2 className="text-xl font-semibold">
                  {tLanding(`zoneKinds.${kind}`)}
                </h2>
              </div>
              <p className="text-muted-foreground text-sm">
                {t(`kindExplainer.${kind}`)}
              </p>
            </div>

            <ul className="flex flex-col gap-4">
              {inKind.map((zone) => (
                <li
                  key={zone.id}
                  className="bg-card flex flex-col gap-4 rounded-lg border p-5"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="text-lg font-medium">
                        {locale === "ar" ? zone.nameAr : zone.nameEn}
                      </h3>
                      {/* A code is a code: Latin, LTR, monospace in both. */}
                      <span
                        dir="ltr"
                        className="text-muted-foreground font-mono text-sm"
                      >
                        {zone.code}
                      </span>
                    </div>
                    {(locale === "ar" ? zone.districtAr : zone.districtEn) ? (
                      <p className="text-muted-foreground text-sm">
                        {locale === "ar" ? zone.districtAr : zone.districtEn}
                      </p>
                    ) : null}
                  </div>

                  {(locale === "ar" ? zone.notesAr : zone.notesEn) ? (
                    <p className="text-sm">
                      {locale === "ar" ? zone.notesAr : zone.notesEn}
                    </p>
                  ) : null}

                  {/**
                   * **Permissions belong to permitted zones only**, and that
                   * includes the ceiling.
                   *
                   * Every seeded no-fly zone stores `ceilingAglM: 0` as a
                   * sentinel for "no altitude at all", and printing that under
                   * the heading "Ceiling" turns a prohibition into a limit — it
                   * reads as a number you could fly under. The restricted base
                   * stores `null` for the same reason. Neither is a permission,
                   * so neither is shown as one, and an empty `<dl>` beside them
                   * would be a gap on the page rather than a fact. The kind
                   * explainer above already says what these zones are.
                   */}
                  {zone.kind === "permitted" ? (
                    <>
                      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                        <Fact
                          term={t("ceiling")}
                          value={
                            zone.ceilingAglM === null
                              ? t("ceilingNotApplicable")
                              : formatAltitude(zone.ceilingAglM, locale)
                          }
                        />
                        <Fact
                          term={t("night")}
                          value={zone.nightAllowed ? tCommon("yes") : tCommon("no")}
                        />
                        <Fact
                          term={tDrones("weightClass")}
                          value={
                            zone.maxWeightClass
                              ? t("weightUpTo", {
                                  weight: tDrones(
                                    `weightClasses.${zone.maxWeightClass}`,
                                  ),
                                })
                              : t("anyValue")
                          }
                        />
                        <Fact
                          term={tDrones("buildType")}
                          value={
                            zone.permittedBuildTypes &&
                            zone.permittedBuildTypes.length > 0
                              ? zone.permittedBuildTypes
                                  .map((build) => tDrones(`buildTypes.${build}`))
                                  .join(t("listSeparator"))
                              : t("anyValue")
                          }
                        />
                        {zone.requiresBroadcastRid ? (
                          <Fact
                            term={t("broadcastRequired")}
                            value={tCommon("yes")}
                          />
                        ) : null}
                      </dl>

                      <Hours
                        hours={hoursByZone.get(zone.id) ?? []}
                        locale={locale}
                        heading={t("hours")}
                        emptyLabel={t("hoursUnpublished")}
                        closedLabel={t("closedAllDay")}
                      />
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      {t("hoursNotApplicable")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{term}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

/**
 * A week of opening windows, **Sunday first**, one line per day.
 *
 * A day can have two windows — the seeded zones all do, with a long closed
 * middle against the heat and Friday's split around Jumu'ah — so this joins
 * them rather than showing the first and dropping the rest, which is how an
 * afternoon window quietly disappears from a public timetable.
 */
async function Hours({
  hours,
  locale,
  heading,
  emptyLabel,
  closedLabel,
}: {
  hours: readonly HourRow[];
  locale: Locale;
  heading: string;
  emptyLabel: string;
  closedLabel: string;
}) {
  if (hours.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyLabel}</p>;
  }

  const weekdays = [0, 1, 2, 3, 4, 5, 6] as const;

  return (
    <div className="flex flex-col gap-2 border-t pt-4">
      <h4 className="text-sm font-medium">{heading}</h4>
      {/**
       * **One column, not two.** A two-column week reflows row-major, so the
       * days zig-zag across the grid and the times land in two separate
       * alignments — the eye has to hop to compare Thursday with Friday, which
       * is the exact comparison somebody planning a flight is making. Seven
       * short rows read straight down.
       */}
      <dl className="flex flex-col gap-1">
        {weekdays.map((weekday) => {
          const windows = hours
            .filter((hour) => hour.weekday === weekday)
            .sort((a, b) => a.opensMinute - b.opensMinute);

          return (
            <div key={weekday} className="flex items-baseline gap-4">
              <dt className="text-muted-foreground w-24 shrink-0 text-sm">
                {formatWeekday(weekday, locale)}
              </dt>
              {/**
               * `dir="ltr"` on the times only. `06:00 – 11:00` is a range of
               * numerals, and in an RTL paragraph the bidi algorithm reorders
               * the two ends around the dash — so a zone that opens at 06:00
               * and closes at 11:00 reads as opening at 11:00.
               */}
              <dd dir="ltr" className="text-sm">
                {windows.length === 0
                  ? closedLabel
                  : windows
                      .map(
                        (window) =>
                          `${formatMinuteOfDay(window.opensMinute, locale)} – ${formatMinuteOfDay(
                            window.closesMinute,
                            locale,
                          )}`,
                      )
                      .join(", ")}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
