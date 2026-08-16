import "server-only";

import type { DbExecutor } from "@/lib/db";
import { auditEvent } from "@/lib/db/schema";

/**
 * The one way an `audit_event` row is written.
 *
 * **It always takes the executor.** An audit write outside the transaction that
 * made the change can succeed while the change rolls back — a log recording
 * something that never happened is worse than no log at all. There is no
 * overload that defaults to `db`.
 *
 * Append-only: this module exports no update and no delete, and must never
 * grow one. `src/lib/data/audit.ts` is the read side.
 */

export type AuditEntityType = (typeof auditEvent.entityType.enumValues)[number];

/**
 * Who acted. `actorRole` is the role **at the time** — a reviewer later
 * promoted to admin must not retroactively appear to have acted as one, so it
 * is captured at write time rather than joined at read time.
 */
export type Actor = {
  userId: string | null;
  role: string | null;
  isSystem: boolean;
};

/**
 * Every transition a background job drives is attributed to this, never to
 * whichever human happened to be signed in. `actorIsSystem` is what lets a
 * regulator separate "a reviewer decided" from "the clock decided".
 */
export const SYSTEM_ACTOR: Actor = {
  userId: null,
  role: null,
  isSystem: true,
};

export type AuditInput = {
  actor: Actor;
  entityType: AuditEntityType;
  entityId: string;
  /** Dotted and stable, e.g. `drone.expired`. Never a translated sentence. */
  action: string;
  /**
   * **Only the changed fields.** Never a password hash, never a token, never a
   * full national ID. Zone geometry is the one sanctioned exception — the whole
   * polygon goes in both, because "who moved this boundary and where was it
   * before" is unanswerable otherwise.
   */
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  /** `sha256(RATE_LIMIT_PEPPER + ip)` — see `src/lib/ip-hash.ts`. Never raw. */
  ipHash?: string | null;
  userAgent?: string | null;
};

export async function audit(
  tx: DbExecutor,
  {
    actor,
    entityType,
    entityId,
    action,
    before,
    after,
    reason = null,
    ipHash = null,
    userAgent = null,
  }: AuditInput,
): Promise<void> {
  await tx.insert(auditEvent).values({
    actorUserId: actor.userId,
    actorRole: actor.role,
    actorIsSystem: actor.isSystem,
    entityType,
    entityId,
    action,
    before: before ?? null,
    after: after ?? null,
    reason,
    ipHash,
    userAgent,
  });
}
