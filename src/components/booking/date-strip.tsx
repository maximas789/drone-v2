"use client";

import { useTranslations } from "next-intl";
import { riyadhInstant } from "@/lib/airspace/time";
import { formatNumber, formatWeekday } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { riyadhWeekday } from "@/lib/format";

/**
 * The booking horizon, one button per day.
 *
 * **Exactly `maxAdvanceDays` days, taken from the zone.** A strip that offered
 * more would let a pilot pick a day the engine then refuses with
 * `booking_too_far_ahead` — a control manufacturing its own refusal, which is
 * the same mistake the map's day select avoids.
 *
 * It scrolls rather than wrapping. Fourteen days wrapped into three rows at
 * 375 px stops reading as a horizon and starts reading as a calendar, and a
 * calendar invites a pilot to look for a month that is not there.
 */
export function DateStrip({
  days,
  selected,
  onSelect,
  locale,
}: {
  /** `YYYY-MM-DD` Riyadh civil days, ascending from today. */
  days: readonly string[];
  selected: string;
  onSelect: (ymd: string) => void;
  locale: Locale;
}) {
  const t = useTranslations("booking");

  return (
    <div
      role="group"
      aria-label={t("dayStripLabel")}
      // `overflow-x-auto` with the scrollbar left visible: a strip that can
      // scroll and does not say so is a strip whose later days nobody finds.
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2"
    >
      {days.map((ymd, index) => {
        const noon = riyadhInstant(ymd, 12 * 60);
        const isSelected = ymd === selected;
        return (
          <button
            key={ymd}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(ymd)}
            className={[
              "flex min-w-16 shrink-0 flex-col items-center gap-0.5 rounded-lg border px-3 py-2 transition-colors",
              isSelected
                ? "border-primary ring-3 ring-ring/40"
                : "hover:border-ring cursor-pointer",
            ].join(" ")}
          >
            <span className="text-muted-foreground text-xs">
              {index === 0
                ? t("today")
                : formatWeekday(riyadhWeekday(noon), locale)}
            </span>
            {/**
             * The day number only. The month is in the heading above the strip,
             * because repeating it fourteen times is fourteen chances to read
             * the wrong one.
             */}
            <span className="text-lg font-medium tabular-nums">
              {formatNumber(Number(ymd.slice(8, 10)), locale)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
