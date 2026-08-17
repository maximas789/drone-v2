import {
  addRiyadhDays,
  riyadhInstant,
  riyadhWeekdayOf,
  riyadhYmd,
} from "@/lib/airspace/time";
import type {
  Slot,
  SlotState,
  SlotUsage,
  ZoneClosureWindow,
  ZoneWindow,
} from "@/lib/airspace/types";

/**
 * Slots are **derived, never stored**.
 *
 * Three reasons, in the order they bite. A zone's hours change and
 * pre-generated rows go stale silently — the worst failure mode, because
 * nothing errors. Eight zones × 365 days × a dozen slots is ~35 000 rows a
 * year, almost all of them empty. And capacity is already enforceable on the
 * `booking` table, so slot rows would be a second source of truth for a number
 * the bookings themselves already know.
 *
 * **Pure**, for the same reason `evaluate.ts` is: the picker computes the grid
 * in the browser and the booking transaction computes it again on the server,
 * and if those two disagreed by one millisecond the `booking_seat_uniq` index
 * would be protecting nothing.
 */

/** The shape of a zone this module needs. A subset of `ZoneRule`. */
export type SlotZone = {
  capacity: number;
  slotDurationMinutes: number;
  minLeadMinutes: number;
};

export type DerivedSlot = {
  slotStart: string;
  slotEnd: string;
};

/**
 * The grid for one Riyadh civil day.
 *
 * Each slot starts at `opensMinute + n × slotDurationMinutes` **in Riyadh local
 * time** and is emitted only if it fits entirely inside its window: a 90-minute
 * tail on a 120-minute grid is not a slot, it is 90 minutes of nothing.
 *
 * A day with two windows — every seeded zone has two, and Friday's are split
 * around Jumu'ah — produces **two independent grids**. The afternoon does not
 * continue the morning's numbering, because a window that opens at 15:30 is a
 * fresh anchor, not an offset from 06:00.
 *
 * Closures are not a parameter here. They decide a slot's *state*, not whether
 * it exists — a closed slot still has to render, greyed, or the picker silently
 * loses hours and nobody can tell why.
 */
export function deriveSlots(
  zone: SlotZone,
  hours: readonly ZoneWindow[],
  ymd: string,
): DerivedSlot[] {
  const weekday = riyadhWeekdayOf(ymd);
  const windows = hours
    .filter((window) => window.weekday === weekday)
    .sort((a, b) => a.opensMinute - b.opensMinute);

  const slots: DerivedSlot[] = [];
  for (const window of windows) {
    for (
      let minute = window.opensMinute;
      minute + zone.slotDurationMinutes <= window.closesMinute;
      minute += zone.slotDurationMinutes
    ) {
      slots.push({
        slotStart: riyadhInstant(ymd, minute).toISOString(),
        slotEnd: riyadhInstant(
          ymd,
          minute + zone.slotDurationMinutes,
        ).toISOString(),
      });
    }
  }
  return slots;
}

export type SlotStateInput = {
  zone: SlotZone;
  slots: readonly DerivedSlot[];
  closures?: readonly ZoneClosureWindow[];
  /** One grouped query's worth of seat counts. Absent means zero taken. */
  availability?: readonly SlotUsage[];
  now: Date;
  /** ISO slot starts the pilot already holds, in any zone. */
  pilotBusySlots?: readonly string[];
  /** Seat-holding bookings the pilot already has on this Riyadh day. */
  pilotBookingsOnDay?: number;
  maxSlotsPerPilotPerDay?: number;
};

/**
 * Precedence, from the top: **past** beats everything (nothing can be done
 * about it), then **closed** (the authority has spoken), then **blocked** (a
 * fact about this pilot), then **full** (a fact about the zone).
 *
 * `blocked` sits above `full` on purpose: telling a pilot a slot is full when
 * the reason they cannot take it is their own existing booking sends them to
 * look for a different zone instead of at their own diary.
 */
