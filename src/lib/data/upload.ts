import "server-only";

import { and, asc, eq, inArray, max } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { drone, dronePhoto, remoteId, remoteIdDeclaration } from "@/lib/db/schema";
import { isReviewer, roleOf, type Session } from "@/lib/session";
import { acceptsUploads, type PhotoKind } from "@/lib/storage/validate";

/**
 * Ownership for everything file-shaped. Session first, without exception.
 *
 * **The upload route is not a special case.** A route handler is an ordinary
 * POST endpoint, reachable directly with a valid cookie and any body the caller
 * likes — exactly like a server action. Rule 8 applies to it for the same
 * reason it applies to them.
 *
 * Deleting a row and deleting the bytes are kept together here, because an
 * orphaned blob is a privacy leak: the file stays reachable to anyone holding
 * the pathname long after the app has forgotten it.
 */

function actorFor(session: Session) {
  return { userId: session.user.id, role: roleOf(session), isSystem: false };
}

export type UploadTarget =
  | { ok: true; droneId: string }
  | { ok: false; reason: "not_found" | "not_editable"; status?: string };

/**
 * The drone a photo is about to be attached to.
 *
 * **"Not yours" and "does not exist" answer identically.** Distinguishing them
 * would let anyone with a drone id learn whether it is real — an enumeration of
 * other people's aircraft, one 403 at a time.
 *
 * A reviewer is **not** granted write access here: reading someone's drone to
 * decide on it is the job; adding photographs to it is not.
 */
export async function getDroneForUpload(
  session: Session,
  droneId: string,
): Promise<UploadTarget> {
  const row = await db.query.drone.findFirst({
    where: and(eq(drone.id, droneId), eq(drone.ownerUserId, session.user.id)),
    columns: { id: true, status: true },
  });

  if (!row) return { ok: false, reason: "not_found" };
  if (!acceptsUploads(row.status)) {
    return { ok: false, reason: "not_editable", status: row.status };
  }
  return { ok: true, droneId: row.id };
}

/**
 * The declaration a PDF is about to be attached to, reached through its Remote
 * ID to its drone — a declaration has no owner column of its own, and inventing
 * one would give the same fact two places to disagree.
 *
 * The parent drone's editable rule applies unchanged: a document appearing
 * under a reviewer mid-decision is the same failure whether it is a photograph
 * or a Declaration of Compliance.
 */
export async function getDeclarationForUpload(
  session: Session,
  declarationId: string,
): Promise<
  | { ok: true; declarationId: string; droneId: string; previousPath: string | null }
  | { ok: false; reason: "not_found" | "not_editable"; status?: string }
> {
  const row = await db
    .select({
      declarationId: remoteIdDeclaration.id,
      previousPath: remoteIdDeclaration.docPath,
      droneId: remoteId.droneId,
      ownerUserId: drone.ownerUserId,
      status: drone.status,
      supersededAt: remoteIdDeclaration.supersededAt,
    })
    .from(remoteIdDeclaration)
    .innerJoin(remoteId, eq(remoteId.id, remoteIdDeclaration.remoteIdId))
    .innerJoin(drone, eq(drone.id, remoteId.droneId))
    .where(eq(remoteIdDeclaration.id, declarationId))
    .then((rows) => rows[0] ?? null);

  if (!row || row.ownerUserId !== session.user.id) {
    return { ok: false, reason: "not_found" };
  }
  // A superseded declaration is history. History does not take new documents.
  if (row.supersededAt || !acceptsUploads(row.status)) {
    return { ok: false, reason: "not_editable", status: row.status };
  }

  return {
    ok: true,
    declarationId: row.declarationId,
    droneId: row.droneId,
    previousPath: row.previousPath,
  };
}

/**
 * Points a declaration at its stored PDF. Returns the pathname it replaced, if
 * any, so the caller can delete those bytes — a superseded document nobody
 * deletes stays readable to anyone holding its pathname.
 */
export async function setDeclarationDoc(
  session: Session,
  input: { declarationId: string; droneId: string; pathname: string },
) {
  return db.transaction(async (tx) => {
    await tx
      .update(remoteIdDeclaration)
      .set({ docPath: input.pathname, updatedAt: new Date() })
      .where(eq(remoteIdDeclaration.id, input.declarationId));

    await audit(tx, {
      actor: actorFor(session),
      entityType: "remote_id",
      entityId: input.declarationId,
      action: "declaration.document_uploaded",
      after: { pathname: input.pathname },
    });
  });
}

/**
 * Records a stored photo. Takes the `StoredFile` rather than doing the write
 * itself — the bytes are already committed by the time we get here, and a
 * failure now is a row to retry, not a file to re-upload.
 */
export async function addDronePhoto(
  session: Session,
  input: {
    droneId: string;
    kind: PhotoKind;
    url: string;
    pathname: string;
  },
) {
  return db.transaction(async (tx) => {
    // Appended, not inserted at a position: `sortOrder` is the pilot's ordering
    // and a new photo has not been placed anywhere yet.
    const [{ highest }] = await tx
      .select({ highest: max(dronePhoto.sortOrder) })
      .from(dronePhoto)
      .where(eq(dronePhoto.droneId, input.droneId));

    const [row] = await tx
      .insert(dronePhoto)
      .values({
        droneId: input.droneId,
        kind: input.kind,
        url: input.url,
        pathname: input.pathname,
        sortOrder: (highest ?? -1) + 1,
      })
      .returning();

    await audit(tx, {
      actor: actorFor(session),
      entityType: "drone",
      entityId: input.droneId,
      action: "drone.photo_added",
      after: { kind: input.kind, pathname: input.pathname },
    });

    return row;
  });
}

