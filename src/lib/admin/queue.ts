/**
 * The queue's arithmetic and its filters — **pure, and tested as such.**
 *
 * A reviewer queue is mostly a sorting and filtering problem, and none of it
 * needs the database, the session or React. Keeping it here means "is a
 * three-day-old submission flagged?" is answerable by a unit test rather than
 * by seeding a row and looking at a page.
 *
 * Nothing in this file formats anything. Age is returned as a **number of
 * days** and a **bucket code**; the sentence a reviewer reads is assembled at
 * render from the catalogue, with every numeral going through
 * `src/lib/format.ts` first (thread 22 — a bare number reaching an ICU message
 * renders Arabic-Indic digits).
 */

/**
 * A submission waiting longer than this is flagged.
 *
 * Seven days, because that is the point at which a pilot has plausibly given up
 * on hearing back. It is a product decision, not a regulatory one, and nothing
 * in GACA's documents sets it.
 */
export const AGE_FLAG_DAYS = 7;

/**
 * The buckets the age filter offers. `all` is a real member rather than an
 * absent filter so the control has a value for "no filter" and the URL can say
 * so explicitly.
 */
export const AGE_BUCKETS = ["all", "today", "week", "overdue"] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];

export function isAgeBucket(value: unknown): value is AgeBucket {
  return (
    typeof value === "string" && (AGE_BUCKETS as readonly string[]).includes(value)
  );
}

/**
 * Whole days a submission has been waiting.
 *
 * Floored, and **never negative**: a row whose `submittedAt` is a few hundred
 * milliseconds in the future (two clocks, one database) is nought days old, not
 * minus one. A null timestamp is nought too — a drone in the queue always has
 * one, and a queue row that crashed the page over a missing column would be a
 * worse failure than one that shows an age of zero.
 */
export function ageInDays(
  submittedAt: Date | null | undefined,
  now: Date,
): number {
  if (!submittedAt) return 0;
  const ms = now.getTime() - submittedAt.getTime();
  return ms <= 0 ? 0 : Math.floor(ms / 86_400_000);
}

/** Over the flag threshold. Rendered as a warning, not as a different colour. */
export function isOverdue(
  submittedAt: Date | null | undefined,
  now: Date,
): boolean {
  return ageInDays(submittedAt, now) > AGE_FLAG_DAYS;
}

/**
 * Which bucket a submission falls in. The boundaries are closed at the bottom
 * and open at the top, so every age lands in exactly one: `today` is 0 days,
 * `week` is 1…7, `overdue` is 8 and up — the same threshold `isOverdue` uses,
 * derived from it rather than restated, so the badge and the filter can never
 * disagree about what "waiting too long" means.
 */
export function ageBucketOf(
  submittedAt: Date | null | undefined,
  now: Date,
): Exclude<AgeBucket, "all"> {
  const days = ageInDays(submittedAt, now);
  if (days === 0) return "today";
  return days > AGE_FLAG_DAYS ? "overdue" : "week";
}

export function matchesAgeBucket(
  bucket: AgeBucket,
  submittedAt: Date | null | undefined,
  now: Date,
): boolean {
  return bucket === "all" || ageBucketOf(submittedAt, now) === bucket;
}

/**
 * Free-text search over the fields a reviewer actually has to hand: the pilot's
 * name in **either** language, the Remote ID code, and the aircraft's nickname.
 *
 * Case-folded and trimmed, and matched as a substring rather than a prefix —
 * a reviewer handed "31KD" over a radio has the tail of a code, not its start.
 *
 * **Matched in JavaScript, not in SQL.** The queue is bounded by its own limit
 * and is a page of rows, not a table scan; pushing an `ilike` over four joined
 * columns into the query would buy nothing and would put the one piece of this
 * that is worth testing somewhere a test cannot reach it.
 */
export function matchesSearch(
  query: string,
  haystack: ReadonlyArray<string | null | undefined>,
): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return haystack.some(
    (value) => value && value.toLocaleLowerCase().includes(needle),
  );
}
