import "server-only";

import { desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { drone, remoteId, remoteIdDeclaration } from "@/lib/db/schema";
import { isReviewer, type Session } from "@/lib/session";

/**
 * Public resolution of a scanned code. Takes `null` for a signed-out inspector
 * — that is the normal case at the roadside.
 *
 * **Redaction is not this function's job to remember.** It returns the raw
 * rows; F11 owns the redacted projection and the identity-reveal path, which
 * writes an audit event *before* the value is returned.
 */
export async function findByCode(_session: Session | null, code: string) {
  return db.query.remoteId.findFirst({
    where: eq(remoteId.code, code.trim().toUpperCase()),
  });
}

export async function getOwningDrone(_session: Session | null, remoteIdId: string) {
  const rid = await db.query.remoteId.findFirst({
    where: eq(remoteId.id, remoteIdId),
  });
  if (!rid) return null;
  return db.query.drone.findFirst({ where: eq(drone.id, rid.droneId) });
}

/**
 * Declarations newest first, superseded rows included — the regulator's
 * question is "what was broadcasting on 3 March", which needs the history.
 */
export async function listDeclarations(session: Session, remoteIdId: string) {
  const owner = await getOwningDrone(session, remoteIdId);
  if (!owner) return [];
  if (owner.ownerUserId !== session.user.id && !isReviewer(session)) return [];
  return db.query.remoteIdDeclaration.findMany({
    where: eq(remoteIdDeclaration.remoteIdId, remoteIdId),
    orderBy: [desc(remoteIdDeclaration.createdAt)],
  });
}

export async function getActiveDeclaration(session: Session, remoteIdId: string) {
  const all = await listDeclarations(session, remoteIdId);
  return all.find((row) => row.supersededAt === null) ?? null;
}

export async function listPendingDeclarations(session: Session, limit = 50) {
  if (!isReviewer(session)) return [];
  return db.query.remoteIdDeclaration.findMany({
    where: isNull(remoteIdDeclaration.verifiedAt),
    orderBy: [desc(remoteIdDeclaration.createdAt)],
    limit,
  });
}