/**
 * The pathname of a photo the caller is allowed to delete, or `null`.
 *
 * Returns the pathname rather than deleting the bytes itself, so the caller
 * removes the row and the file in one place and neither can be forgotten.
 */
export async function deleteDronePhoto(
  session: Session,
  photoId: string,
): Promise<{ pathname: string } | null> {
  const photo = await db.query.dronePhoto.findFirst({
    where: eq(dronePhoto.id, photoId),
  });
  if (!photo) return null;

  const target = await getDroneForUpload(session, photo.droneId);
  if (!target.ok) return null;

  return db.transaction(async (tx) => {
    await tx.delete(dronePhoto).where(eq(dronePhoto.id, photoId));
    await audit(tx, {
      actor: actorFor(session),
      entityType: "drone",
      entityId: photo.droneId,
      action: "drone.photo_removed",
      before: { kind: photo.kind, pathname: photo.pathname },
    });
    return { pathname: photo.pathname };
  });
}

/**
 * Every pathname a drone owns — its photos and its QR.
 *
 * What a delete has to sweep. The `drone_photo` rows go by cascade when the
 * drone row does; **the bytes do not**, and nothing in the database will ever
 * tell you they were left behind.
 */
export async function listDroneFilePathnames(
  session: Session,
  droneId: string,
): Promise<string[]> {
  const owned = await db.query.drone.findFirst({
    where: and(eq(drone.id, droneId), eq(drone.ownerUserId, session.user.id)),
    columns: { id: true },
  });
  if (!owned) return [];

  const [photos, rid] = await Promise.all([
    db.query.dronePhoto.findMany({
      where: eq(dronePhoto.droneId, droneId),
      columns: { pathname: true },
    }),
    db.query.remoteId.findFirst({
      where: eq(remoteId.droneId, droneId),
      columns: { qrPathname: true },
    }),
  ]);

  const pathnames = photos.map((p) => p.pathname);
  if (rid?.qrPathname) pathnames.push(rid.qrPathname);
  return pathnames;
}

/** The pilot's own ordering, persisted. Ignores ids that are not theirs. */
export async function reorderDronePhotos(
  session: Session,
  droneId: string,
  photoIdsInOrder: string[],
) {
  const target = await getDroneForUpload(session, droneId);
  if (!target.ok) return { ok: false as const, reason: target.reason };

  const owned = await db.query.dronePhoto.findMany({
    where: and(
      eq(dronePhoto.droneId, droneId),
      inArray(dronePhoto.id, photoIdsInOrder),
    ),
    columns: { id: true },
  });
  const ownedIds = new Set(owned.map((p) => p.id));

  await db.transaction(async (tx) => {
    let index = 0;
    for (const id of photoIdsInOrder) {
      if (!ownedIds.has(id)) continue;
      await tx
        .update(dronePhoto)
        .set({ sortOrder: index })
        .where(eq(dronePhoto.id, id));
      index += 1;
    }
  });

  return { ok: true as const };
}

export async function listPhotosForDrone(session: Session, droneId: string) {
  const owned = await db.query.drone.findFirst({
    where: eq(drone.id, droneId),
    columns: { id: true, ownerUserId: true },
  });
  if (!owned) return [];
  if (owned.ownerUserId !== session.user.id && !isReviewer(session)) return [];

  return db.query.dronePhoto.findMany({
    where: eq(dronePhoto.droneId, droneId),
    orderBy: [asc(dronePhoto.sortOrder)],
  });
}

/**
 * May this session read the bytes at this pathname?
 *
 * The **pathname** is the question, because that is all `/api/files` has. It is
 * answered by finding the row that claims it: a pathname no row claims is not
 * readable by anyone, which is what makes a deleted file's URL 404 rather than
 * lingering.
 *
 * A reviewer may read any of it — deciding on a registration means looking at
 * the photographs and the declaration. A pilot may read their own.
 */
export async function canReadStoredFile(
  session: Session,
  pathname: string,
): Promise<boolean> {
  const photo = await db.query.dronePhoto.findFirst({
    where: eq(dronePhoto.pathname, pathname),
    columns: { droneId: true },
  });
  if (photo) return ownsOrReviews(session, photo.droneId);

  const declaration = await db.query.remoteIdDeclaration.findFirst({
    where: eq(remoteIdDeclaration.docPath, pathname),
    columns: { remoteIdId: true },
  });
  if (declaration) {
    const rid = await db.query.remoteId.findFirst({
      where: eq(remoteId.id, declaration.remoteIdId),
      columns: { droneId: true },
    });
    return rid ? ownsOrReviews(session, rid.droneId) : false;
  }

  const qr = await db.query.remoteId.findFirst({
    where: eq(remoteId.qrPathname, pathname),
    columns: { droneId: true },
  });
  if (qr) return ownsOrReviews(session, qr.droneId);

  return false;
}

async function ownsOrReviews(session: Session, droneId: string) {
  if (isReviewer(session)) return true;
  const row = await db.query.drone.findFirst({
    where: and(eq(drone.id, droneId), eq(drone.ownerUserId, session.user.id)),
    columns: { id: true },
  });
  return Boolean(row);
}
