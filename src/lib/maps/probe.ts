import { addRiyadhDays, riyadhInstant, riyadhYmd } from "@/lib/airspace/time";
import type { ZoneWindow } from "@/lib/airspace/types";
import { deriveSlots, type SlotZone } from "@/lib/booking/slots";

/**
 * The pure half of the map's probe: what the controls may offer, and what a
 * chosen day and time mean as an instant.
 *
 * **Pure for `evaluate.ts`'s reason**, and it matters more here than it looks.
 * The map computes a slot start in the browser and the booking transaction
 * computes it again on the server; if those disagreed by a minute the pilot
 * would be shown a green answer for a slot that does not exist. Everything here
 * therefore goes through the same `riyadhInstant` / `deriveSlots` primitives
 * F13 already uses, rather than a second date arithmetic written for the map.
 */

/**
 * 120 m AGL — the GACAR limit, and the number a pilot should be starting from
 * rather than discovering. Marked on the scale so raising the slider past it is
 * a visible decision.
 */
export const DEFAULT_ALTITUDE_M = 120;
export const GACAR_ALTITUDE_LIMIT_M = 120;

/**
 * The slider stops at 400 m. Not a rule — the engine's ceiling is per zone —
 * but a range: every seeded ceiling is well under it, and a slider that ran to
 * 10 000 m would put the entire useful range in its first two pixels.
 */
export const MAX_ALTITUDE_M = 400;
export const ALTITUDE_STEP_M = 10;

/** Half-hour resolution across the day, which is what the time select offers. */
export const TIME_STEP_MINUTES = 30;
const MINUTES_IN_DAY = 24 * 60;

/**
 * How far ahead the day select goes when no zone is matched yet.
 *
 * Once a zone *is* matched its own `maxAdvanceDays` is the real limit, and
 * `dayOptions` takes it — offering a day the engine will refuse with
 * `booking_too_far_ahead` is a control that manufactures its own refusal.
 */
export const DEFAULT_DAY_HORIZON = 14;

/**
 * Riyadh civil days, starting today. Returned as `YYYY-MM-DD` keys because that
 * is what `deriveSlots` takes and what `riyadhInstant` reads back.
 */
export function dayOptions(
  now: Date,
  horizonDays: number = DEFAULT_DAY_HORIZON,
): string[] {
  const days = Math.max(0, Math.min(horizonDays, 90));
  // Stepped with `addRiyadhDays` rather than by adding 86 400 000 ms, so the
  // sequence is civil days in Riyadh rather than 24-hour blocks measured from
  // whatever time of day the reader happened to open the page.
  const today = riyadhYmd(now);
  const out: string[] = [];
  for (let index = 0; index <= days; index += 1) {
    out.push(addRiyadhDays(today, index));
  }
  return out;
}

export type TimeChoices = {
  /**
   * Minute-of-day anchors that are real slot starts for this zone on this day.
   * Empty when no zone is matched, or when the zone does not open that day.
   */
  slotMinutes: number[];
  /**
   * Every other half hour. **Offered on purpose, not as a leftover.** A pilot
   * has to be able to ask "what about three in the morning?" and be told the
   * zone is closed and when it next opens — that answer is the product. A
   * control that only permitted valid times could never produce it.
   */
  otherMinutes: number[];
};

/**
 * What the time select may offer for one zone on one day.
 *
 * Anchors first, then everything else. An off-grid time inside an opening
 * window is refused with `slot_not_on_grid`, whose fix says *"choose a slot
 * from the grid shown"* — which is only honest if the grid is in fact shown,
 * and it is: it is the group directly above.
 */
export function timeChoicesFor(
  zone: (SlotZone & { hours: readonly ZoneWindow[] }) | null,
  ymd: string,
): TimeChoices {
  const slotMinutes = zone
    ? deriveSlots(zone, zone.hours, ymd).map((slot) =>
        minuteOfRiyadhDay(ymd, slot.slotStart),
      )
    : [];

  const anchors = new Set(slotMinutes);
  const otherMinutes: number[] = [];
  for (let minute = 0; minute < MINUTES_IN_DAY; minute += TIME_STEP_MINUTES) {
    if (!anchors.has(minute)) otherMinutes.push(minute);
  }

  return { slotMinutes, otherMinutes };
}

/**
 * An ISO instant → the day and minute the controls would have to be set to.
 *
 * This is what makes a refusal actionable rather than merely informative: the
 * engine answers a closed zone with `nextOpenAt`, and this turns that answer
 * into one press. Without it the fix text names a time and then leaves the
 * reader to find it in two selects.
 */
export function selectionForInstant(iso: string): {
  ymd: string;
  minuteOfDay: number;
} {
  const instant = new Date(iso);
  const ymd = riyadhYmd(instant);
  return { ymd, minuteOfDay: minuteOfRiyadhDay(ymd, iso) };
}

/**
 * A chosen day and minute-of-day → the pair of ISO instants the engine wants.
 *
 * `slotEnd` comes from the zone's own duration, because that is what the
 * booking would actually reserve. With no zone the end is left `null` and
 * `evaluateAirspace` supplies it — one default, in the engine, rather than a
 * second guess here that could differ.
 */
export function slotInstants(
  ymd: string,
  minuteOfDay: number,
  slotDurationMinutes: number | null,
): { slotStart: string; slotEnd: string | null } {
  const start = riyadhInstant(ymd, minuteOfDay);
  return {
    slotStart: start.toISOString(),
    slotEnd:
      slotDurationMinutes === null
        ? null
        : new Date(start.getTime() + slotDurationMinutes * 60_000).toISOString(),
  };
}

/**
 * Minutes from Riyadh-local midnight of `ymd` to `instant`.
 *
 * Derived by subtraction from `riyadhInstant(ymd, 0)` rather than by reading
 * hours off a `Date`, which would use the *browser's* zone — the one number in
 * this file a laptop set to London would silently get wrong by three hours.
 */
function minuteOfRiyadhDay(ymd: string, instantIso: string): number {
  const midnight = riyadhInstant(ymd, 0).getTime();
  return Math.round((Date.parse(instantIso) - midnight) / 60_000);
}