export function slotStates({
  zone,
  slots,
  closures = [],
  availability = [],
  now,
  pilotBusySlots = [],
  pilotBookingsOnDay = 0,
  maxSlotsPerPilotPerDay,
}: SlotStateInput): Slot[] {
  const taken = new Map(availability.map((row) => [row.slotStart, row.taken]));
  const busy = new Set(pilotBusySlots);
  const atDailyLimit =
    maxSlotsPerPilotPerDay !== undefined &&
    pilotBookingsOnDay >= maxSlotsPerPilotPerDay;
  const earliest = now.getTime() + zone.minLeadMinutes * 60_000;

  return slots.map((slot) => {
    const startMs = Date.parse(slot.slotStart);
    const seatsTaken = taken.get(slot.slotStart) ?? 0;
    const remaining = Math.max(0, zone.capacity - seatsTaken);

    let state: SlotState;
    if (startMs < earliest) {
      state = "past";
    } else if (isClosed(slot, closures)) {
      state = "closed";
    } else if (busy.has(slot.slotStart) || atDailyLimit) {
      state = "blocked";
    } else if (remaining <= 0) {
      state = "full";
    } else {
      state = "available";
    }

    return {
      ...slot,
      state,
      capacity: zone.capacity,
      taken: seatsTaken,
      remaining,
    };
  });
}

/**
 * A closure covers a slot if the two windows overlap **at all** — not only if
 * the slot is wholly inside it. A flight that would start twenty minutes before
 * an airspace closure begins is not a flight that ends politely on time.
 */
export function isClosed(
  slot: DerivedSlot,
  closures: readonly ZoneClosureWindow[],
): boolean {
  const start = Date.parse(slot.slotStart);
  const end = Date.parse(slot.slotEnd);
  return closures.some(
    (closure) =>
      Date.parse(closure.startsAt) < end && Date.parse(closure.endsAt) > start,
  );
}

export type AlternativesInput = Omit<SlotStateInput, "slots"> & {
  /** Riyadh civil day to start scanning from. */
  fromYmd: string;
  hours: readonly ZoneWindow[];
  count?: number;
  /** How far forward to look. The zone's `maxAdvanceDays`, normally. */
  maxDays?: number;
  /** Only slots at or after this instant. Defaults to `now`. */
  after?: Date;
};

/**
 * The nearest free slots forward in time, crossing into following days.
 *
 * **One implementation of "what would work instead."** F12 calls it for
 * `zone_closed_now`, and the losing side of the seat race calls it for
 * `slot_full` — if those were two functions they would drift, and the pilot
 * whose booking just lost a race would be offered a slot the map says is taken.
 *
 * Only the days the caller supplied `availability` for are known to be
 * accurate; a day with no rows is treated as empty, which is the truth for
 * almost every day and a slightly optimistic guess for the rest. The seat index
 * catches the difference at insert time, which is where capacity is decided
 * anyway.
 */
export function findAlternativeSlots({
  fromYmd,
  hours,
  count = 3,
  maxDays = 14,
  after,
  ...state
}: AlternativesInput): Slot[] {
  const floor = (after ?? state.now).getTime();
  const found: Slot[] = [];

  for (let day = 0; day <= maxDays && found.length < count; day++) {
    const ymd = addRiyadhDays(fromYmd, day);
    const graded = slotStates({
      ...state,
      slots: deriveSlots(state.zone, hours, ymd),
      // The daily cap applies to the day it was counted on, not to every day
      // the search walks into. Carrying it forward would hide every alternative
      // from precisely the pilot who needs one.
      pilotBookingsOnDay: day === 0 ? state.pilotBookingsOnDay : 0,
    });

    for (const slot of graded) {
      if (found.length >= count) break;
      if (slot.state !== "available") continue;
      if (Date.parse(slot.slotStart) < floor) continue;
      found.push(slot);
    }
  }

  return found;
}

/** The Riyadh civil day a slot belongs to — the picker's grouping key. */
export function slotDayKey(slotStart: string): string {
  return riyadhYmd(new Date(slotStart));
}

/**
 * Whether an instant is a legal start on this zone's grid. The refusal behind
 * `slot_not_on_grid`, and the reason a hand-crafted POST cannot book 06:07.
 */
export function isOnGrid(
  zone: SlotZone,
  hours: readonly ZoneWindow[],
  slotStart: string,
): boolean {
  const ymd = riyadhYmd(new Date(slotStart));
  return deriveSlots(zone, hours, ymd).some(
    (slot) => slot.slotStart === slotStart,
  );
}
