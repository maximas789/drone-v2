"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  addRiyadhDays,
  isNightWindow,
  riyadhInstant,
  riyadhYmd,
  sunTimes,
} from "@/lib/airspace/time";
import { deriveSlots } from "@/lib/booking/slots";
import {
  formatNumber,
  formatTime,
  formatWeekday,
  riyadhWeekday,
} from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { toZoneWindows, type HourWindow } from "@/lib/validation/zone-hours";

/**
 * **The slots these hours actually derive**, through the real `deriveSlots`.
 *
 * Not a re-implementation and not an estimate: `deriveSlots` is pure precisely
 * so the picker in the browser, the booking transaction on the server and this
 * preview can all run the identical function. If this drew its own grid, the
 * one number it exists to show — *zero* — could be right here and wrong for a
 * pilot.
 *
 * It is the answer to the failure the feature file names: a window shorter than
 * the slot duration is legal by every rule the grid enforces and produces
 * nothing at all, and without this the admin finds out at 06:00 on the morning
 * nobody could book.
 *
 * **A second thing it shows, which is thread 38's.** The seeded zones open at
 * 06:00 and Riyadh sunrise is 06:34 in December, so a zone with
 * `nightAllowed: false` refuses its own first slot for part of the year. The
 * engine is right — you may not fly before sunrise — but the hours and the rule
 * disagree, and nothing else in the app says so before a pilot meets it. Marked
 * here rather than refused: the hours are not wrong, they are merely optimistic
 * about the sun, and which day it bites depends on the date.
 */

/** A week is the horizon: long enough to reach Friday from any day. */
const PREVIEW_DAYS = 7;

export function SlotPreview({
  windows,
  locale,
  slotDurationMinutes,
  minLeadMinutes,
  capacity,
  nightAllowed,
  centre,
  unsaved,
  invalid,
}: {
  windows: readonly HourWindow[];
  locale: Locale;
  slotDurationMinutes: number;
  minLeadMinutes: number;
  capacity: number;
  nightAllowed: boolean;
  centre: { lat: number; lng: number };
  /** True while the grid holds edits the database has not seen. */
  unsaved: boolean;
  /**
   * True while the week does not validate. The preview then says so instead of
   * deriving from a pruned list — **"no slots" and "these hours are not legal"
   * are different sentences**, and printing the first for the second sends an
   * admin to look at their slot duration when the problem is an overlap two
   * rows above.
   */
  invalid: boolean;
}) {
  const t = useTranslations("zoneAdmin");

  const days = useMemo(() => {
    const today = riyadhYmd(new Date());
    return Array.from({ length: PREVIEW_DAYS }, (_, index) =>
      addRiyadhDays(today, index),
    );
  }, []);
  const [selected, setSelected] = useState(days[0]);

  const slots = useMemo(
    () =>
      deriveSlots(
        { capacity, slotDurationMinutes, minLeadMinutes },
        toZoneWindows(windows),
        selected,
      ),
    [capacity, slotDurationMinutes, minLeadMinutes, windows, selected],
  );

  const sun = useMemo(
    () => sunTimes(selected, centre.lat, centre.lng),
    [selected, centre.lat, centre.lng],
  );

  const marked = useMemo(
    () =>
      slots.map((slot) => ({
        ...slot,
        night:
          !nightAllowed &&
          isNightWindow(
            new Date(slot.slotStart),
            new Date(slot.slotEnd),
            centre.lat,
            centre.lng,
          ),
      })),
    [slots, nightAllowed, centre.lat, centre.lng],
  );

  const nightCount = marked.filter((slot) => slot.night).length;

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-medium">{t("previewHeading")}</h3>
        <p className="text-muted-foreground text-sm">{t("previewIntro")}</p>
        {unsaved ? (
          <p className="text-muted-foreground text-xs">
            {t("previewUnsavedNotice")}
          </p>
        ) : null}
      </div>

      <div
        role="group"
        aria-label={t("previewHeading")}
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2"
      >
        {days.map((ymd) => {
          const noon = riyadhInstant(ymd, 12 * 60);
          const isSelected = ymd === selected;
          return (
            <button
              key={ymd}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelected(ymd)}
              className={[
                "flex min-w-16 shrink-0 flex-col items-center gap-0.5 rounded-lg border px-3 py-2",
                isSelected
                  ? "border-primary ring-ring/40 ring-3"
                  : "hover:border-ring cursor-pointer",
              ].join(" ")}
            >
              <span className="text-muted-foreground text-xs">
                {formatWeekday(riyadhWeekday(noon), locale)}
              </span>
              <span className="text-lg font-medium tabular-nums">
                {formatNumber(Number(ymd.slice(8, 10)), locale)}
              </span>
            </button>
          );
        })}
      </div>

      {invalid ? (
        <p className="text-sm">{t("previewUnavailable")}</p>
      ) : marked.length === 0 ? (
        <p className="text-sm">
          {t("previewNone", {
            duration: formatNumber(slotDurationMinutes, locale),
          })}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            {t("previewCount", { count: formatNumber(marked.length, locale) })}
          </p>
          <ul className="flex flex-wrap gap-2">
            {marked.map((slot) => (
              <li
                key={slot.slotStart}
                title={slot.night ? t("previewNightSlot") : undefined}
                className={[
                  "rounded-md border px-2 py-1 text-xs tabular-nums",
                  slot.night ? "border-destructive text-muted-foreground" : "",
                ].join(" ")}
              >
                {/*
                  `<bdi>` and never `dir="ltr"`: a time range beside Arabic text
                  is a run of neutrals, and forcing the direction on a container
                  that later gains a date reverses it. Thread from F21's
                  `slot-time.tsx`.
                */}
                <bdi>
                  {formatTime(new Date(slot.slotStart), locale)} –{" "}
                  {formatTime(new Date(slot.slotEnd), locale)}
                </bdi>
              </li>
            ))}
          </ul>

          {nightCount > 0 ? (
            <p className="text-sm">
              {t("previewNightNotice", {
                sunrise: formatTime(sun.sunrise, locale),
                sunset: formatTime(sun.sunset, locale),
              })}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
