/**
 * Operating hours, **weekday 0 = Sunday** — the Saudi working week.
 *
 * The shape of the day is driven by the heat: a morning window, a long closed
 * middle, and an evening window. Friday's two windows are split around Jumu'ah
 * rather than around the heat, which is why the afternoon one opens at 15:30
 * instead of 15:00.
 *
 * Every zone gets two windows on every day, which makes this seed the fixture
 * for double-window slot derivation in F13 — a day is not one range.
 */

export type SeedHour = {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  opensMinute: number;
  closesMinute: number;
};

const at = (hour: number, minute = 0) => hour * 60 + minute;

/** Sunday–Wednesday: work days. Morning, then late afternoon. */
const WEEKDAY: SeedHour[] = ([0, 1, 2, 3] as const).flatMap((weekday) => [
  { weekday, opensMinute: at(6), closesMinute: at(11) },
  { weekday, opensMinute: at(15), closesMinute: at(18) },
]);

/** Thursday: the weekend starts. The evening window runs longer. */
const THURSDAY: SeedHour[] = [
  { weekday: 4, opensMinute: at(6), closesMinute: at(11) },
  { weekday: 4, opensMinute: at(15), closesMinute: at(20) },
];

/**
 * Friday. The morning window **closes at 10:00** and the afternoon one opens at
 * **15:30**, leaving Jumu'ah clear. Getting this wrong would be the kind of
 * mistake that says the product was not built for here.
 */
const FRIDAY: SeedHour[] = [
  { weekday: 5, opensMinute: at(6), closesMinute: at(10) },
  { weekday: 5, opensMinute: at(15, 30), closesMinute: at(20) },
];

const SATURDAY: SeedHour[] = [
  { weekday: 6, opensMinute: at(6), closesMinute: at(11) },
  { weekday: 6, opensMinute: at(15), closesMinute: at(19) },
];

export const STANDARD_HOURS: SeedHour[] = [
  ...WEEKDAY,
  ...THURSDAY,
  ...FRIDAY,
  ...SATURDAY,
];
