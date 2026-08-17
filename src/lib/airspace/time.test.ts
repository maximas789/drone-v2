import { describe, expect, it } from "vitest";
import { riyadhDayKey, riyadhWeekday } from "@/lib/format";
import {
  addRiyadhDays,
  isNightWindow,
  riyadhDayBounds,
  riyadhDaysBetween,
  riyadhInstant,
  riyadhParts,
  riyadhWeekdayOf,
  sunTimes,
} from "./time";

/**
 * Riyadh, roughly the centre of the modelled airspace — as **(lat, lng)**,
 * because that is the argument order `sunTimes` takes. Geometry is `[lng, lat]`
 * everywhere else in this codebase; the sun equation is not geometry.
 */
const RIYADH_LATLNG: [number, number] = [24.7113, 46.6753];

describe("the fixed +03:00 assumption", () => {
  /**
   * This file does Riyadh time as arithmetic so it is identical in a browser
   * and on a server. `src/lib/format.ts` goes through `Intl` and the real IANA
   * zone. **They must agree on every day of the year** — if Saudi Arabia ever
   * adopted DST, this is the test that would fail rather than a pilot arriving
   * an hour late.
   */
  it("agrees with the IANA zone on every day of a year", () => {
    let cursor = new Date("2026-01-01T00:00:00.000Z");
    for (let day = 0; day < 366; day++) {
      // Mid-morning and late evening: the two times a one-hour shift would move
      // across a civil-day boundary.
      for (const hour of [7, 22]) {
        const instant = new Date(cursor.getTime() + hour * 3_600_000);
        expect(riyadhParts(instant).ymd).toBe(riyadhDayKey(instant));
        expect(riyadhParts(instant).weekday).toBe(riyadhWeekday(instant));
      }
      cursor = new Date(cursor.getTime() + 86_400_000);
    }
  });
});

describe("riyadhInstant", () => {
  it("puts 06:00 Riyadh at 03:00Z", () => {
    expect(riyadhInstant("2026-03-15", 6 * 60).toISOString()).toBe(
      "2026-03-15T03:00:00.000Z",
    );
  });

  it("is byte-identical across repeated calls", () => {
    const first = riyadhInstant("2026-03-15", 15 * 60 + 30).toISOString();
    const second = riyadhInstant("2026-03-15", 15 * 60 + 30).toISOString();
    expect(first).toBe(second);
    expect(first).toBe("2026-03-15T12:30:00.000Z");
  });

  it("round-trips through riyadhParts", () => {
    const instant = riyadhInstant("2026-11-03", 19 * 60 + 45);
    expect(riyadhParts(instant)).toMatchObject({
      ymd: "2026-11-03",
      minutesOfDay: 19 * 60 + 45,
    });
  });
});

describe("the day grid", () => {
  it("runs Riyadh midnight to Riyadh midnight, not UTC midnight", () => {
    const { start, end } = riyadhDayBounds("2026-03-15");
    expect(start.toISOString()).toBe("2026-03-14T21:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-15T21:00:00.000Z");
  });

  it("keeps a 06:00 slot on the day a pilot would look for it", () => {
    const slot = riyadhInstant("2026-03-15", 6 * 60);
    const { start, end } = riyadhDayBounds("2026-03-15");
    expect(slot >= start && slot < end).toBe(true);

    // The UTC day of that instant is the 15th too — but a 22:00 Riyadh slot is
    // the case that separates the two, and it must stay on the 15th.
    const evening = riyadhInstant("2026-03-15", 22 * 60);
    expect(evening.toISOString()).toBe("2026-03-15T19:00:00.000Z");
    expect(evening < end).toBe(true);
  });
});

describe("weekdays and day arithmetic", () => {
  it("counts Sunday as 0", () => {
    // 2026-03-15 is a Sunday.
    expect(riyadhWeekdayOf("2026-03-15")).toBe(0);
    expect(riyadhWeekdayOf("2026-03-20")).toBe(5); // Friday
  });

  it("crosses months and years", () => {
    expect(addRiyadhDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addRiyadhDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addRiyadhDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("counts whole Riyadh days, not 24-hour blocks", () => {
    // 23:00 on the 15th to 01:00 on the 16th is two hours and one civil day.
    const from = riyadhInstant("2026-03-15", 23 * 60);
    const to = riyadhInstant("2026-03-16", 60);
    expect(riyadhDaysBetween(from, to)).toBe(1);
  });
});

describe("sunTimes", () => {
  const minutesRiyadh = (instant: Date) => riyadhParts(instant).minutesOfDay;

  it("puts Riyadh sunrise and sunset where they actually are", () => {
    /**
     * Published Riyadh times, to the nearest minute: 21 December 06:34 / 17:07,
     * 21 June 05:11 / 18:44, equinox 05:59 / 18:05. A ten-minute band around
     * each — tighter than the error a fixed night window would carry, which is
     * the reason this equation is here at all.
     */
    const within = (instant: Date, hour: number, minute: number) => {
      expect(
        Math.abs(minutesRiyadh(instant) - (hour * 60 + minute)),
      ).toBeLessThanOrEqual(10);
    };

    const winter = sunTimes("2026-12-21", ...RIYADH_LATLNG);
    within(winter.sunrise, 6, 34);
    within(winter.sunset, 17, 7);

    const summer = sunTimes("2026-06-21", ...RIYADH_LATLNG);
    within(summer.sunrise, 5, 11);
    within(summer.sunset, 18, 44);

    const equinox = sunTimes("2026-03-20", ...RIYADH_LATLNG);
    within(equinox.sunrise, 5, 59);
    within(equinox.sunset, 18, 5);
  });

  it("gives a longer day in June than in December", () => {
    const winter = sunTimes("2026-12-21", ...RIYADH_LATLNG);
    const summer = sunTimes("2026-06-21", ...RIYADH_LATLNG);
    const length = (times: { sunrise: Date; sunset: Date }) =>
      times.sunset.getTime() - times.sunrise.getTime();
    expect(length(summer)).toBeGreaterThan(length(winter) + 2 * 3_600_000);
  });

  it("stays on the requested civil day all year", () => {
    for (const ymd of ["2026-01-15", "2026-04-15", "2026-08-15", "2026-11-15"]) {
      const { sunrise, sunset } = sunTimes(ymd, ...RIYADH_LATLNG);
      expect(riyadhParts(sunrise).ymd).toBe(ymd);
      expect(riyadhParts(sunset).ymd).toBe(ymd);
    }
  });
});

describe("isNightWindow", () => {
  it("is false for a window wholly in daylight", () => {
    expect(
      isNightWindow(
        riyadhInstant("2026-03-15", 9 * 60),
        riyadhInstant("2026-03-15", 11 * 60),
        ...RIYADH_LATLNG,
      ),
    ).toBe(false);
  });

  it("is true when the window ends after sunset", () => {
    /**
     * The whole window, not its midpoint: a flight that starts in daylight and
     * lands after dark is a night operation for the half that matters.
     */
    expect(
      isNightWindow(
        riyadhInstant("2026-03-15", 17 * 60),
        riyadhInstant("2026-03-15", 19 * 60),
        ...RIYADH_LATLNG,
      ),
    ).toBe(true);
  });

  it("is true before sunrise", () => {
    expect(
      isNightWindow(
        riyadhInstant("2026-03-15", 4 * 60),
        riyadhInstant("2026-03-15", 6 * 60),
        ...RIYADH_LATLNG,
      ),
    ).toBe(true);
  });
});
