import "server-only";

import { and, asc, desc, eq, gt, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  booking,
  city,
  drone,
  dronePhoto,
  droneReport,
  pilotProfile,
  remoteId,
  remoteIdDeclaration,
  remoteIdScan,
  zone,
} from "@/lib/db/schema";
import type {
  ActiveFlight,
  BookingSummary,
  BuildType,
  DeclarationSummary,
  FullRemoteIdRecord,
  ScanSummary,
  ViewerLevel,
  WeightClass,
} from "@/lib/remote-id/redact";
import { isReviewer, type Session } from "@/lib/session";
import { fileUrlFor } from "@/lib/storage";

/**
 * Ownership lives here — every exported function takes the session first.
 *
 * **The scan record is the one deliberate exception to what that usually
 * means.** `getRemoteIdRecordByCode` returns the *whole* record to any caller,
 * including a signed-out one, because scoping it here would put a second
 * masking rule beside `redactRemoteId` — and two places that decide what a
 * bystander may see is exactly the drift F11 exists to prevent. The record
 * never leaves the server unmasked: `resolve.ts` computes the viewer level and
 * hands both to the one function that removes fields.
 *
 * Everything below it *is* scoped in the ordinary way, because each answers a
 * question the redactor cannot: which bookings are this viewer's to see, and
 * who may read the scan log at all.
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
 * The full record behind a canonical code, or `null` if no such code exists.
 *
 * `bookings` and `scans` come back **empty**: both depend on who is asking, and
 * the two functions below answer that with the session in hand.
 */
export async function getRemoteIdRecordByCode(
  _session: Session | null,
  code: string,
  now: Date = new Date(),
): Promise<FullRemoteIdRecord | null> {
  const [row] = await db
    .select({
      remoteIdId: remoteId.id,
      code: remoteId.code,
      remoteIdStatus: remoteId.status,
      issuedAt: remoteId.issuedAt,
      networkCapable: remoteId.networkCapable,
      broadcastCapable: remoteId.broadcastCapable,

      droneId: drone.id,
      droneStatus: drone.status,
      validUntil: drone.registrationExpiresAt,
      ownerUserId: drone.ownerUserId,
      nickname: drone.nickname,
      manufacturer: drone.manufacturer,
      model: drone.model,
      serialNumber: drone.serialNumber,
      buildType: drone.buildType,
      weightClass: drone.weightClass,
      weightGrams: drone.weightGrams,
      hasCamera: drone.hasCamera,

      ownerNameAr: pilotProfile.fullNameAr,
      ownerNameEn: pilotProfile.fullNameEn,
      ownerMobile: pilotProfile.mobileE164,
      ownerIdDocumentType: pilotProfile.idDocumentType,
      ownerIdDocumentNumber: pilotProfile.idDocumentNumber,

      cityNameAr: city.nameAr,
      cityNameEn: city.nameEn,
    })
    .from(remoteId)
    .innerJoin(drone, eq(drone.id, remoteId.droneId))
    // Left joins throughout: a registration whose owner has not completed their
    // profile still has to resolve. A scan page that 500s because a column is
    // null is a page a field inspector cannot use.
    .leftJoin(pilotProfile, eq(pilotProfile.userId, drone.ownerUserId))
    .leftJoin(city, eq(city.id, pilotProfile.addressCityId))
    .where(eq(remoteId.code, code));

  if (!row) return null;

  const [photos, declarations, activeFlight] = await Promise.all([
    db.query.dronePhoto.findMany({
      where: eq(dronePhoto.droneId, row.droneId),
      orderBy: [asc(dronePhoto.sortOrder)],
      columns: { pathname: true },
    }),
    db.query.remoteIdDeclaration.findMany({
      where: eq(remoteIdDeclaration.remoteIdId, row.remoteIdId),
      orderBy: [desc(remoteIdDeclaration.createdAt)],
    }),
    findActiveFlight(row.droneId, now),
  ]);

  return {
    ...row,
    buildType: row.buildType as BuildType,
    weightClass: row.weightClass as WeightClass,
    activeFlight,
    // Through `/api/files`, which checks ownership on every request. A stored
    // blob URL handed to a template would resolve for anyone it reached.
    photoUrls: photos.map((photo) => fileUrlFor(photo.pathname)),
    declarations: declarations.map(
      (declaration): DeclarationSummary => ({
        kind: declaration.kind,
        manufacturer: declaration.manufacturer,
        moduleSerial: declaration.moduleSerial,
        docReference: declaration.docReference,
        verifiedAt: declaration.verifiedAt,
        validUntil: declaration.validUntil,
      }),
    ),
    bookings: [],
    scans: [],
  };
}

