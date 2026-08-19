"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { riyadhWeekdayOf, riyadhYmd } from "@/lib/airspace/time";
import type { ZoneWindow } from "@/lib/airspace/types";
import { formatAltitude, formatMinuteOfDay } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * The zone's rules, restated, and an acknowledgement of them.
 *
 * **The box starts unchecked and there is no "select all".** A pre-ticked
 * acknowledgement is a dark pattern with a signature on it: it records that
 * somebody agreed to rules they were never shown. This one blocks submission
 * until it is ticked, which is the only thing that makes the record worth
 * keeping.
 *
 * **The rules are the zone's own values, not boilerplate.** The ceiling comes
 * from `ceilingAglM`, the hours from this weekday's `zone_hour` rows. A generic
 * "fly safely" paragraph would be the same on a zone capped at 80 m as on one
 * capped at 120, which is exactly the difference a pilot has to acknowledge.
 */
export function SafetyAck({
  ceilingAglM,
  hours,
  ymd,
  nightAllowed,
  checked,
  onChange,
  locale,
}: {
  ceilingAglM: number | null;
  hours: readonly ZoneWindow[];
  /** The chosen day, so the hours shown are the hours being booked. */
  ymd: string;
  nightAllowed: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
  locale: Locale;
}) {
  const t = useTranslations("booking");
  const id = useId();

  const weekday = riyadhWeekdayOf(ymd || riyadhYmd(new Date()));
  const windows = hours
    .filter((window) => window.weekday === weekday)
    .sort((a, b) => a.opensMinute - b.opensMinute);

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2 text-sm">
        <li className="flex flex-wrap justify-between gap-x-4 border-s-2 ps-3">
          <span className="text-muted-foreground">{t("ruleCeiling")}</span>
          <span dir="ltr">
            {ceilingAglM === null
              ? t("ruleCeilingNone")
              : formatAltitude(ceilingAglM, locale)}
          </span>
        </li>
        <li className="flex flex-wrap justify-between gap-x-4 border-s-2 ps-3">
          <span className="text-muted-foreground">{t("ruleHours")}</span>
          <span dir="ltr">
            {windows.length === 0
              ? t("ruleHoursClosed")
              : windows
                  .map(
                    (window) =>
                      `${formatMinuteOfDay(window.opensMinute, locale)} – ${formatMinuteOfDay(window.closesMinute, locale)}`,
                  )
                  .join(", ")}
          </span>
        </li>
        <li className="flex flex-wrap justify-between gap-x-4 border-s-2 ps-3">
          <span className="text-muted-foreground">{t("ruleNight")}</span>
          <span>{nightAllowed ? t("ruleNightAllowed") : t("ruleNightNo")}</span>
        </li>
        {/**
         * VLOS is not a zone column — it is a GACAR rule that holds everywhere,
         * which is why it is stated here as text rather than read from the row.
         */}
        <li className="border-s-2 ps-3">
          <span className="text-muted-foreground">{t("ruleVlos")}</span>
        </li>
      </ul>

      <label
        htmlFor={id}
        className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
      >
        <input
          id={id}
          type="checkbox"
          className="mt-1"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="text-sm">{t("acknowledge")}</span>
      </label>
    </div>
  );
}
