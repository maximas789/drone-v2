"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { riyadhInstant } from "@/lib/airspace/time";
import type { ZoneRule } from "@/lib/airspace/types";
import { formatAltitude, formatDate, formatMinuteOfDay } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import {
  ALTITUDE_STEP_M,
  GACAR_ALTITUDE_LIMIT_M,
  MAX_ALTITUDE_M,
  dayOptions,
  timeChoicesFor,
} from "@/lib/maps/probe";

/**
 * The three things a pilot can change about the question: how high, which
 * aircraft, and when.
 *
 * **All three are optional, and the map answers without any of them.** Tapping
 * a point with no drone selected and no time chosen is a real question — *is
 * this airspace flyable at all* — and it is the first one most readers have. A
 * control that had to be filled in before the map would say anything would turn
 * the whole surface into a form.
 *
 * Everything here is a **native** `<select>` or `<input type="range">`; see
 * `ui/select.tsx` and `ui/slider.tsx` for why, and open thread 46 for the
 * standing rule against `<input type="date">`.
 */

/** The minimum the selector needs to name a drone. The engine gets more. */
export type DroneOption = {
  id: string;
  /** Already carries the drone's status — see `droneOptionsFor` on the page. */
  label: string;
  /**
   * Read by `AirspaceExplorer` to pick the default, not by this component. A
   * drone that is *not* approved is still selectable on purpose: choosing it is
   * how a pilot finds out that `drone_not_approved` is what stands in their way.
   */
  approved: boolean;
};

/** `null` minute means **any time** — no slot constraint on the query at all. */
export type TimeSelection = { ymd: string; minuteOfDay: number | null };

export function MapControls({
  locale,
  now,
  zone,
  altitudeAglM,
  onAltitudeChange,
  drones,
  droneId,
  onDroneChange,
  time,
  onTimeChange,
}: {
  locale: Locale;
  /** The server's clock, passed down so every control reads one "now". */
  now: Date;
  /**
   * The matched permitted zone, when there is one. It supplies the slot grid
   * and the booking horizon — with no zone the time select still works, it
   * simply has no anchors to mark.
   */
  zone: ZoneRule | null;
  altitudeAglM: number;
  onAltitudeChange: (metres: number) => void;
  drones: readonly DroneOption[];
  droneId: string | null;
  onDroneChange: (droneId: string | null) => void;
  time: TimeSelection;
  onTimeChange: (time: TimeSelection) => void;
}) {
  const t = useTranslations("map");
  const altitudeId = useId();
  const droneId_ = useId();
  const dayId = useId();
  const timeId = useId();

  const days = dayOptions(now, zone?.maxAdvanceDays);
  const { slotMinutes, otherMinutes } = timeChoicesFor(zone, time.ymd);

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="flex flex-col gap-2 sm:col-span-2">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={altitudeId}>{t("altitude")}</Label>
          {/**
           * The value is `dir="ltr"` because it is a measurement: `120 m` must
           * not be read right-to-left into `m 120`.
           */}
          <output htmlFor={altitudeId} dir="ltr" className="text-sm tabular-nums">
            {formatAltitude(altitudeAglM, locale)}
          </output>
        </div>
        <Slider
          id={altitudeId}
          min={0}
          max={MAX_ALTITUDE_M}
          step={ALTITUDE_STEP_M}
          value={altitudeAglM}
          aria-valuetext={formatAltitude(altitudeAglM, locale)}
          onChange={(event) => onAltitudeChange(Number(event.target.value))}
        />
        {/**
         * **The GACAR limit is marked, not enforced.** The engine refuses on the
         * *zone's* ceiling, which is sometimes lower; a slider that stopped at
         * 120 m would hide that a zone caps you at 80, and one that said nothing
         * would let a pilot drift past the national limit without noticing.
         */}
        <p className="text-muted-foreground text-xs">
          {t("altitudeLimitNote", {
            limit: formatAltitude(GACAR_ALTITUDE_LIMIT_M, locale),
          })}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={droneId_}>{t("drone")}</Label>
        <Select
          id={droneId_}
          value={droneId ?? ""}
          onChange={(event) => onDroneChange(event.target.value || null)}
          disabled={drones.length === 0}
        >
          <option value="">{t("droneNone")}</option>
          {drones.map((drone) => (
            <option key={drone.id} value={drone.id}>
              {drone.label}
            </option>
          ))}
        </Select>
        <p className="text-muted-foreground text-xs">
          {drones.length === 0 ? t("droneNoneHint") : t("droneHint")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={dayId}>{t("day")}</Label>
          <Select
            id={dayId}
            value={time.ymd}
            onChange={(event) =>
              onTimeChange({ ymd: event.target.value, minuteOfDay: time.minuteOfDay })
            }
          >
            {days.map((ymd) => (
              <option key={ymd} value={ymd}>
                {formatDate(riyadhInstant(ymd, 12 * 60), locale)}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={timeId}>{t("time")}</Label>
          <Select
            id={timeId}
            value={time.minuteOfDay === null ? "" : String(time.minuteOfDay)}
            onChange={(event) =>
              onTimeChange({
                ymd: time.ymd,
                minuteOfDay: event.target.value === "" ? null : Number(event.target.value),
              })
            }
          >
            <option value="">{t("timeAny")}</option>
            {/**
             * Two groups, and the order is the point. The zone's real slot
             * anchors come first because they are the answer to "when could I
             * book this"; everything else follows so that "what about 03:00?"
             * is still a question the map can be asked.
             */}
            {slotMinutes.length > 0 ? (
              <optgroup label={t("timeSlots")}>
                {slotMinutes.map((minute) => (
                  <option key={minute} value={minute}>
                    {formatMinuteOfDay(minute, locale)}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label={t("timeOther")}>
              {otherMinutes.map((minute) => (
                <option key={minute} value={minute}>
                  {formatMinuteOfDay(minute, locale)}
                </option>
              ))}
            </optgroup>
          </Select>
        </div>
      </div>
    </div>
  );
}
