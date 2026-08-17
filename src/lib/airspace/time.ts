import { RIYADH_OFFSET_MINUTES } from "@/lib/format";

/**
 * Riyadh civil time, as **arithmetic**.
 *
 * Saudi Arabia is UTC+3 year-round and has never observed DST, so every
 * conversion here is a fixed shift — no `Intl`, no timezone database, no
 * platform difference between the server and whatever browser the map is
 * running in. That determinism is what makes a slot start byte-identical on
 * both sides, which is the only reason the `booking_seat_uniq` index protects
 * anything.
 *
 * `src/lib/format.ts` reaches the real IANA zone through `Intl` for the
 * user-facing side; `time.test.ts` cross-checks this file against it across a
 * full year, so if the fixed-offset assumption ever stops holding, a test says
 * so rather than a pilot arriving three hours early.
 */

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export type RiyadhParts = {
  /** `YYYY-MM-DD`, the Riyadh civil day. Sorts lexicographically. */
  ymd: string;
  /** **0 = Sunday.** The Saudi week starts on Sunday. */
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Minutes from Riyadh-local midnight. */
  minutesOfDay: number;
};

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

/** Riyadh-local fields of an instant, via a fixed +180 shift into UTC space. */
export function riyadhParts(instant: Date): RiyadhParts {
  const shifted = new Date(instant.getTime() + RIYADH_OFFSET_MINUTES * MINUTE_MS);
  return {
    ymd: `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    weekday: shifted.getUTCDay() as RiyadhParts["weekday"],
    minutesOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

export type YearMonthDay = { year: number; month: number; day: number };

/** `2026-03-15` → `{ year: 2026, month: 3, day: 15 }`. Throws on anything else. */
export function parseYmd(ymd: string): YearMonthDay {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) throw new Error(`parseYmd: not a YYYY-MM-DD date: ${ymd}`);
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

/**
 * The instant at `minutesOfDay` on a Riyadh civil day.
 *
 * 06:00 on 2026-03-15 in Riyadh is `2026-03-15T03:00:00.000Z`. This is the one
 * function that decides that, so a slot grid computed in the browser and one
 * computed in the booking transaction cannot land a millisecond apart.
 */
export function riyadhInstant(ymd: string, minutesOfDay: number): Date {
  const { year, month, day } = parseYmd(ymd);
  return new Date(
    Date.UTC(year, month - 1, day) +
      (minutesOfDay - RIYADH_OFFSET_MINUTES) * MINUTE_MS,
  );
}

/**
 * Riyadh midnight to Riyadh midnight, half-open `[start, end)`.
 *
 * **Not UTC midnight.** A 06:00 Riyadh slot is 03:00Z; grouping by the UTC day
 * would move every evening slot into the next day's picker and make three
 * hours of every day quietly unbookable.
 */
export function riyadhDayBounds(ymd: string): { start: Date; end: Date } {
  const start = riyadhInstant(ymd, 0);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** The Riyadh civil day an instant falls on. */
export function riyadhYmd(instant: Date): string {
  return riyadhParts(instant).ymd;
}

/** **0 = Sunday.** */
export function riyadhWeekdayOf(ymd: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return riyadhParts(riyadhInstant(ymd, 12 * 60)).weekday;
}

/** `2026-03-15` + 1 → `2026-03-16`, crossing months and years correctly. */
export function addRiyadhDays(ymd: string, days: number): string {
  return riyadhYmd(new Date(riyadhInstant(ymd, 12 * 60).getTime() + days * DAY_MS));
}

/** Whole Riyadh civil days from `from` to `to`, rounded down. */
export function riyadhDaysBetween(from: Date, to: Date): number {
  const a = riyadhInstant(riyadhYmd(from), 0).getTime();
  const b = riyadhInstant(riyadhYmd(to), 0).getTime();
  return Math.round((b - a) / DAY_MS);
}

// --- Sun ------------------------------------------------------------------

const DEG = Math.PI / 180;
const J2000 = 2451545.0;
/** Standard refraction-corrected solar disc altitude at rise and set. */
const HORIZON_DEG = -0.833;
const OBLIQUITY_DEG = 23.4397;

function julianDay(instant: Date): number {
  return instant.getTime() / DAY_MS + 2440587.5;
}

function fromJulian(julian: number): Date {
  return new Date((julian - 2440587.5) * DAY_MS);
}

export type SunTimes = {
  sunrise: Date;
  sunset: Date;
};

/**
 * Sunrise and sunset for a Riyadh civil day, by the standard solar equation.
 *
 * A **fixed** night window was the alternative and it is wrong by the better
 * part of an hour twice a year: Riyadh sunset runs from about 17:30 in December
 * to about 19:00 in June. A zone that forbids night flight has to mean the
 * actual sky, not a number somebody typed once.
 *
 * Latitude and longitude come from the zone's own geometry, so a zone at the
 * far edge of the city gets its own answer rather than the city centre's.
 */
export function sunTimes(ymd: string, lat: number, lng: number): SunTimes {
  // Noon on the civil day, which is what the day number is counted from.
  const jd = julianDay(riyadhInstant(ymd, 12 * 60));
  const west = -lng;

  const n = Math.round(jd - J2000 - 0.0009 - west / 360);
  const meanSolarNoon = J2000 + 0.0009 + west / 360 + n;

  const anomaly = (357.5291 + 0.98560028 * (meanSolarNoon - J2000)) % 360;
  const centre =
    1.9148 * Math.sin(anomaly * DEG) +
    0.02 * Math.sin(2 * anomaly * DEG) +
    0.0003 * Math.sin(3 * anomaly * DEG);
  const eclipticLongitude = (anomaly + centre + 180 + 102.9372) % 360;

  const transit =
    meanSolarNoon +
    0.0053 * Math.sin(anomaly * DEG) -
    0.0069 * Math.sin(2 * eclipticLongitude * DEG);

  const sinDeclination =
    Math.sin(eclipticLongitude * DEG) * Math.sin(OBLIQUITY_DEG * DEG);
  const cosDeclination = Math.cos(Math.asin(sinDeclination));

  const cosHourAngle =
    (Math.sin(HORIZON_DEG * DEG) - Math.sin(lat * DEG) * sinDeclination) /
    (Math.cos(lat * DEG) * cosDeclination);

  /**
   * Beyond the polar circles the sun may not rise or set at all. Saudi Arabia
   * is nowhere near that, but a zone drawn by hand can hold any coordinate and
   * an `acos` of 1.2 is `NaN`, which would compare false against everything and
   * quietly permit a night flight.
   */
  if (cosHourAngle > 1) {
    // Polar night: treat the whole day as dark.
    const noon = fromJulian(transit);
    return { sunrise: noon, sunset: noon };
  }
  if (cosHourAngle < -1) {
    const { start, end } = riyadhDayBounds(ymd);
    return { sunrise: start, sunset: end };
  }

  const hourAngle = Math.acos(cosHourAngle) / DEG;
  return {
    sunrise: fromJulian(transit - hourAngle / 360),
    sunset: fromJulian(transit + hourAngle / 360),
  };
}

/**
 * True when any part of `[start, end)` falls outside daylight on the Riyadh day
 * the window starts on.
 *
 * Deliberately the **whole** window, not its midpoint: a flight that begins in
 * daylight and ends after sunset is a night operation for the half that matters
 * most.
 */
export function isNightWindow(
  start: Date,
  end: Date,
  lat: number,
  lng: number,
): boolean {
  const { sunrise, sunset } = sunTimes(riyadhYmd(start), lat, lng);
  return start < sunrise || end > sunset;
}
