import "server-only";

import { and, eq, gt, lt, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/auth-schema";
import { reviewPresence } from "@/lib/db/schema";
import { isReviewer, type Session } from "@/lib/session";

/**
 * Who else has this record open — the read and write behind F22's **soft
 * lock**.
 *
 * **It locks nothing.** What actually stops two reviewers overwriting each
 * other is `applyTransition`'s `select … for update` and the `already_applied`
 * it answers; this only lets the second reviewer see the first *before* they
 * both start typing a decision. Nothing in the app refuses on the strength of a
 * row in this table, and nothing should — a lock a closed laptop cannot release
 * would leave records permanently in review.
 *
 * Reviewers only, in both directions: a pilot's presence is nobody's business,
 * and the names returned here are staff names shown to staff.
 */

/** How long a heartbeat's row stays live. Comfortably over the ping interval. */
export const PRESENCE_TTL_MS = 90_000;

/**
 * Record that this reviewer is looking, and say who else is.
 *
 * One upsert and one read, called on a timer by the page. **The expired rows
 * are deleted here rather than by a nightly job**: the sweep is a single
 * indexed delete on a tiny table, it runs only when somebody is actually
 * reviewing, and putting it in the rate-limit cron would have meant a function
 * whose name no longer described what it did.
 */
export async function touchPresence(
  session: Session,
  args: { entityType: "drone" | "booking" | "pilot_profile"; entityId: string },
): Promise<Array<{ userId: string; name: string | null }>> {
  if (!isReviewer(session)) return [];

  const now = new Date();
  const expiresAt = new Date(now.getTime() + PRESENCE_TTL_MS);

  await db
    .insert(reviewPresence)
    .values({
      entityType: args.entityType,
      entityId: args.entityId,
      userId: session.user.id,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [
        reviewPresence.entityType,
        reviewPresence.entityId,
        reviewPresence.userId,
      ],
      set: { expiresAt, updatedAt: now },
    });

  await db.delete(reviewPresence).where(lt(reviewPresence.expiresAt, now));

  return listOtherViewers(session, args, now);
}

/**
 * The other reviewers currently on this record, newest heartbeat first.
 *
 * **Their names, not their ids.** The point of the indicator is that a person
 * knows whom to go and talk to before both of them write a decision; "another
 * reviewer" would leave them guessing, and an id would leave them worse off.
 * The session's own row is excluded — a page telling you that you are looking
 * at it is noise.
 */
export async function listOtherViewers(
  session: Session,
  args: { entityType: "drone" | "booking" | "pilot_profile"; entityId: string },
  now: Date = new Date(),
): Promise<Array<{ userId: string; name: string | null }>> {
  if (!isReviewer(session)) return [];

  const rows = await db
    .select({ userId: reviewPresence.userId, name: user.name })
    .from(reviewPresence)
    .leftJoin(user, eq(user.id, reviewPresence.userId))
    .where(
      and(
        eq(reviewPresence.entityType, args.entityType),
        eq(reviewPresence.entityId, args.entityId),
        ne(reviewPresence.userId, session.user.id),
        // Expiry decides, not the row's existence: a browser that closed
        // without saying goodbye leaves its row behind, and treating that as
        // presence is how a record ends up permanently "being reviewed".
        gt(reviewPresence.expiresAt, now),
      ),
    )
    .orderBy(reviewPresence.updatedAt);

  return rows;
}
