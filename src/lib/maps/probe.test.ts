import { describe, expect, it } from "vitest";
import { riyadhInstant, riyadhYmd } from "@/lib/airspace/time";
import type { ZoneWindow } from "@/lib/airspace/types";
import {
  DEFAULT_ALTITUDE_M,
  GACAR_ALTITUDE_LIMIT_M,
  MAX_ALTITUDE_M,
  TIME_STEP_MINUTES,
  dayOptions,
  selectionForInstant,
  slotInstants,
  timeChoicesFor,
} from "./probe";

/**
 * The map's controls, tested as arithmetic rather than through a browser.
 *
 * Everything here decides what a pilot is *offered*; the engine decides what
 * they are *allowed*. The failure this suite exists to catch is the quiet one:
 * a control that offers a time the engine will refuse for a reason the control
 * itself created — an off-by-one on the grid, or a day computed in the
 * browser's timezone instead of Riyadh's.
 */

/** Two windows, like every seeded zone: a morning and an afternoon. */
const HOURS: ZoneWindow[] = [
  { weekday: 0, opensMinute: 6 * 60, closesMinute: 10 * 60 },
  { weekday: 0, opensMinute: 15 * 60 + 30, closesMinute: 20 * 60 },
];

const ZONE = {
  capacity: 3,
  slotDurationMinutes: 120,
  minLeadMinutes: 60,
  hours: HOURS,
};

/** A Sunday — weekday 0, the Saudi week's first day. */
const SUNDAY = "2026-08-23";

describe("dayOptions", () => {
  it("starts on the Riyadh day, not the UTC one", () => {
    /**
     * 22:00 UTC on the 22nd is 01:00 on the **23rd** in Riyadh. A picker built
     * on `toISOString().slice(0,10)` would offer yesterday as today for three
     * hours every night, and every slot on it would already be in the past.
     */
    const lateEvening = new Date("2026-08-22T22:00:00.000Z");
    expect(riyadhYmd(lateEvening)).toBe("2026-08-23");
    expect(dayOptions(lateEvening, 2)[0]).toBe("2026-08-23");
  });

  it("returns the horizon plus today, in order, without gaps", () => {
    const days = dayOptions(new Date("2026-08-23T09:00:00.000Z"), 3);
    expect(days).toEqual([
      "2026-08-23",
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
    ]);
  });

  it("crosses a month boundary", () => {
    expect(dayOptions(new Date("2026-08-30T09:00:00.000Z"), 2)).toEqual([
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
    ]);
  });

  it("clamps an absurd horizon rather than building a list of thousands", () => {
    expect(dayOptions(new Date("2026-08-23T09:00:00.000Z"), 10_000)).toHaveLength(
      91,
    );
  });
});

describe("timeChoicesFor", () => {
  it("offers the zone's real grid anchors, both windows, independently", () => {
    const { slotMinutes } = timeChoicesFor(ZONE, SUNDAY);
    /**
     * 06:00 and 08:00 fit the morning window; a third 120-minute slot would end
     * at 12:00 and the window closes at 10:00, so it is not offered. The
     * afternoon restarts at its own anchor — **15:30, not 16:00** — because a
     * window is a fresh anchor rather than an offset from the morning's.
     */
    expect(slotMinutes).toEqual([360, 480, 930, 1050]);
  });

  it("offers every other half hour as well, including the closed ones", () => {
    const { slotMinutes, otherMinutes } = timeChoicesFor(ZONE, SUNDAY);

    // 03:00 — the zone is shut, and asking about it must be possible. That
    // question is what produces `zone_closed_now` and its `nextOpenAt`.
    expect(otherMinutes).toContain(180);
    // The anchors are not repeated in the second group.
    for (const anchor of slotMinutes) expect(otherMinutes).not.toContain(anchor);
    expect(slotMinutes.length + otherMinutes.length).toBe(
      (24 * 60) / TIME_STEP_MINUTES,
    );
  });

  it("has no anchors on a day the zone never opens", () => {
    // Monday. `HOURS` only describes Sunday.
    expect(timeChoicesFor(ZONE, "2026-08-24").slotMinutes).toEqual([]);
  });

  it("has no anchors, and still a full day of times, with no zone matched", () => {
    const { slotMinutes, otherMinutes } = timeChoicesFor(null, SUNDAY);
    expect(slotMinutes).toEqual([]);
    expect(otherMinutes).toHaveLength((24 * 60) / TIME_STEP_MINUTES);
  });
});

describe("selectionForInstant", () => {
  it("turns the engine's nextOpenAt into the two control values", () => {
    // 03:00Z is 06:00 in Riyadh — the morning window's first anchor.
    expect(selectionForInstant("2026-08-23T03:00:00.000Z")).toEqual({
      ymd: "2026-08-23",
      minuteOfDay: 360,
    });
  });

  it("names the Riyadh day, not the UTC one, across midnight", () => {
    /**
     * 21:30Z on the 23rd is 00:30 on the **24th** in Riyadh. Reading the day off
     * the ISO string would send the reader to yesterday and leave the panel
     * offering a fix that does not fix anything.
     */
    expect(selectionForInstant("2026-08-23T21:30:00.000Z")).toEqual({
      ymd: "2026-08-24",
      minuteOfDay: 30,
    });
  });

  it("round-trips with slotInstants", () => {
    const iso = slotInstants(SUNDAY, 930, 120).slotStart;
    const selection = selectionForInstant(iso);
    expect(slotInstants(selection.ymd, selection.minuteOfDay, 120).slotStart).toBe(iso);
  });
});

describe("slotInstants", () => {
  it("reads a Riyadh wall-clock time as the right UTC instant", () => {
    // 06:00 in Riyadh is 03:00Z. Saudi has never observed DST, so this holds
    // in August as in January.
    expect(slotInstants(SUNDAY, 6 * 60, 120).slotStart).toBe(
      "2026-08-23T03:00:00.000Z",
    );
  });

  it("takes the end from the zone's own duration", () => {
    expect(slotInstants(SUNDAY, 6 * 60, 120).slotEnd).toBe(
      "2026-08-23T05:00:00.000Z",
    );
  });

  it("leaves the end to the engine when no zone is matched", () => {
    expect(slotInstants(SUNDAY, 6 * 60, null).slotEnd).toBe(null);
  });

  /**
   * The one that would be silently wrong. A slot the *control* computes has to
   * be the identical millisecond to the one `deriveSlots` computes, or the map
   * shows green for a slot the booking transaction does not believe exists.
   */
  it("agrees to the millisecond with the grid the booking flow derives", () => {
    const { slotMinutes } = timeChoicesFor(ZONE, SUNDAY);
    for (const minute of slotMinutes) {
      const fromControl = slotInstants(SUNDAY, minute, ZONE.slotDurationMinutes);
      expect(fromControl.slotStart).toBe(riyadhInstant(SUNDAY, minute).toISOString());
    }
  });
});

describe("altitude constants", () => {
  it("starts at the GACAR limit rather than at zero or at the maximum", () => {
    expect(DEFAULT_ALTITUDE_M).toBe(GACAR_ALTITUDE_LIMIT_M);
    expect(DEFAULT_ALTITUDE_M).toBeLessThan(MAX_ALTITUDE_M);
  });
});
