import { SYSTEM_ACTOR } from "@/lib/audit";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { localeUrl } from "@/lib/url";
import { applyTransition, suspendRemoteIdForDrone } from "@/lib/workflow";
import { inngest } from "../client";
import { droneRevokedEvent } from "../events";
import {
  getDroneForRevocation,
  getLiveBooking,
  listFutureBookingsForDrone,
} from "../queries";

/**
 * A revoked drone loses its Remote ID and every slot it still holds.
 *
 * **The code itself survives.** Suspension changes the status, never the code —
 * a QR sticker already on that airframe must keep resolving, to "this
 * registration is suspended", which is exactly what a field inspector needs to
 * read. A code that went blank would make the sticker lie.
 *
 * Consequences fan out one booking per step, for the same reason the closure
 * job does: a failing email retries one pilot, not all of them.
 */
export const droneRevoked = inngest.createFunction(
  {
    id: "drone-revoked",
    name: "Revoke a drone's Remote ID and future bookings",
    triggers: [droneRevokedEvent],
  },
  async ({ event, step }) => {
    const { droneId, reason } = event.data;

    const suspended = await step.run("suspend-remote-id", async () => {
      const row = await getDroneForRevocation(droneId);
      // Re-read: the decision that sent this event is the authority, and if the
      // drone is no longer revoked then neither is its Remote ID.
      if (!row || row.status !== "revoked") return { done: false, code: null };

      return db.transaction(async (tx) => {
        const result = await suspendRemoteIdForDrone(tx, {
          droneId,
          actor: SYSTEM_ACTOR,
          reason,
        });
        return { done: result.suspended, code: result.code };
      });
    });

    const bookingIds = await step.run("find-future-bookings", async () =>
      (await listFutureBookingsForDrone(droneId, new Date())).map(
        (row) => row.bookingId,
      ),
    );

    let cancelled = 0;
    for (const bookingId of bookingIds) {
      const done = await step.run(`cancel-${bookingId}`, () =>
        cancelOne(bookingId, reason),
      );
      if (done) cancelled += 1;
    }

    return {
      droneId,
      remoteIdSuspended: suspended.done,
      futureBookings: bookingIds.length,
      cancelled,
    };
  },
);

async function cancelOne(
  bookingId: string,
  reason: string | null,
): Promise<boolean> {
  const row = await getLiveBooking(bookingId);
  if (!row) return false;

  /**
   * The same edge the closure fan-out uses. A booking cancelled because its
   * aircraft was revoked is, from the pilot's side, the identical fact: the
   * authority has taken the slot away. A second near-identical transition would
   * be two names for one thing in the regulator's trail.
   */
  const outcome = await applyTransition({
    transition: "booking.cancelled_by_closure",
    id: bookingId,
    actor: SYSTEM_ACTOR,
    reason,
    patch: { cancelledAt: new Date(), cancellationReason: reason },
    notification: {
      userId: row.pilotUserId,
      type: "bookingCancelled",
      params: { zoneAr: row.zoneNameAr, zoneEn: row.zoneNameEn },
      entityType: "booking",
      entityId: bookingId,
      href: `/bookings/${bookingId}`,
    },
  });

  if (!outcome.ok) return false;

  await sendEmail({
    to: row.pilotEmail,
    template: "booking-cancelled-by-authority",
    locale: row.pilotLocale,
    userId: row.pilotUserId,
    entityId: bookingId,
    params: {
      zoneName: row.pilotLocale === "ar" ? row.zoneNameAr : row.zoneNameEn,
      startsAt: row.slotStart,
      endsAt: row.slotEnd,
      reason: reason ?? "",
      bookingsUrl: localeUrl("/bookings", row.pilotLocale),
    },
  });

  return true;
}
