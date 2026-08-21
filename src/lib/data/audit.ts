import "server-only";

import { and, count, desc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvent, user } from "@/lib/db/schema";
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

/**
 * **Reveal oversight** — F24's `/admin/reveals`.
 *
 * Two actions, not one. `remote_id.identity_revealed` is the code-keyed reveal
 * from a scan or a lookup; `pilot_profile.identity_revealed` is the
 * profile-keyed sibling F22c added, because a `pending` registration has no
 * Remote ID to key on. Listing only the first would hide half of every
 * reviewer's reveals from the person whose job is to notice a pattern.
 */
export const IDENTITY_REVEAL_ACTIONS = [
  "remote_id.identity_revealed",
  "pilot_profile.identity_revealed",
] as const;

export type IdentityRevealRow = {
  id: string;
  createdAt: Date;
  action: string;
  entityType: string;
  entityId: string;
  /** Required at the action; never null in practice, and rendered verbatim. */
  reason: string | null;
  reviewerUserId: string | null;
  reviewerName: string | null;
  reviewerEmail: string | null;
  /** The role **at the time** — captured at write time, never joined. */
  reviewerRole: string | null;
  /**
   * What was revealed, as far as the trail may say: the Remote ID code, or
   * nothing. **No name and no document number** — the audit table deliberately
   * carries neither, and this screen must not become the place they reappear.
   */
  targetCode: string | null;
};

/**
 * Every identity reveal, newest first. **Admins only.**
 *
 * A reviewer cannot read this: the oversight surface is what makes the reveal
 * power accountable, and a reviewer who could watch it would know exactly how
 * much scrutiny their own reveals were getting.
 */
export async function listIdentityReveals(
  session: Session,
  reviewerUserId?: string | null,
  limit = 200,
): Promise<IdentityRevealRow[]> {
  if (!isAdmin(session)) return [];

  const rows = await db
    .select({
      id: auditEvent.id,
      createdAt: auditEvent.createdAt,
      action: auditEvent.action,
      entityType: auditEvent.entityType,
      entityId: auditEvent.entityId,
      reason: auditEvent.reason,
      after: auditEvent.after,
      reviewerUserId: auditEvent.actorUserId,
      reviewerRole: auditEvent.actorRole,
      reviewerName: user.name,
      reviewerEmail: user.email,
    })
    .from(auditEvent)
    .leftJoin(user, eq(user.id, auditEvent.actorUserId))
    .where(
      reviewerUserId
        ? and(
            inArray(auditEvent.action, [...IDENTITY_REVEAL_ACTIONS]),
            eq(auditEvent.actorUserId, reviewerUserId),
          )
        : inArray(auditEvent.action, [...IDENTITY_REVEAL_ACTIONS]),
    )
    .orderBy(desc(auditEvent.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    reason: row.reason,
    reviewerUserId: row.reviewerUserId,
    reviewerName: row.reviewerName,
    reviewerEmail: row.reviewerEmail,
    reviewerRole: row.reviewerRole,
    targetCode: codeFrom(row.after),
  }));
}

/**
 * `after` is `jsonb` and therefore `unknown`. The code-keyed reveal writes
 * `{ code, droneId }`; the profile-keyed one writes `{ userId }` and has no
 * code at all. Read defensively rather than cast — a row written by a future
 * action with a different shape must render as "no code", not crash the one
 * screen an administrator uses to check on their reviewers.
 */
function codeFrom(after: unknown): string | null {
  if (typeof after !== "object" || after === null) return null;
  const code = (after as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

export type ReviewerRevealCount = {
  reviewerUserId: string;
  reviewerName: string | null;
  reviewerEmail: string | null;
  count: number;
};

/**
 * Reveals per reviewer over a rolling window — **the number that makes an
 * unusual pattern visible rather than buried.**
 *
 * A list of reveals sorted by time answers "what happened"; it does not answer
 * "is somebody revealing forty identities a week", which is the question an
 * administrator is actually there to ask. Ordered by count, highest first, for
 * the same reason the review queue is oldest-first: the ordering is the point.
 */
export async function countRevealsByReviewer(
  session: Session,
  windowDays = 30,
  now: Date = new Date(),
): Promise<ReviewerRevealCount[]> {
  if (!isAdmin(session)) return [];

  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  return db
    .select({
      reviewerUserId: auditEvent.actorUserId,
      reviewerName: user.name,
      reviewerEmail: user.email,
      count: count(auditEvent.id),
    })
    .from(auditEvent)
    .leftJoin(user, eq(user.id, auditEvent.actorUserId))
    .where(
      and(
        inArray(auditEvent.action, [...IDENTITY_REVEAL_ACTIONS]),
        gte(auditEvent.createdAt, since),
        isNotNull(auditEvent.actorUserId),
      ),
    )
    .groupBy(auditEvent.actorUserId, user.name, user.email)
    .orderBy(desc(count(auditEvent.id)))
    .then((rows) =>
      rows.map((row) => ({
        reviewerUserId: row.reviewerUserId ?? "",
        reviewerName: row.reviewerName,
        reviewerEmail: row.reviewerEmail,
        count: row.count,
      })),
    );
}
