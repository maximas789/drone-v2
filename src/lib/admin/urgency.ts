/**
 * The booking queue's arithmetic — **how soon is this flight?**
 *
 * The drone queue asks how long a submission has been *waiting*
 * (`src/lib/admin/queue.ts`); a booking queue asks the opposite question. A
 * request made this morning for a slot in two hours is more urgent than one
 * made three weeks ago for a slot next month, so ordering a booking queue by
 * age alone puts the wrong row at the top.
 *
 * Pure, and tested as such: no database, no session, no React, no locale. The
 * countdown a reviewer reads is assembled at render from
 * `src/lib/dashboard/countdown.ts` — the same two functions the pilot's
 * dashboard uses, so the two screens can never disagree about how long is left.
 */

/**
 * A slot starting inside this window is flagged. Twenty-four hours, because a
 * reviewer who arrives tomorrow morning has already missed it.
 *
 * A product decision, like `AGE_FLAG_DAYS`. Nothing in GACA's documents sets a
 * review turnaround.
 */
export const IMMINENT_HOURS = 24;

/** The upper edge of "this week's problem". Beyond it, `later`. */
export const SOON_HOURS = 72;

const HOUR_MS = 60 * 60 * 1000;

/**
 * `all` is a real member so the filter control has a value for "no filter" and
 * the URL can say so explicitly — same reasoning as `AGE_BUCKETS`.
 *
 * `past` exists because a pending booking **can** outlive its slot: nothing
 * sweeps an undecided request when its window closes, and a queue that quietly
 * hid those rows would be hiding the app's own failure to answer in time.
 */
export const URGENCY_BUCKETS = ["all", "past", "imminent", "soon", "later"] as const;
export type UrgencyBucket = (typeof URGENCY_BUCKETS)[number];

export function isUrgencyBucket(value: unknown): value is UrgencyBucket {
  return (
    typeof value === "string" &&
    (URGENCY_BUCKETS as readonly string[]).includes(value)
  );
}

/**
 * Milliseconds until the slot opens. **Signed** — negative means the slot has
 * already started, and that sign is the whole of `past`.
 */
export function msUntil(slotStart: Date, now: Date): number {
  return slotStart.getTime() - now.getTime();
}

/** Hours until the slot, floored, and negative once it has begun. */
export function hoursUntil(slotStart: Date, now: Date): number {
  return Math.floor(msUntil(slotStart, now) / HOUR_MS);
}

/**
 * Which bucket a slot falls in. Closed at the bottom, open at the top, so every
 * instant lands in exactly one: `past` is anything already started, `imminent`
 * is under `IMMINENT_HOURS`, `soon` runs to `SOON_HOURS`, `later` is the rest.
 */
export function urgencyBucketOf(
  slotStart: Date,
  now: Date,
): Exclude<UrgencyBucket, "all"> {
  const ms = msUntil(slotStart, now);
  if (ms <= 0) return "past";
  if (ms < IMMINENT_HOURS * HOUR_MS) return "imminent";
  if (ms < SOON_HOURS * HOUR_MS) return "soon";
  return "later";
}

/**
 * Worth interrupting a reviewer over: the slot is within a day, or it has
 * already gone by with nobody having decided it. Both are failures of the
 * queue, and both are rendered as a destructive badge rather than as a colour.
 */
export function isUrgent(slotStart: Date, now: Date): boolean {
  const bucket = urgencyBucketOf(slotStart, now);
  return bucket === "imminent" || bucket === "past";
}

export function matchesUrgency(
  bucket: UrgencyBucket,
  slotStart: Date,
  now: Date,
): boolean {
  return bucket === "all" || urgencyBucketOf(slotStart, now) === bucket;
}
