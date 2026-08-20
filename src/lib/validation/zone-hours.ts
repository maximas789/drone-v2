import type { ZoneWindow } from "@/lib/airspace/types";

/**
 * The operating-hours grid's rules — **pure, and shared by the grid and the
 * action.**
 *
 * Same split as `validation/zone.ts`: the grid runs these as you type because
 * that is a kinder way to find out, and `setZoneHoursAction` runs the identical
 * ones as the authority, because a server action is an ordinary POST and a
 * disabled button is not a check.
 *
 * **Sunday is 0.** The Saudi week starts on Sunday, the `zone_hour.weekday`
 * column says so, and `riyadhWeekdayOf` in the airspace engine agrees. A grid
 * that started on Monday would be a fourth opinion about which day is which.
 */

export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Minutes in a day. A window never reaches it — `24:00` is not a time of day. */
export const MINUTES_IN_DAY = 24 * 60;

/**
 * At most this many windows on one weekday.
 *
 * Two is the real-world number — every seeded zone splits Friday around
 * Jumu'ah — and four leaves room for a zone that closes over both midday
 * prayers without turning the grid into a spreadsheet.
 */
export const MAX_WINDOWS_PER_DAY = 4;

export type HourWindow = {
  weekday: Weekday;
  opensMinute: number;
  closesMinute: number;
};

export type HourProblem =
  | "hour_weekday_invalid"
  | "hour_out_of_range"
  | "hour_not_ordered"
  | "hour_overlap"
  | "hour_too_many_per_day";

export type HourValidation =
  | { ok: true; value: HourWindow[] }
  | { ok: false; problems: HourProblem[] };

/**
 * `"06:00"` → `360`. `null` for anything that is not a 24-hour clock time.
 *
 * Written by hand rather than with `Date.parse`, for the reason thread 46
 * records about `<input type="date">`: anything that goes near a locale-aware
 * parser starts reading the *browser's* calendar. These are minutes on a dial,
 * not an instant, and the only correct parse is arithmetic.
 */
export function parseHhMm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * `360` → `"06:00"`, for the value of an `<input>` — **not for display.**
 *
 * Rule 6 owns what a person reads: `formatMinuteOfDay` in `src/lib/format.ts`
 * is what puts an opening time on a screen. This is the machine-readable half
 * that goes back into the field the admin is typing in, and it is ASCII by
 * construction so it round-trips through `parseHhMm` unchanged.
 */
export function toHhMm(minutes: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_IN_DAY, Math.trunc(minutes)));
  const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
  const mm = String(clamped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * The whole week, checked at once.
 *
 * Three refusals, and each one is a window that would otherwise produce a grid
 * nobody can explain:
 *
 * - **`closes <= opens`** — a window that crosses midnight. `deriveSlots` walks
 *   `opensMinute` upwards until the next slot no longer fits inside
 *   `closesMinute`, so a wrapped window yields *nothing* rather than an evening.
 *   Split it into two windows, which the grid can hold.
 * - **Overlapping windows on the same weekday** — two grids anchored at
 *   different minutes over the same hour, producing two different slot starts
 *   for the same airspace and two seats where there is one. The
 *   `zone_hour_uniq` index only catches the identical-open case; this catches
 *   the rest.
 * - **More than `MAX_WINDOWS_PER_DAY`** — a cap, not a judgement.
 *
 * Every problem in the week is returned, deduplicated: an admin who filled in
 * Sunday and Friday wrongly should be told about both rather than discovering
 * the second after fixing the first.
 */
export function validateZoneHours(
  windows: readonly HourWindow[],
): HourValidation {
  const problems = new Set<HourProblem>();

  for (const window of windows) {
    if (!(WEEKDAYS as readonly number[]).includes(window.weekday)) {
      problems.add("hour_weekday_invalid");
    }
    for (const minute of [window.opensMinute, window.closesMinute]) {
      if (!Number.isInteger(minute) || minute < 0 || minute > MINUTES_IN_DAY) {
        problems.add("hour_out_of_range");
      }
    }
    if (window.closesMinute <= window.opensMinute) {
      problems.add("hour_not_ordered");
    }
  }

  for (const weekday of WEEKDAYS) {
    const day = windows
      .filter((window) => window.weekday === weekday)
      .sort((a, b) => a.opensMinute - b.opensMinute);

    if (day.length > MAX_WINDOWS_PER_DAY) problems.add("hour_too_many_per_day");

    for (let i = 1; i < day.length; i++) {
      /**
       * Half-open, so a window closing at 12:00 and the next opening at 12:00
       * do **not** overlap. That pair is how a zone closes for one prayer and
       * reopens, and refusing it would make the common case unexpressible.
       */
      if (day[i].opensMinute < day[i - 1].closesMinute) problems.add("hour_overlap");
    }
  }

  if (problems.size > 0) return { ok: false, problems: [...problems] };

  return {
    ok: true,
    value: [...windows].sort(
      (a, b) => a.weekday - b.weekday || a.opensMinute - b.opensMinute,
    ),
  };
}

/** The engine's window shape. Identical fields; the names are the contract. */
export function toZoneWindows(windows: readonly HourWindow[]): ZoneWindow[] {
  return windows.map((window) => ({
    weekday: window.weekday,
    opensMinute: window.opensMinute,
    closesMinute: window.closesMinute,
  }));
}
