import { RIYADH_OFFSET_MINUTES } from "@/lib/format";

/**
 * The date range every tile and chart on `/admin/analytics` is read through.
 *
 * **Pure, and deliberately free of `server-only`.** The page resolves the range
 * from `searchParams` on the server; the range control is a client component
 * that has to know the same four keys to render the active one. Anything both
 * a Server Component and a `"use client"` module call goes in a plain module —
 * a client module's exports are client *references* and a server page calling
 * one throws at request time with every static check green (thread 59).
 */

export const RANGE_KEYS = ["7", "30", "90", "all"] as const;

export type RangeKey = (typeof RANGE_KEYS)[number];

export const DEFAULT_RANGE: RangeKey = "30";

/**
 * `?range=` is user input and arrives as `string | string[] | undefined`. An
 * array reaching a `gte()` is a runtime error on an admin screen, so it is
 * narrowed here rather than at each of the eight call sites — the same
 * narrowing `/admin/reveals` does for its reviewer filter.
 */
export function toRangeKey(raw: string | string[] | undefined): RangeKey {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (RANGE_KEYS as readonly string[]).includes(value ?? "")
    ? (value as RangeKey)
    : DEFAULT_RANGE;
}

/**
 * The instant the range opens at, or `null` for "all" — which means **no
 * predicate at all**, not a very old date. A `gte(created_at, 1970-01-01)`
 * would still be a predicate the planner has to satisfy, and it would quietly
 * exclude anything with a null timestamp.
 *
 * The boundary is the **start of the Riyadh civil day** N days back, not the
 * instant N×24h ago. A regulator reading "last 7 days" at 09:00 means seven
 * days, not six days and fifteen hours, and a boundary that slides with the
 * clock makes two readings of the same page disagree.
 */
export function rangeStart(key: RangeKey, now: Date = new Date()): Date | null {
  if (key === "all") return null;
  const days = Number(key);

  // Shift into Riyadh civil time, truncate to midnight there, shift back.
  const offsetMs = RIYADH_OFFSET_MINUTES * 60 * 1000;
  const civil = new Date(now.getTime() + offsetMs);
  const civilMidnight = Date.UTC(
    civil.getUTCFullYear(),
    civil.getUTCMonth(),
    civil.getUTCDate(),
  );
  return new Date(civilMidnight - (days - 1) * 86_400_000 - offsetMs);
}

export type Bucket = "day" | "week" | "month";

/**
 * How a time series is grouped for a given range.
 *
 * Ninety daily points on a 640 px plot is under 7 px a point — a reader sees
 * noise, not a trend — and "all" will eventually span years. The bucket is a
 * property of the range rather than a control of its own, because a person
 * choosing a *width* is not also choosing a *grain*, and offering both would
 * let them pick monthly buckets over seven days and see one column.
 */
export function bucketFor(key: RangeKey): Bucket {
  if (key === "7" || key === "30") return "day";
  if (key === "90") return "week";
  return "month";
}
