import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvent } from "@/lib/db/schema";
import { isAdmin, isReviewer, type Session } from "@/lib/session";

/**
 * **One log, not two.** This table backs both the regulator's approval trail
 * and the ops activity log.
 *
 * Read-only by design: there is no `updateAuditEvent` and no `deleteAuditEvent`
 * here, and there must never be. Writes go through
 * `src/lib/workflow/applyTransition()` (F14), which appends the event in the
 * same transaction as the row it describes.
 */

export async function listEventsForEntity(
  session: Session,
  entityType: (typeof auditEvent.entityType.enumValues)[number],
  entityId: string,
  limit = 100,
) {
  if (!isReviewer(session)) return [];
  return db.query.auditEvent.findMany({
    where: and(
      eq(auditEvent.entityType, entityType),
      eq(auditEvent.entityId, entityId),
    ),
    orderBy: [desc(auditEvent.createdAt)],
    limit,
  });
}

/** The full browser. Admins only — it spans every actor and every entity. */
export async function listRecentEvents(session: Session, limit = 100) {
  if (!isAdmin(session)) return [];
  return db.query.auditEvent.findMany({
    orderBy: [desc(auditEvent.createdAt)],
    limit,
  });
}

/**
 * What a pilot may see about themselves — including, deliberately, every time
 * their identity was revealed to a reviewer.
 */
export async function listMyIdentityReveals(session: Session, limit = 50) {
  return db.query.auditEvent.findMany({
    where: and(
      eq(auditEvent.entityType, "user"),
      eq(auditEvent.entityId, session.user.id),
      eq(auditEvent.action, "remote_id.identity_revealed"),
    ),
    orderBy: [desc(auditEvent.createdAt)],
    limit,
  });
}
