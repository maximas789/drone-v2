import { describe, expect, it } from "vitest";
import { deriveSlots } from "@/lib/booking/slots";
import {
  MAX_WINDOWS_PER_DAY,
  parseHhMm,
  toHhMm,
  toZoneWindows,
  validateZoneHours,
  type HourWindow,
} from "./zone-hours";

/**
 * The grid's rules, and the one thing the grid exists to stop: a window that
 * looks reasonable and derives no slots.
 */

const window = (
  weekday: HourWindow["weekday"],
  opens: string,
  closes: string,
): HourWindow => ({
  weekday,
  opensMinute: parseHhMm(opens) ?? -1,
  closesMinute: parseHhMm(closes) ?? -1,
});

describe("parseHhMm / toHhMm", () => {
  it("reads a 24-hour clock time as minutes from midnight", () => {
    expect(parseHhMm("06:00")).toBe(360);
    expect(parseHhMm("00:00")).toBe(0);
    expect(parseHhMm("23:59")).toBe(1_439);
    expect(parseHhMm("6:30")).toBe(390);
  });

  it("refuses anything that is not one", () => {
    for (const value of ["", "6", "24:00", "12:60", "12:0", "١٢:٠٠", "12:00 pm"]) {
      expect(parseHhMm(value)).toBeNull();
    }
  });

  it("round-trips through the field value", () => {
    for (const minutes of [0, 90, 360, 1_035, 1_439]) {
      expect(parseHhMm(toHhMm(minutes))).toBe(minutes);
    }
  });

  /** ASCII by construction — this is an input value, never a rendered time. */
  it("emits Latin digits regardless of anything", () => {
    expect(toHhMm(360)).toBe("06:00");
    expect(/^[0-9]{2}:[0-9]{2}$/.test(toHhMm(1_035))).toBe(true);
  });
});

describe("validateZoneHours", () => {
  it("accepts two windows on one Friday, split around Jumu'ah", () => {
    const result = validateZoneHours([
      window(5, "06:00", "11:00"),
      window(5, "14:00", "18:00"),
    ]);
    expect(result.ok).toBe(true);
  });

  it("accepts a window that opens exactly when the previous one closes", () => {
    // Half-open. This pair is how a zone closes for one prayer and reopens.
    const result = validateZoneHours([
      window(0, "06:00", "12:00"),
      window(0, "12:00", "18:00"),
    ]);
    expect(result.ok).toBe(true);
  });

  it("refuses a window that closes before it opens", () => {
    const result = validateZoneHours([window(0, "18:00", "06:00")]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toContain("hour_not_ordered");
  });

  it("refuses a zero-length window", () => {
    const result = validateZoneHours([window(0, "06:00", "06:00")]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toContain("hour_not_ordered");
  });

  it("refuses overlapping windows on the same weekday", () => {
    const result = validateZoneHours([
      window(2, "06:00", "12:00"),
      window(2, "11:00", "18:00"),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toContain("hour_overlap");
  });

  it("does not treat the same clock hours on different weekdays as an overlap", () => {
    const result = validateZoneHours([
      window(0, "06:00", "12:00"),
      window(1, "06:00", "12:00"),
    ]);
    expect(result.ok).toBe(true);
  });

  it("refuses more than the per-day cap", () => {
    const many: HourWindow[] = Array.from(
      { length: MAX_WINDOWS_PER_DAY + 1 },
      (_, index) => ({
        weekday: 3,
        opensMinute: index * 120,
        closesMinute: index * 120 + 60,
      }),
    );
    const result = validateZoneHours(many);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toContain("hour_too_many_per_day");
  });

  it("reports every bad day at once, not the first", () => {
    const result = validateZoneHours([
      window(0, "18:00", "06:00"),
      window(4, "06:00", "12:00"),
      window(4, "10:00", "14:00"),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems).toContain("hour_not_ordered");
      expect(result.problems).toContain("hour_overlap");
    }
  });

  it("sorts what it returns by weekday then opening minute", () => {
    const result = validateZoneHours([
      window(5, "14:00", "18:00"),
      window(0, "06:00", "12:00"),
      window(5, "06:00", "11:00"),
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((w) => [w.weekday, w.opensMinute])).toEqual([
        [0, 360],
        [5, 360],
        [5, 840],
      ]);
    }
  });

  it("refuses a weekday outside Sunday..Saturday", () => {
    const result = validateZoneHours([
      { weekday: 7 as HourWindow["weekday"], opensMinute: 360, closesMinute: 720 },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toContain("hour_weekday_invalid");
  });
});

/**
 * **The reason the preview exists.** A window shorter than one slot is legal by
 * every rule above and produces nothing at all — the failure an admin would
 * otherwise meet at 06:00 on the morning nobody could book.
 */
describe("a legal window that derives no slots", () => {
  it("yields zero slots when the window is shorter than the slot duration", () => {
    const hours = validateZoneHours([window(0, "06:00", "06:45")]);
    expect(hours.ok).toBe(true);
    if (!hours.ok) return;

    // 2026-08-23 is a Sunday.
    const slots = deriveSlots(
      { capacity: 4, slotDurationMinutes: 60, minLeadMinutes: 60 },
      toZoneWindows(hours.value),
      "2026-08-23",
    );
    expect(slots).toEqual([]);
  });

  it("yields the tail-less grid when it does not divide evenly", () => {
    const hours = validateZoneHours([window(0, "06:00", "08:30")]);
    expect(hours.ok).toBe(true);
    if (!hours.ok) return;

    const slots = deriveSlots(
      { capacity: 4, slotDurationMinutes: 60, minLeadMinutes: 60 },
      toZoneWindows(hours.value),
      "2026-08-23",
    );
    expect(slots).toHaveLength(2);
  });
});
