import {
  formatDayMonth,
  formatMonthYear,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { bucketStart } from "./buckets";
import type { Bucket } from "./range";

/**
 * Every string a chart prints, produced in one place.
 *
 * **Nothing on this page formats a number or a date itself.** Rule 6 confines
 * `Intl` to `src/lib/format.ts`; this module is the layer above it that knows
 * *which* formatter a chart axis wants, so a chart component never has a reason
 * to reach past it. That is what keeps the promise the acceptance criteria make
 * — Gregorian dates, Latin numerals, Arabic month names — true on seven charts
 * at once rather than on the six somebody remembered.
 */

/**
 * A bucket key as an axis label. The grain decides the shape: a day drops its
 * year, a month keeps it, and a week is labelled by the Sunday it opens on with
 * a word saying so, because "16 Aug" on a weekly axis reads as a single day.
 */
export function bucketLabel(
  key: string,
  bucket: Bucket,
  locale: Locale,
  weekWord: string,
): string {
  const date = bucketStart(key);
  if (bucket === "month") return formatMonthYear(date, locale);
  if (bucket === "week") return `${weekWord} ${formatDayMonth(date, locale)}`;
  return formatDayMonth(date, locale);
}

/** A count, for an axis tick, a direct label or a table cell. */
export function countLabel(value: number, locale: Locale): string {
  return formatNumber(value, locale);
}

/**
 * A rate, as whole percentage points.
 *
 * The no-show chart's y axis is 0–100 rather than 0–1, so its ticks come
 * through `axisPercentLabel`; this one is for the values themselves.
 */
export function rateLabel(fraction: number, locale: Locale): string {
  return formatPercent(fraction, locale);
}

/** An axis tick on a percentage scale, where the tick is already 0–100. */
export function axisPercentLabel(tick: number, locale: Locale): string {
  return formatPercent(tick / 100, locale);
}
