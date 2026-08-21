import { RIYADH_OFFSET_MINUTES } from "@/lib/format";
import type { Bucket } from "./range";

/**
 * Dense time buckets in Riyadh civil time.
 *
 * **Why the buckets are built here and not by the database.** A `GROUP BY
 * date_trunc(...)` returns only the buckets that have rows in them, so a week
 * with no registrations simply does not appear — and a line drawn through the
 * gaps joins the week before it straight to the week after, which reads as
 * "steady" when the truth is "nothing happened". Every chart on the analytics
 * page therefore takes a **complete** key list from this module and maps the
 * query's sparse counts onto it, so an empty bucket is drawn as a zero.
 *
 * **Pure.** No `db`, no `server-only` — it is arithmetic on a fixed +03:00
 * offset, and it is unit-tested rather than trusted.
 *
 * **The key is a `YYYY-MM-DD` string, not a `Date`,** and it is the *same*
 * string the SQL produces with `to_char`. A join on strings cannot be wrong by
 * three hours the way a join on instants can, and the key sorts
 * lexicographically into chronological order for free.
 */

const DAY_MS = 86_400_000;
const OFFSET_MS = RIYADH_OFFSET_MINUTES * 60 * 1000;

/**
 * The civil date parts of an instant in Riyadh, via a fixed offset rather than
 * `Intl`. Saudi Arabia has never observed DST, and `format.ts` has a test
 * pinning that in both January and July.
 */
function civilParts(date: Date): { y: number; m: number; d: number } {
  const shifted = new Date(date.getTime() + OFFSET_MS);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
  };
}

function keyOf(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * The key of the bucket an instant belongs to.
 *
 * **Weeks start on Sunday.** Postgres's `date_trunc('week', …)` starts on
 * *Monday* — an ISO week — so the SQL side shifts by a day on each side of the
 * truncation to match. Getting this wrong moves every Sunday's bookings into
 * the previous week's column, which looks like data rather than like a bug.
 */
export function bucketKey(date: Date, bucket: Bucket): string {
  const { y, m, d } = civilParts(date);
  if (bucket === "month") return keyOf(y, m, 1);
  if (bucket === "day") return keyOf(y, m, d);

  const utc = Date.UTC(y, m, d);
  const weekday = new Date(utc).getUTCDay(); // 0 = Sunday, already what we want
  const sunday = new Date(utc - weekday * DAY_MS);
  return keyOf(
    sunday.getUTCFullYear(),
    sunday.getUTCMonth(),
    sunday.getUTCDate(),
  );
}

/** The instant a bucket key opens at — what a tooltip or an axis label formats. */
export function bucketStart(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) - OFFSET_MS);
}

/**
 * Every bucket key from `from` to `to` inclusive, in order and with no gaps.
 *
 * Guarded at 400 entries. "All" over a database that has been running for a
 * decade is 3,650 daily buckets, and this function is reached from a page
 * render; the guard is a **ceiling on the loop**, not a silent truncation of
 * the data — `bucketFor` already coarsens the grain with the range, so the
 * ceiling is only ever hit by a range that has no sensible chart anyway.
 */
export function bucketKeys(
  from: Date,
  to: Date,
  bucket: Bucket,
): readonly string[] {
  const keys: string[] = [];
  const last = bucketKey(to, bucket);

  let cursor = bucketStart(bucketKey(from, bucket));
  for (let guard = 0; guard < 400; guard += 1) {
    const key = bucketKey(cursor, bucket);
    keys.push(key);
    if (key === last) break;

    if (bucket === "month") {
      // Calendar arithmetic, not "+30 days" — otherwise February eventually
      // produces two buckets with the same key and March produces none.
      const { y, m } = civilParts(cursor);
      cursor = new Date(Date.UTC(y, m + 1, 1) - OFFSET_MS);
    } else {
      cursor = new Date(cursor.getTime() + (bucket === "week" ? 7 : 1) * DAY_MS);
    }
  }
  return keys;
}

/**
 * Turn sparse `(key, …)` rows into a dense array, in bucket order.
 *
 * The rows the database did not return become `empty`, which is the zero of
 * whatever shape the chart wants — a number for a line, a record of build
 * types for a stack.
 */
export function densify<T>(
  keys: readonly string[],
  rows: readonly { key: string; value: T }[],
  empty: () => T,
): readonly { key: string; value: T }[] {
  const found = new Map(rows.map((row) => [row.key, row.value]));
  return keys.map((key) => ({ key, value: found.get(key) ?? empty() }));
}
