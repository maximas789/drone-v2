import "server-only";

import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  lt,
  or,
} from "drizzle-orm";
import {
  EMPTY_FILTERS,
  encodeAuditCursor,
  riyadhDayEnd,
  riyadhDayStart,
  type AuditCursor,
  type AuditFilters,
} from "@/lib/admin/audit-filters";
import { db } from "@/lib/db";
import { auditEvent, user, zoneClosure } from "@/lib/db/schema";
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

// --- The audit browser (F25b) --------------------------------------------

/**
 * One row of `/admin/audit`.
 *
 * The actor's **name and email are joined** for display; the **role is not** —
 * `actorRole` is read from the row, because it is the role at the time and a
 * reviewer later promoted to admin must not retroactively appear to have acted
 * as one. That is the entire reason the column exists.
 *
 * `before` and `after` come through as `unknown`: they are `jsonb`, written by
 * thirty-odd call sites with thirty-odd shapes, and the diff view reads them
 * defensively rather than casting.
 */
export type AuditBrowserRow = {
  id: string;
  createdAt: Date;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  actorUserId: string | null;
  actorRole: string | null;
  actorIsSystem: boolean;
  /** `null` when the account was deleted — the event stays, the person goes. */
  actorName: string | null;
  actorEmail: string | null;
  before: unknown;
  after: unknown;
};

export type AuditPage = {
  rows: AuditBrowserRow[];
  /** `null` when this is the last page. Opaque to the caller. */
  nextCursor: string | null;
};

/** The default page size, and the cap the CSV export raises it to. */
export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_EXPORT_LIMIT = 5000;

/**
 * `entityType` is a Postgres enum, so an unrecognised string reaching `eq()` is
 * a **database error**, not an empty result — `?entityType=drop` would 500 the
 * page. Narrowed here rather than trusted.
 */
function isAuditEntityType(
  value: string,
): value is (typeof auditEvent.entityType.enumValues)[number] {
  return (auditEvent.entityType.enumValues as readonly string[]).includes(
    value,
  );
}

/**
 * The predicate every filter contributes to, shared by the browser and its
 * export so the file a regulator downloads is **exactly the rows on screen**.
 */
function auditWhere(filters: AuditFilters) {
  const clauses = [];

  if (filters.actor) clauses.push(eq(auditEvent.actorUserId, filters.actor));
  if (filters.role) clauses.push(eq(auditEvent.actorRole, filters.role));
  if (filters.action) clauses.push(eq(auditEvent.action, filters.action));
  if (filters.entityType && isAuditEntityType(filters.entityType)) {
    clauses.push(eq(auditEvent.entityType, filters.entityType));
  }
  if (filters.entityId) clauses.push(eq(auditEvent.entityId, filters.entityId));
  if (filters.from) {
    clauses.push(gte(auditEvent.createdAt, riyadhDayStart(filters.from)));
  }
  if (filters.to) {
    clauses.push(lt(auditEvent.createdAt, riyadhDayEnd(filters.to)));
  }
  if (filters.actorIsSystem !== null) {
    clauses.push(eq(auditEvent.actorIsSystem, filters.actorIsSystem));
  }
  if (filters.q) {
    /**
     * `ilike` over `reason`, with the wildcards escaped. A reason containing a
     * literal `%` — and a rejection reason may well say "100%" — would
     * otherwise match everything, which is a search box that silently lies.
     */
    const escaped = filters.q.replaceAll(/[\\%_]/g, (ch) => `\\${ch}`);
    clauses.push(ilike(auditEvent.reason, `%${escaped}%`));
  }

  return clauses.length > 0 ? and(...clauses) : undefined;
}

/**
 * **The audit browser.** Admins only, newest first, keyset-paginated.
 *
 * One extra row is fetched and dropped: that is how the caller learns whether
 * there is a next page without a second `count(*)` over a table that only
 * grows.
 */
