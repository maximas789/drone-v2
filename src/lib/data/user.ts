import "server-only";

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvent, user } from "@/lib/db/schema";
import { isAdmin, isReviewer, type Role, type Session } from "@/lib/session";

/**
 * Accounts and roles.
 *
 * As everywhere in this folder, the session is the first argument and the
 * scoping happens here — no page and no server action writes its own `where`.
 */

/** The account list behind `/admin`. Admins only: it enumerates every user. */
export async function listUsers(session: Session, limit = 200) {
  if (!isAdmin(session)) return [];
  return db.query.user.findMany({
    orderBy: [asc(user.createdAt)],
    limit,
    columns: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      role: true,
      preferredLocale: true,
      createdAt: true,
    },
  });
}

/**
 * A single account. A pilot may look up only themselves; reviewers and admins
 * may look up anyone, because the review queues show who submitted what.
 *
 * Returns `null` rather than throwing, and does not distinguish "no such user"
 * from "not yours" — that split would enumerate accounts.
 */
export async function getUserById(session: Session, userId: string) {
  if (userId !== session.user.id && !isReviewer(session)) return null;
  const row = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      role: true,
      preferredLocale: true,
      createdAt: true,
    },
  });
  return row ?? null;
}

export async function countUsers(session: Session) {
  if (!isAdmin(session)) return 0;
  return db.$count(user);
}

/**
 * The **only** way a role changes.
 *
 * The write and its audit event go in one transaction: a role change that
 * isn't in the trail is a role change a regulator can't see, and two separate
 * statements can leave exactly that. `before`/`after` record the old and new
 * role so the log answers "who made this person a reviewer, and when".
 *
 * F14 introduces `applyTransition()` for the drone and booking state machines.
 * A role is not one of those statuses, so this stays here — but the shape
 * (row + audit, one transaction) is deliberately the same.
 */
export async function setUserRole(
  session: Session,
  targetUserId: string,
  role: Role,
) {
  if (!isAdmin(session)) return null;

  return db.transaction(async (tx) => {
    const before = await tx.query.user.findFirst({
      where: eq(user.id, targetUserId),
      columns: { id: true, role: true },
    });
    if (!before) return null;

    const [after] = await tx
      .update(user)
      .set({ role, updatedAt: new Date() })
      .where(eq(user.id, targetUserId))
      .returning({ id: user.id, role: user.role });

    await tx.insert(auditEvent).values({
      actorUserId: session.user.id,
      // The actor's role at the time, not whatever it becomes later.
      actorRole: session.user.role,
      entityType: "user",
      entityId: targetUserId,
      action: "user.role_changed",
      before: { role: before.role },
      after: { role: after?.role ?? role },
    });

    return after ?? null;
  });
}
