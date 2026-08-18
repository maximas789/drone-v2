import "server-only";

import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
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

/**
 * The first photograph and the Remote ID code for a set of drones, keyed by id.
 *
 * One query per concern rather than one per card: the list renders every
 * aircraft a pilot owns, and a per-card lookup would be N+1 round trips for a
 * page whose whole job is to be a list.
 *
 * **Scoped by re-reading the caller's own drones**, not by trusting the ids
 * passed in — an id list is caller-supplied, and taking it at face value here
 * would make this function a lookup for anybody's photographs.
 */
/** The window inside which a registration is flagged as running out. */
export const EXPIRY_WARNING_DAYS = 30;

export async function listPhotoAndRemoteIdForDrones(
  session: Session,
  droneIds: string[],
  /**
   * The clock is read **here**, not in the page. A React render that calls
   * `Date.now()` is impure — eslint's `react-hooks/purity` rule says so — and
   * the honest fix is not to silence it but to move the read to where the query
   * already happens. The page then renders a boolean and nothing about it can
   * differ between the server and the browser.
   */
  now: Date = new Date(),
): Promise<
  Record<
    string,
    { photoUrl: string | null; remoteIdCode: string | null; expiringSoon: boolean }
  >
> {
  if (droneIds.length === 0) return {};

  const mine = await db.query.drone.findMany({
    where: and(
      eq(drone.ownerUserId, session.user.id),
      inArray(drone.id, droneIds),
    ),
    columns: { id: true, status: true, registrationExpiresAt: true },
  });
  const allowed = mine.map((row) => row.id);
  if (allowed.length === 0) return {};

  const [photos, codes] = await Promise.all([
    db.query.dronePhoto.findMany({
      where: inArray(dronePhoto.droneId, allowed),
      orderBy: [asc(dronePhoto.sortOrder)],
      columns: { droneId: true, url: true },
    }),
    db.query.remoteId.findMany({
      where: inArray(remoteId.droneId, allowed),
      columns: { droneId: true, code: true },
    }),
  ]);

  const soon = now.getTime() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000;
  const byId = new Map(mine.map((row) => [row.id, row]));

  const result: Record<
    string,
    { photoUrl: string | null; remoteIdCode: string | null; expiringSoon: boolean }
  > = {};
  for (const id of allowed) {
    const row = byId.get(id);
    result[id] = {
      // `sortOrder` ascending, so the first row is the one the pilot put first.
      photoUrl: photos.find((p) => p.droneId === id)?.url ?? null,
      remoteIdCode: codes.find((c) => c.droneId === id)?.code ?? null,
      expiringSoon:
        row?.status === "approved" &&
        row.registrationExpiresAt !== null &&
        row.registrationExpiresAt.getTime() <= soon,
    };
  }
  return result;
}
