/**
 * The limits and the window arithmetic. **Pure** — no `server-only`, no `db`,
 * no request context, for the same reason `src/lib/airspace/evaluate.ts` is:
 * arithmetic that a database connection string can veto is arithmetic nobody
 * can unit-test, and this is the half of rate limiting that can be silently
 * wrong.
 *
 * The counter that writes rows lives in `./index.ts`, which re-exports
 * everything here — so callers still write `@/lib/rate-limit` and never need
 * to know about the split.
 */

export type RateLimitRule = {
  /** Window length in seconds. */
  window: number;
  /** Requests allowed inside one window. */
  max: number;
};

export type RateLimitVerdict =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

const MINUTE = 60;
const HOUR = 60 * 60;
const DAY = 24 * 60 * 60;

/**
 * Every limit the app enforces. Later features **import from here** rather
 * than passing their own numbers — a limit invented at a call site is a limit
 * nobody can find again, and two call sites for the same action would drift.
 *
 * Rules are evaluated shortest window first and **stop at the first refusal**,
 * which is why a burst blocked by the per-minute rule does not also burn the
 * daily allowance. Without that, one accidental double-click storm would lock
 * a legitimate pilot out of booking for a whole day — punishing normal use,
 * which is the thing this feature is explicitly not meant to do.
 */
export const LIMITS = {
  /** Two windows: a burst and sustained hoarding are different attacks. */
  "booking.create": [
    { window: MINUTE, max: 3 },
    { window: DAY, max: 20 },
  ],
  /** Stops queue flooding. */
  "drone.submit": [{ window: HOUR, max: 5 }],
  /** Storage cost. */
  "drone.photo": [{ window: HOUR, max: 20 }],
  /** Matches `drone.photo` — the same bytes arrive either way. */
  "upload.request": [{ window: HOUR, max: 20 }],
  /**
   * Anti-scraping, and **not** what makes a Remote ID unguessable — 40 bits of
   * entropy at 30/minute is on the order of 700,000 years to sweep the space.
   * What this stops is bulk resolution of codes an operator already holds, and
   * it makes an attempt visible in `remote_id_scan`.
   */
  "rid.resolve": [{ window: MINUTE, max: 30 }],
  /**
   * Not in F09's table — added by F11, which built the action.
   *
   * Reporting is **anonymous by design**, so the only thing standing between
   * the reviewer queue and a flood of junk is this. Two windows for the same
   * reason `booking.create` has two: a burst and a sustained drip are different
   * attacks. Generous enough that a bystander watching one drone can file a
   * second report when they remember a detail.
   */
  "rid.report": [
    { window: MINUTE, max: 3 },
    { window: HOUR, max: 10 },
  ],
  /**
   * **Deliberately generous.** This fires on map interaction, debounced to
   * ~250 ms client-side; the server limit is a backstop, not the primary
   * control. Setting it tight would make the live map feel broken.
   */
  "airspace.check": [{ window: MINUTE, max: 60 }],
  /** A reveal is a serious act. A burst of them is a signal, not traffic. */
  "identity.reveal": [{ window: HOUR, max: 20 }],
  /**
   * Not in F09's table — added by F14, which built the decision actions.
   *
   * Generous, because a reviewer working down a morning's queue is normal
   * traffic and the limit exists for the other case: a compromised staff
   * account approving everything in sight before anybody notices.
   */
  "review.decide": [{ window: MINUTE, max: 30 }],
  "admin.lookup": [{ window: MINUTE, max: 60 }],
  /**
   * Not in F09's table — added because it is the one server action that exists
   * today, and an unenforced limiter is an untested one. Generous: an admin
   * working down a list of users is normal traffic.
   */
  "user.role_set": [{ window: MINUTE, max: 20 }],
} as const satisfies Record<string, readonly RateLimitRule[]>;

export type LimitedAction = keyof typeof LIMITS;

/** `booking.create:user:abc123` · `rid.resolve:ip:9f2c…` */
export function rateLimitKey(
  action: LimitedAction,
  scope: "user" | "ip",
  identifier: string,
): string {
  return `${action}:${scope}:${identifier}`;
}

/**
 * The stored key for one rule.
 *
 * The window length belongs in it: a 60-second and a 24-hour rule on the same
 * action share a `window_start` at every midnight, and without this suffix
 * they would share a bucket and corrupt each other's count.
 */
export function bucketKey(key: string, windowSeconds: number): string {
  return `${key}#${windowSeconds}`;
}

/**
 * The fixed window an instant falls in. Aligned to the epoch rather than to
 * first use, so every process agrees on where a window starts without
 * coordinating — which is what lets the counter be a single upsert.
 */
export function windowBounds(
  now: Date,
  windowSeconds: number,
): { start: Date; end: Date } {
  const ms = windowSeconds * 1000;
  const startMs = Math.floor(now.getTime() / ms) * ms;
  return { start: new Date(startMs), end: new Date(startMs + ms) };
}

/**
 * Seconds until the window resets, rounded up and never below 1 — "try again
 * in 0 seconds" reads as a bug, and rounding down would send the caller back a
 * moment early to be refused again.
 */
export function retryAfterSeconds(now: Date, windowEnd: Date): number {
  return Math.max(1, Math.ceil((windowEnd.getTime() - now.getTime()) / 1000));
}

/** Shortest window first. Sorted here so no caller can get the order wrong. */
export function rulesFor(action: LimitedAction): RateLimitRule[] {
  return [...LIMITS[action]].sort((a, b) => a.window - b.window);
}