export async function listAuditEvents(
  session: Session,
  filters: AuditFilters = EMPTY_FILTERS,
  cursor: AuditCursor | null = null,
  limit = AUDIT_PAGE_SIZE,
): Promise<AuditPage> {
  if (!isAdmin(session)) return { rows: [], nextCursor: null };

  const where = auditWhere(filters);
  /**
   * The keyset step, as a **row comparison written out**: strictly older, or
   * the same instant with a smaller id. Drizzle has no tuple comparison, and
   * `createdAt` alone is not unique — one transaction can land two events on
   * the same microsecond, and a cursor on the timestamp alone would skip one.
   */
  const paged = cursor
    ? or(
        lt(auditEvent.createdAt, cursor.createdAt),
        and(
          eq(auditEvent.createdAt, cursor.createdAt),
          lt(auditEvent.id, cursor.id),
        ),
      )
    : undefined;

  const rows = await db
    .select({
      id: auditEvent.id,
      createdAt: auditEvent.createdAt,
      action: auditEvent.action,
      entityType: auditEvent.entityType,
      entityId: auditEvent.entityId,
      reason: auditEvent.reason,
      actorUserId: auditEvent.actorUserId,
      actorRole: auditEvent.actorRole,
      actorIsSystem: auditEvent.actorIsSystem,
      actorName: user.name,
      actorEmail: user.email,
      before: auditEvent.before,
      after: auditEvent.after,
    })
    .from(auditEvent)
    .leftJoin(user, eq(user.id, auditEvent.actorUserId))
    .where(where && paged ? and(where, paged) : (where ?? paged))
    .orderBy(desc(auditEvent.createdAt), desc(auditEvent.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  return {
    rows: page,
    nextCursor:
      hasMore && last
        ? encodeAuditCursor({ createdAt: last.createdAt, id: last.id })
        : null,
  };
}

/**
 * Every distinct action present in the table, for the action filter.
 *
 * Read from the **data**, not from `audit-actions.ts`. The catalogue lists what
 * this build can write; the filter must offer what this database actually
 * holds, which on a system that has been running through several releases is
 * not the same set — and an action nothing has ever written is a filter option
 * guaranteed to return nothing.
 */
export async function listAuditActionCodes(
  session: Session,
): Promise<string[]> {
  if (!isAdmin(session)) return [];
  const rows = await db
    .selectDistinct({ action: auditEvent.action })
    .from(auditEvent)
    .orderBy(auditEvent.action);
  return rows.map((row) => row.action);
}

export type AuditActor = {
  userId: string;
  name: string | null;
  email: string | null;
};

/** Every account that has ever appeared as an actor, for the actor filter. */
export async function listAuditActors(session: Session): Promise<AuditActor[]> {
  if (!isAdmin(session)) return [];
  const rows = await db
    .selectDistinct({
      userId: auditEvent.actorUserId,
      name: user.name,
      email: user.email,
    })
    .from(auditEvent)
    .leftJoin(user, eq(user.id, auditEvent.actorUserId))
    .where(isNotNull(auditEvent.actorUserId))
    .orderBy(user.name);
  return rows.flatMap((row) =>
    row.userId
      ? [{ userId: row.userId, name: row.name, email: row.email }]
      : [],
  );
}

/**
 * A zone's own trail — **the zone's id and every closure filed against it.**
 *
 * A closure is audited under `entityType: "zone_closure"` with the *closure's*
 * id as `entityId` (`workflow/zone.ts`), so a trail keyed on the zone id alone
 * would show a boundary change and silently omit the closure that cancelled
 * eleven flights. Same two-id shape as `listAuditForDrone`, which unions a
 * drone with its Remote ID for the same reason.
 */
export async function listAuditForZone(
  session: Session,
  zoneId: string,
  limit = 100,
) {
  if (!isReviewer(session)) return [];

  const closures = await db
    .select({ id: zoneClosure.id })
    .from(zoneClosure)
    .where(eq(zoneClosure.zoneId, zoneId));

  const ids = [zoneId, ...closures.map((row) => row.id)];

  return db
    .select({
      id: auditEvent.id,
      action: auditEvent.action,
      entityType: auditEvent.entityType,
      reason: auditEvent.reason,
      actorRole: auditEvent.actorRole,
      actorIsSystem: auditEvent.actorIsSystem,
      actorUserId: auditEvent.actorUserId,
      createdAt: auditEvent.createdAt,
    })
    .from(auditEvent)
    .where(inArray(auditEvent.entityId, ids))
    .orderBy(desc(auditEvent.createdAt))
    .limit(limit);
}
