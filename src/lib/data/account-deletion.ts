import "server-only";

import { and, count, eq, gt, inArray } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { user } from "@/lib/db/auth-schema";
import { booking, drone, dronePhoto, remoteId, zone } from "@/lib/db/schema";
import { deleteFile } from "@/lib/storage";
import type { Session } from "@/lib/session";
import type { Actor } from "@/lib/audit";

/**
 * Closing an account: what stops it, and what it actually does.
 *
 * **Most of the work is the schema's, not this file's.** Of the 22 foreign keys
 * pointing at `user`, six are `cascade` — `account`, `session`,
 * `pilot_profile`, `notification`, `notification_preference`,
 * `review_presence` — and fourteen are `set null`, including
 * `audit_event.actor_user_id`, `email_log.user_id` and
 * `remote_id_scan.viewer_user_id`. Deleting the row therefore erases the
 * personal record and anonymises the trail **in one statement**, which is
 * exactly what F28 asks for and is far more trustworthy than a hand-written
 * sequence that has to remember all twenty-two.
 *
 * So this module only has to handle what the schema deliberately does *not* do
 * automatically:
 *
 * | | |
 * |---|---|
 * | `booking.pilot_user_id` | `restrict` — deleted here, first |
 * | `drone.owner_user_id` | `set null` since F28c — the aircraft survives, owner-less |
 * | `drone_photo` | hangs off `drone`, which survives — deleted here |
 * | stored blobs | not in the database at all — deleted here |
 *
 * **The blobs are the part with no safety net.** Storage is not transactional
 * and nothing rolls it back, so files are removed *before* the rows that name
 * them: a failure then leaves rows pointing at missing files, which is a broken
 * image. The other order leaves files nothing can name, which is an orphaned
 * blob nobody can find and nobody can delete — a privacy leak rather than a
 * cosmetic fault. F19b made the same call for the same reason.
 */

/** An approved flight the pilot still holds. Deletion is refused while one exists. */
export type BlockingBooking = {
  id: string;
  zoneNameAr: string;
  zoneNameEn: string;
  slotStart: Date;
};

export type DeletionBlock =
  | { reason: "approved_bookings"; bookings: BlockingBooking[] }
  | { reason: "last_admin" };

/**
 * Why this account cannot be closed right now, or `null`.
 *
 * **An approved future flight is the one that matters.** An authorised flight
 * with no accountable operator is precisely what this platform exists to
 * prevent, so the account stays until the pilot cancels it or it passes. The
 * refusal names the bookings rather than saying "you have bookings", because a
 * pilot with four cannot act on the second sentence.
 *
 * **The last admin is blocked too**, and for an unglamorous reason: the first
 * account created becomes admin, and an app whose only administrator deletes
 * themselves has no way back in — no promotion path, no console, nothing. It is
 * checked on `role`, not on a count of people who *could* be promoted, because
 * there is nobody left to do the promoting.
 */
export async function deletionBlock(
  session: Session,
  now: Date = new Date(),
): Promise<DeletionBlock | null> {
  const [bookings, admins] = await Promise.all([
    db
      .select({
        id: booking.id,
        zoneNameAr: zone.nameAr,
        zoneNameEn: zone.nameEn,
        slotStart: booking.slotStart,
      })
      .from(booking)
      .innerJoin(zone, eq(zone.id, booking.zoneId))
      .where(
        and(
          eq(booking.pilotUserId, session.user.id),
          eq(booking.status, "approved"),
          gt(booking.slotStart, now),
        ),
      )
      .limit(20),
    db.select({ value: count() }).from(user).where(eq(user.role, "admin")),
  ]);

  if (bookings.length > 0) {
    return { reason: "approved_bookings", bookings };
  }

  const adminCount = admins[0]?.value ?? 0;
  if (session.user.role === "admin" && adminCount <= 1) {
    return { reason: "last_admin" };
  }

  return null;
}

export type DeletionSummary = {
  dronesAnonymised: number;
  bookingsDeleted: number;
  photosDeleted: number;
  filesDeleted: number;
};

/**
 * Close the account. **Assumes `deletionBlock` returned `null`** — the caller
 * checks, and checks again inside the same request.
 *
 * The audit event is written **before** the delete and in the same transaction,
 * so it is on disk when the cascade nulls its own `actor_user_id`. That is not
 * a trick: it is the row surviving its author, which is the property F27's
 * privacy policy promises and the reason the trail is worth anything.
 */
export async function deleteAccount(
  session: Session,
  actor: Actor,
  meta: { ipHash: string | null; userAgent: string | null },
): Promise<DeletionSummary> {
  const userId = session.user.id;

  const drones = await db
    .select({ id: drone.id })
    .from(drone)
    .where(eq(drone.ownerUserId, userId));
  const droneIds = drones.map((row) => row.id);

  // --- storage first, for the reason in the module comment -----------------
  let filesDeleted = 0;
  if (droneIds.length > 0) {
    const [photos, codes] = await Promise.all([
      db
        .select({ pathname: dronePhoto.pathname })
        .from(dronePhoto)
        .where(inArray(dronePhoto.droneId, droneIds)),
      db
        .select({ qrPathname: remoteId.qrPathname })
        .from(remoteId)
        .where(inArray(remoteId.droneId, droneIds)),
    ]);

    const pathnames = [
      ...photos.map((row) => row.pathname),
      ...codes
        .map((row) => row.qrPathname)
        .filter((value): value is string => value !== null),
    ];

    for (const pathname of pathnames) {
      /**
       * One failure must not strand the rest. A file that will not delete is a
       * file left behind — bad — but abandoning the loop would leave *every
       * later* file behind and the account undeleted, which is worse and is
       * also the state the person asked us to leave.
       */
      try {
        await deleteFile(pathname);
        filesDeleted += 1;
      } catch {
        // Intentionally swallowed; see above.
      }
    }
  }

  return db.transaction(async (tx) => {
    await audit(tx, {
      actor,
      entityType: "user",
      entityId: userId,
      action: "user.deleted",
      /**
       * Counts, never content. The trail records that an account closed and
       * what it took with it; putting the person's name or address in `before`
       * would keep a copy of exactly what the deletion was for, in the one
       * table that has no delete path.
       */
      after: {
        drones: droneIds.length,
      },
      ipHash: meta.ipHash,
      userAgent: meta.userAgent,
    });

    const bookingsDeleted = await tx
      .delete(booking)
      .where(eq(booking.pilotUserId, userId))
      .returning({ id: booking.id });

    const photosDeleted =
      droneIds.length > 0
        ? await tx
            .delete(dronePhoto)
            .where(inArray(dronePhoto.droneId, droneIds))
            .returning({ id: dronePhoto.id })
        : [];

    /**
     * The one statement that does the rest: six cascades and fourteen
     * `set null`s, including `drone.owner_user_id` — which is what turns every
     * one of this pilot's registrations into a `withdrawn` one whose Remote ID
     * still resolves.
     */
    await tx.delete(user).where(eq(user.id, userId));

    return {
      dronesAnonymised: droneIds.length,
      bookingsDeleted: bookingsDeleted.length,
      photosDeleted: photosDeleted.length,
      filesDeleted,
    };
  });
}
