import { describe, expect, it } from "vitest";
import { riyadhInstant } from "@/lib/airspace/time";
import type { ZoneClosureWindow, ZoneWindow } from "@/lib/airspace/types";
import { STANDARD_HOURS } from "@/lib/seed/zone-hours";
import {
  deriveSlots,
  findAlternativeSlots,
  isClosed,
  isOnGrid,
  slotStates,
  type SlotZone,
} from "./slots";

/** 2026-03-15 is a Sunday — weekday 0, the start of the Saudi week. */
const SUNDAY = "2026-03-15";
/** 2026-03-20 is a Friday, whose two windows straddle Jumu'ah. */
const FRIDAY = "2026-03-20";

const zone = (overrides: Partial<SlotZone> = {}): SlotZone => ({
  capacity: 3,
  slotDurationMinutes: 60,
  minLeadMinutes: 60,
  ...overrides,
});

const hours = (...windows: ZoneWindow[]) => windows;
const window = (
  weekday: ZoneWindow["weekday"],
  opens: number,
  closes: number,
): ZoneWindow => ({
  weekday,
  opensMinute: opens,
  closesMinute: closes,
});

/** The seeded hours, as the engine sees them — every zone gets the same set. */
const SEEDED: ZoneWindow[] = STANDARD_HOURS.map((hour) => ({
  weekday: hour.weekday,
  opensMinute: hour.opensMinute,
  closesMinute: hour.closesMinute,
}));

