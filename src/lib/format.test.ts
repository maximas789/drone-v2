import { describe, expect, it } from "vitest";
import {
  RIYADH_OFFSET_MINUTES,
  formatDate,
  formatDateRange,
  formatTime,
  riyadhDayKey,
  riyadhWeekday,
} from "./format";
import { TIME_ZONE } from "./locale";

/**
 * Reads the real UTC offset Intl reports for `Asia/Riyadh` at a given instant.
 */
function offsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    timeZoneName: "longOffset",
  }).formatToParts(date);
  const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) throw new Error(`Unexpected offset format: ${name}`);
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

describe("Riyadh offset", () => {
  // Saudi Arabia has never observed DST. If this ever changes, every slot
  // derivation in F13 is wrong by an hour for part of the year — and this is
  // the test that says so out loud instead of the bookings quietly sliding.
  it("is +180 in January", () => {
    expect(offsetMinutes(new Date("2026-01-15T12:00:00Z"))).toBe(
      RIYADH_OFFSET_MINUTES,
    );
  });

  it("is +180 in July", () => {
    expect(offsetMinutes(new Date("2026-07-15T12:00:00Z"))).toBe(
      RIYADH_OFFSET_MINUTES,
    );
  });
});

describe("formatDate", () => {
  const date = new Date("2026-03-15T09:00:00Z");

  it("uses the Gregorian calendar in Arabic, not Hijri", () => {
    const formatted = formatDate(date, "ar");
    // Hijri would put this in 1447 and append هـ.
    expect(formatted).toContain("2026");
    expect(formatted).not.toContain("هـ");
    expect(formatted).toContain("مارس");
  });

  it("uses Latin numerals in Arabic, not Arabic-Indic", () => {
    const formatted = formatDate(date, "ar");
    expect(formatted).toContain("15");
    expect(formatted).not.toMatch(/[٠-٩]/);
  });

  it("formats English as a Gregorian date too", () => {
    expect(formatDate(date, "en")).toBe("15 March 2026");
  });
});

describe("formatTime", () => {
  // 11:00 UTC is 14:00 in Riyadh.
  const noonish = new Date("2026-03-15T11:00:00Z");

  it("is 24-hour and Riyadh-local in both locales", () => {
    expect(formatTime(noonish, "en")).toBe("14:00");
    expect(formatTime(noonish, "ar")).toContain("14:00");
  });

  it("carries no Arabic-Indic digits", () => {
    expect(formatTime(noonish, "ar")).not.toMatch(/[٠-٩]/);
  });
});

describe("riyadhWeekday", () => {
  it("returns 0 for a Sunday", () => {
    // 2026-03-15 is a Sunday.
    expect(riyadhWeekday(new Date("2026-03-15T09:00:00Z"))).toBe(0);
  });

  it("returns 6 for a Saturday", () => {
    expect(riyadhWeekday(new Date("2026-03-14T09:00:00Z"))).toBe(6);
  });

  it("reads the Riyadh day, not UTC", () => {
    // 22:30 UTC on Saturday is already 01:30 Sunday in Riyadh.
    expect(riyadhWeekday(new Date("2026-03-14T22:30:00Z"))).toBe(0);
  });
});

describe("riyadhDayKey", () => {
  it("rolls over at Riyadh midnight, not UTC midnight", () => {
    expect(riyadhDayKey(new Date("2026-03-14T20:59:00Z"))).toBe("2026-03-14");
    expect(riyadhDayKey(new Date("2026-03-14T21:01:00Z"))).toBe("2026-03-15");
  });
});

describe("formatDateRange", () => {
  it("collapses the date when both ends share a Riyadh day", () => {
    const formatted = formatDateRange(
      new Date("2026-03-15T11:00:00Z"),
      new Date("2026-03-15T13:00:00Z"),
      "en",
    );
    expect(formatted).toBe("15 March 2026, 14:00 – 16:00");
  });

  it("keeps both dates when the window crosses a Riyadh midnight", () => {
    const formatted = formatDateRange(
      new Date("2026-03-15T20:00:00Z"),
      new Date("2026-03-15T22:00:00Z"),
      "en",
    );
    expect(formatted).toContain("15 March 2026");
    expect(formatted).toContain("16 March 2026");
  });
});
