import { RIYADH_OFFSET_MINUTES } from "@/lib/format";

/**
 * When a cron expression next fires, in Riyadh.
 *
 * **Pure**, and deliberately **not a general cron parser**. It understands the
 * shapes `CRON_SCHEDULES` actually contains — a literal minute, a literal hour,
 * `*`, and a step form such as every-15-minutes — over the day, month and
 * weekday fields being `*`. Anything
 * else returns `null`, which the page renders as "not shown" rather than as a
 * time.
 *
 * That refusal is the point. A parser that quietly mishandles `0 3 * * 1` would
 * print a confident wrong answer to *"did the expiry sweep run last night, and
 * when is the next one?"* — the single question this panel exists to answer. A
 * blank is recoverable; a wrong timestamp is not, because nobody re-checks it.
 * The day somebody adds a weekday schedule, they get a blank and this comment.
 *
 * **Riyadh is a fixed +3 with no DST**, which is what makes this tractable
 * without a timezone library: the wall clock is `utc + 180 minutes`, always.
 * `riyadhCron` prefixes `TZ=Asia/Riyadh` for Inngest's benefit; the offset here
 * is the same fact, and `RIYADH_OFFSET_MINUTES` is its one home.
 */

const MINUTE_MS = 60_000;

/** `*`, `7`, or `*​/15` — over a field of `size` values starting at 0. */
function matches(field: string, value: number): boolean | null {
  if (field === "*") return true;
  if (/^\d+$/.test(field)) return Number(field) === value;
  const step = /^\*\/(\d+)$/.exec(field);
  if (step) {
    const n = Number(step[1]);
    return n > 0 ? value % n === 0 : null;
  }
  // A list, a range, a name — understood by cron and not by this.
  return null;
}

/**
 * `nextCronRun("0 3 * * *", now)` → the next instant it fires.
 *
 * Returns `null` for an expression this does not fully understand, and for one
 * whose day/month/weekday fields are anything but `*`.
 */
export function nextCronRun(expression: string, now: Date): Date | null {
  // `TZ=Asia/Riyadh 0 3 * * *` — the prefix `riyadhCron` adds.
  const withoutTz = expression.replace(/^TZ=\S+\s+/, "");
  const fields = withoutTz.trim().split(/\s+/);
  if (fields.length !== 5) return null;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  if (dayOfMonth !== "*" || month !== "*" || dayOfWeek !== "*") return null;

  /**
   * Walk forward a minute at a time from the next whole minute. **Bounded at
   * one day**: every expression this accepts fires at least daily, so failing
   * to find a match inside 24 hours means the expression was not understood
   * after all — and returning `null` then is better than looping.
   */
  const start = Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS + MINUTE_MS;
  for (let i = 0; i <= 24 * 60; i += 1) {
    const instant = start + i * MINUTE_MS;
    // Riyadh wall clock: shift the instant, then read it in UTC.
    const riyadh = new Date(instant + RIYADH_OFFSET_MINUTES * MINUTE_MS);
    const m = matches(minute, riyadh.getUTCMinutes());
    const h = matches(hour, riyadh.getUTCHours());
    if (m === null || h === null) return null;
    if (m && h) return new Date(instant);
  }
  return null;
}
