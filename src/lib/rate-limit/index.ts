import "server-only";

import { lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimitBucket } from "@/lib/db/schema";
import {
  bucketKey,
  rateLimitKey,
  retryAfterSeconds,
  rulesFor,
  windowBounds,
  type LimitedAction,
  type RateLimitVerdict,
} from "./rules";

/**
 * Layer 2 of two.
 *
 * **Better Auth's rate limiting is necessary but not sufficient.** It covers
 * `/api/auth/*` and nothing else. A server action is an ordinary POST to a
 * page route and is completely invisible to it — somebody who skips the UI and
 * posts straight at `setUserRoleAction` bypasses layer 1 entirely. This is
 * what stands in front of the actions.
 *
 * Fixed windows, one atomic statement, no Redis — which means it works on
 * serverless Neon with no second service to run, pay for, or forget to
 * provision. Buckets are swept nightly by F08.
 */

// The pure half, re-exported so callers only ever import `@/lib/rate-limit`.
export * from "./rules";

/**
 * One rule. The increment is a single `insert … on conflict … returning` —
 * never a read followed by a write, which two concurrent requests would
 * interleave and both pass.
 *
 * The count is incremented even when the caller is already over: a flood keeps
 * counting, which is what makes sustained abuse visible rather than flattening
 * it at the limit.
 */
export async function rateLimit({
  key,
  window,
  max,
  now = new Date(),
}: {
  key: string;
  window: number;
  max: number;
  now?: Date;
}): Promise<RateLimitVerdict> {
  const { start, end } = windowBounds(now, window);
  const storageKey = bucketKey(key, window);

  try {
    const [row] = await db
      .insert(rateLimitBucket)
      .values({ key: storageKey, windowStart: start, expiresAt: end, count: 1 })
      .onConflictDoUpdate({
        target: [rateLimitBucket.key, rateLimitBucket.windowStart],
        set: { count: sql`${rateLimitBucket.count} + 1` },
      })
      .returning({ count: rateLimitBucket.count });

    const count = row?.count ?? 1;
    if (count > max) {
      return { ok: false, retryAfterSeconds: retryAfterSeconds(now, end) };
    }
    return { ok: true };
  } catch (caught) {
    // **Fails open, deliberately.** The action behind this limit needs the
    // same database, so a failure here means it is about to fail anyway —
    // refusing would replace a real error with a misleading "too many
    // attempts". Logged loudly, because a limiter that is quietly off is worse
    // than one that is off.
    console.error(`[rate-limit] ${storageKey} could not be counted:`, caught);
    return { ok: true };
  }
}

/**
 * Every rule for an action, shortest window first, stopping at the first
 * refusal. Call it **immediately after the guard and before Zod parsing**, so
 * a malformed flood is cheap to reject.
 */
export async function enforceLimit(
  action: LimitedAction,
  scope: "user" | "ip",
  identifier: string,
  now: Date = new Date(),
): Promise<RateLimitVerdict> {
  const key = rateLimitKey(action, scope, identifier);

  for (const rule of rulesFor(action)) {
    const verdict = await rateLimit({ key, ...rule, now });
    if (!verdict.ok) return verdict;
  }
  return { ok: true };
}

/**
 * Drops every window that has already closed. Called by F08's nightly
 * `rate-limit-sweep`; returns how many rows went, so the job can log it.
 *
 * A bucket that outlives its window is harmless — nothing reads it — but the
 * table would otherwise grow forever on a busy map.
 */
export async function sweepRateLimitBuckets(
  now: Date = new Date(),
): Promise<number> {
  const deleted = await db
    .delete(rateLimitBucket)
    .where(lt(rateLimitBucket.expiresAt, now))
    .returning({ id: rateLimitBucket.id });

  return deleted.length;
}
