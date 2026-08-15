import "server-only";

import { and, asc, count, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { drone, dronePhoto, remoteId } from "@/lib/db/schema";
import { isReviewer, type Session } from "@/lib/session";

/**
 * Ownership lives here. No page and no server action calls `db` directly, and
 * every exported function takes the session first — so "is this query scoped?"
 * is answerable by reading this folder rather than the whole app.
 */

export async function listMyDrones(session: Session) {
  return db.query.drone.findMany({
    where: eq(drone.ownerUserId, session.user.id),
    orderBy: [desc(drone.createdAt)],
  });
}

/**
 * Returns `null` rather than throwing when the drone belongs to someone else.
 * A reviewer sees any drone; a pilot sees only their own. Note the difference
 * between "does not exist" and "is not yours" is deliberately invisible to the
 * caller — otherwise the 404/403 split enumerates other people's aircraft.
 */
export async function getDroneById(session: Session, id: string) {
  const row = await db.query.drone.findFirst({ where: eq(drone.id, id) });
  if (!row) return null;
  if (row.ownerUserId !== session.user.id && !isReviewer(session)) return null;
  return row;
}

export async function getDronePhotos(session: Session, droneId: string) {
  const owned = await getDroneById(session, droneId);
  if (!owned) return [];
  return db.query.dronePhoto.findMany({
    where: eq(dronePhoto.droneId, droneId),
    orderBy: [asc(dronePhoto.sortOrder)],
  });
}

export async function getRemoteIdForDrone(session: Session, droneId: string) {
  const owned = await getDroneById(session, droneId);
  if (!owned) return null;
  return db.query.remoteId.findFirst({ where: eq(remoteId.droneId, droneId) });
}

/** The reviewer queue: oldest submission first. Reviewers and admins only. */
export async function listPendingDrones(session: Session, limit = 50) {
  if (!isReviewer(session)) return [];
  return db.query.drone.findMany({
    where: eq(drone.status, "pending"),
    orderBy: [asc(drone.submittedAt)],
    limit,
  });
}

export async function countPendingDrones(session: Session) {
  if (!isReviewer(session)) return 0;
  const [row] = await db
    .select({ value: count() })
    .from(drone)
    .where(eq(drone.status, "pending"));
  return row?.value ?? 0;
}

export async function countMyDronesByStatus(
  session: Session,
  status: (typeof drone.status.enumValues)[number],
) {
  const [row] = await db
    .select({ value: count() })
    .from(drone)
    .where(
      and(eq(drone.ownerUserId, session.user.id), eq(drone.status, status)),
    );
  return row?.value ?? 0;
}