describe("deriveSlots", () => {
  it("yields 5 hourly slots from a 06:00–11:00 window, starting at 06:00", () => {
    const slots = deriveSlots(zone(), hours(window(0, 360, 660)), SUNDAY);
    expect(slots).toHaveLength(5);
    expect(slots[0].slotStart).toBe(
      riyadhInstant(SUNDAY, 360).toISOString(),
    );
    expect(slots[0].slotStart).toBe("2026-03-15T03:00:00.000Z");
    expect(slots.at(-1)?.slotEnd).toBe("2026-03-15T08:00:00.000Z");
  });

  it("drops the trailing 30 minutes of a 90-minute grid", () => {
    // 06:00–11:00 is 300 minutes; three 90-minute slots fit, the last 30 do not.
    const slots = deriveSlots(
      zone({ slotDurationMinutes: 90 }),
      hours(window(0, 360, 660)),
      SUNDAY,
    );
    expect(slots).toHaveLength(3);
    expect(slots.at(-1)?.slotEnd).toBe(
      riyadhInstant(SUNDAY, 360 + 270).toISOString(),
    );
  });

  it("anchors a day's two windows independently", () => {
    /**
     * Friday's morning window closes at 10:00 for Jumu'ah and the afternoon one
     * opens at 15:30. The afternoon grid starts at **15:30**, not at an offset
     * carried over from 06:00 — a zone's second window is a fresh anchor.
     */
    const slots = deriveSlots(zone(), SEEDED, FRIDAY);
    const starts = slots.map((slot) => slot.slotStart);

    expect(starts).toContain(riyadhInstant(FRIDAY, 6 * 60).toISOString());
    expect(starts).toContain(
      riyadhInstant(FRIDAY, 15 * 60 + 30).toISOString(),
    );
    // 4 in the morning (06:00–10:00), 4 in the afternoon (15:30–19:30 of 20:00).
    expect(slots).toHaveLength(8);
    // Nothing during Jumu'ah.
    expect(starts).not.toContain(riyadhInstant(FRIDAY, 12 * 60).toISOString());
  });

  it("is byte-identical across repeated calls", () => {
    const a = deriveSlots(zone(), SEEDED, SUNDAY);
    const b = deriveSlots(zone(), SEEDED, SUNDAY);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("returns nothing for a weekday with no window", () => {
    expect(deriveSlots(zone(), hours(window(3, 360, 660)), SUNDAY)).toEqual([]);
  });

  it("puts every slot inside the Riyadh civil day it was asked for", () => {
    const slots = deriveSlots(zone(), SEEDED, SUNDAY);
    // The evening window is 15:00–18:00 Riyadh = 12:00–15:00 UTC, still the
    // 15th. The morning one is 03:00Z. Grouping by the UTC day would be wrong
    // for a zone open past 21:00 Riyadh, which is why the grid is Riyadh-local.
    for (const slot of slots) {
      expect(slot.slotStart >= "2026-03-14T21:00:00.000Z").toBe(true);
      expect(slot.slotStart < "2026-03-15T21:00:00.000Z").toBe(true);
    }
  });
});

describe("isOnGrid", () => {
  it("accepts an anchor and refuses a time between anchors", () => {
    expect(isOnGrid(zone(), SEEDED, "2026-03-15T03:00:00.000Z")).toBe(true);
    expect(isOnGrid(zone(), SEEDED, "2026-03-15T03:07:00.000Z")).toBe(false);
  });
});

describe("slotStates", () => {
  const now = riyadhInstant(SUNDAY, 0);
  const slots = deriveSlots(zone(), hours(window(0, 360, 660)), SUNDAY);
  const at = (hour: number) => riyadhInstant(SUNDAY, hour * 60).toISOString();

  it("marks a slot inside a published closure as closed, not available", () => {
    const closures: ZoneClosureWindow[] = [
      {
        startsAt: at(7),
        endsAt: at(9),
        reasonAr: "فعالية",
        reasonEn: "Event",
      },
    ];
    const graded = slotStates({ zone: zone(), slots, closures, now });
    const byStart = new Map(graded.map((slot) => [slot.slotStart, slot.state]));

    expect(byStart.get(at(6))).toBe("available");
    expect(byStart.get(at(7))).toBe("closed");
    expect(byStart.get(at(8))).toBe("closed");
    expect(byStart.get(at(9))).toBe("available");
  });

  it("marks a slot inside minLeadMinutes as past", () => {
    // 05:30 Riyadh, with a 60-minute lead: the 06:00 slot is unreachable.
    const graded = slotStates({
      zone: zone({ minLeadMinutes: 60 }),
      slots,
      now: riyadhInstant(SUNDAY, 5 * 60 + 30),
    });
    const byStart = new Map(graded.map((slot) => [slot.slotStart, slot.state]));
    expect(byStart.get(at(6))).toBe("past");
    expect(byStart.get(at(7))).toBe("available");
  });

  it("marks a slot full only when every seat is held", () => {
    const graded = slotStates({
      zone: zone({ capacity: 2 }),
      slots,
      now,
      availability: [
        { slotStart: at(6), taken: 1 },
        { slotStart: at(7), taken: 2 },
      ],
    });
    const byStart = new Map(graded.map((slot) => [slot.slotStart, slot]));
    expect(byStart.get(at(6))?.state).toBe("available");
    expect(byStart.get(at(6))?.remaining).toBe(1);
    expect(byStart.get(at(7))?.state).toBe("full");
    expect(byStart.get(at(7))?.remaining).toBe(0);
  });

  it("blocks a slot the pilot already holds, even with seats free", () => {
    const graded = slotStates({
      zone: zone(),
      slots,
      now,
      pilotBusySlots: [at(8)],
    });
    const byStart = new Map(graded.map((slot) => [slot.slotStart, slot.state]));
    expect(byStart.get(at(8))).toBe("blocked");
    expect(byStart.get(at(9))).toBe("available");
  });

  it("blocks the whole day once the pilot is at their daily cap", () => {
    const graded = slotStates({
      zone: zone(),
      slots,
      now,
      pilotBookingsOnDay: 2,
      maxSlotsPerPilotPerDay: 2,
    });
    expect(graded.every((slot) => slot.state === "blocked")).toBe(true);
  });

  it("puts past above closed, and blocked above full", () => {
    /**
     * Precedence is not cosmetic. Telling a pilot a slot is full when the real
     * obstacle is their own existing booking sends them hunting for another
     * zone instead of looking at their own diary.
     */
    const graded = slotStates({
      zone: zone({ capacity: 1 }),
      slots,
      now: riyadhInstant(SUNDAY, 5 * 60 + 30),
      closures: [
        { startsAt: at(6), endsAt: at(7), reasonAr: "س", reasonEn: "r" },
      ],
      availability: [{ slotStart: at(8), taken: 1 }],
      pilotBusySlots: [at(8)],
    });
    const byStart = new Map(graded.map((slot) => [slot.slotStart, slot.state]));
    expect(byStart.get(at(6))).toBe("past");
    expect(byStart.get(at(8))).toBe("blocked");
  });
});

describe("isClosed", () => {
  it("counts a closure that overlaps the slot at all", () => {
    const slot = {
      slotStart: "2026-03-15T03:00:00.000Z",
      slotEnd: "2026-03-15T04:00:00.000Z",
    };
    const touching: ZoneClosureWindow = {
      startsAt: "2026-03-15T03:40:00.000Z",
      endsAt: "2026-03-15T06:00:00.000Z",
      reasonAr: "س",
      reasonEn: "r",
    };
    expect(isClosed(slot, [touching])).toBe(true);

    // Abutting exactly is not overlapping: a closure that begins as the slot
    // ends leaves the slot intact.
    expect(
      isClosed(slot, [{ ...touching, startsAt: "2026-03-15T04:00:00.000Z" }]),
    ).toBe(false);
  });
});

describe("findAlternativeSlots", () => {
  it("returns the three nearest free slots", () => {
    const found = findAlternativeSlots({
      zone: zone(),
      hours: SEEDED,
      fromYmd: SUNDAY,
      now: riyadhInstant(SUNDAY, 0),
    });
    expect(found).toHaveLength(3);
    expect(found.map((slot) => slot.slotStart)).toEqual([
      riyadhInstant(SUNDAY, 6 * 60).toISOString(),
      riyadhInstant(SUNDAY, 7 * 60).toISOString(),
      riyadhInstant(SUNDAY, 8 * 60).toISOString(),
    ]);
    expect(found.every((slot) => slot.state === "available")).toBe(true);
  });

  it("crosses into the following day when today has nothing left", () => {
    const found = findAlternativeSlots({
      zone: zone(),
      hours: SEEDED,
      fromYmd: SUNDAY,
      // 19:00 Riyadh: the evening window (15:00–18:00) is over.
      now: riyadhInstant(SUNDAY, 19 * 60),
      count: 1,
    });
    expect(found[0].slotStart).toBe(
      riyadhInstant("2026-03-16", 6 * 60).toISOString(),
    );
  });

  it("skips closed and full slots", () => {
    const at = (hour: number) => riyadhInstant(SUNDAY, hour * 60).toISOString();
    const found = findAlternativeSlots({
      zone: zone({ capacity: 1 }),
      hours: SEEDED,
      fromYmd: SUNDAY,
      now: riyadhInstant(SUNDAY, 0),
      count: 2,
      closures: [
        { startsAt: at(6), endsAt: at(7), reasonAr: "س", reasonEn: "r" },
      ],
      availability: [{ slotStart: at(7), taken: 1 }],
    });
    expect(found.map((slot) => slot.slotStart)).toEqual([at(8), at(9)]);
  });

  it("does not carry today's daily cap into tomorrow", () => {
    /**
     * The cap is per day. Carrying it forward would hide every alternative from
     * exactly the pilot who has hit it and needs one.
     */
    const found = findAlternativeSlots({
      zone: zone(),
      hours: SEEDED,
      fromYmd: SUNDAY,
      now: riyadhInstant(SUNDAY, 0),
      count: 1,
      pilotBookingsOnDay: 2,
      maxSlotsPerPilotPerDay: 2,
    });
    expect(found[0].slotStart).toBe(
      riyadhInstant("2026-03-16", 6 * 60).toISOString(),
    );
  });

  it("gives up rather than scanning forever", () => {
    const found = findAlternativeSlots({
      zone: zone(),
      // A zone with no hours at all has no slot on any day.
      hours: [],
      fromYmd: SUNDAY,
      now: riyadhInstant(SUNDAY, 0),
      maxDays: 30,
    });
    expect(found).toEqual([]);
  });
});