/**
 * Is there an authorised flight **right now**?
 *
 * Approved only: a pending request is not permission, and reporting one as a
 * flight in progress would tell a bystander an aircraft is sanctioned when a
 * reviewer has not yet said so.
 */
async function findActiveFlight(
  droneId: string,
  now: Date,
): Promise<ActiveFlight | null> {
  const [row] = await db
    .select({
      zoneNameAr: zone.nameAr,
      zoneNameEn: zone.nameEn,
      slotStart: booking.slotStart,
      slotEnd: booking.slotEnd,
    })
    .from(booking)
    .innerJoin(zone, eq(zone.id, booking.zoneId))
    .where(
      and(
        eq(booking.droneId, droneId),
        eq(booking.status, "approved"),
        lte(booking.slotStart, now),
        gt(booking.slotEnd, now),
      ),
    )
    .limit(1);

  return row ?? null;
}

/**
 * Booking history for a scan result: **the owner's own, or everything for a
 * reviewer, and nothing for anyone else.**
 */
export async function listBookingsForRemoteId(
  session: Session | null,
  { remoteIdId, ownerUserId }: { remoteIdId: string; ownerUserId: string },
  limit = 20,
): Promise<BookingSummary[]> {
  if (!session) return [];
  const staff = isReviewer(session);
  if (!staff && session.user.id !== ownerUserId) return [];

  return db
    .select({
      id: booking.id,
      zoneNameAr: zone.nameAr,
      zoneNameEn: zone.nameEn,
      slotStart: booking.slotStart,
      slotEnd: booking.slotEnd,
      status: booking.status,
    })
    .from(booking)
    .innerJoin(zone, eq(zone.id, booking.zoneId))
    .where(eq(booking.remoteIdId, remoteIdId))
    .orderBy(desc(booking.slotStart))
    .limit(limit);
}

/**
 * Who resolved this code. **Reviewers and admins only — never the owner.**
 *
 * An owner who could see their own scan log would learn when and roughly by
 * whom their aircraft was checked, which turns the licence plate into a device
 * pointed back at the bystander who scanned it.
 */
export async function listScansForRemoteId(
  session: Session | null,
  remoteIdId: string,
  limit = 20,
): Promise<ScanSummary[]> {
  if (!session || !isReviewer(session)) return [];

  const rows = await db
    .select({
      id: remoteIdScan.id,
      viewerLevel: remoteIdScan.viewerLevel,
      revealedIdentity: remoteIdScan.revealedIdentity,
      createdAt: remoteIdScan.createdAt,
    })
    .from(remoteIdScan)
    .where(eq(remoteIdScan.remoteIdId, remoteIdId))
    .orderBy(desc(remoteIdScan.createdAt))
    .limit(limit);

  return rows.map((row) => ({ ...row, viewerLevel: row.viewerLevel as ViewerLevel }));
}

/** Reports filed from the public scan page. Reviewers and admins only. */
export async function listDroneReports(session: Session, limit = 50) {
  if (!isReviewer(session)) return [];
  return db
    .select({
      id: droneReport.id,
      reportedCode: droneReport.reportedCode,
      description: droneReport.description,
      locationNote: droneReport.locationNote,
      locationLat: droneReport.locationLat,
      locationLng: droneReport.locationLng,
      createdAt: droneReport.createdAt,
      remoteIdCode: remoteId.code,
    })
    .from(droneReport)
    .leftJoin(remoteId, eq(remoteId.id, droneReport.remoteIdId))
    .orderBy(desc(droneReport.createdAt))
    .limit(limit);
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
