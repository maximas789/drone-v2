import { SYSTEM_ACTOR } from "@/lib/audit";
import { sendEmail } from "@/lib/email/send";
import { localeUrl } from "@/lib/url";
import { applyTransition } from "@/lib/workflow";
import { inngest } from "../client";
import { zoneSuspendedEvent } from "../events";
import {
  getLiveBooking,
  getSuspendedZone,
  listFutureBookingsInZone,
} from "../queries";

/**
 * A suspended zone cancels every flight still ahead of it.
 *
 * **The same fan-out shape as a published closure**, deliberately: one
 * `step.run` per booking, so a failing notification retries alone rather than
 * replaying cancellations that already committed and re-sending the emails that
 * went with them. Each step is idempotent — a booking already `cancelled`
 * refuses with `already_applied` and writes nothing.
 *
 * The transition is `booking.cancelled_by_closure`, not an edge of its own. A
 * suspension and a closure are the same thing to a pilot — the authority has
 * withdrawn the airspace under their slot — and inventing a second terminal
 * edge that means exactly that would give the trail two words for one act.
 *
 * The zone is re-read on every step: an admin who lifted the suspension between
 * the send and the run must not have flights cancelled under it.
 */
export const zoneSuspended = inngest.createFunction(
  {
    id: "zone-suspended",
    name: "Cancel future bookings in a suspended zone",
    triggers: [zoneSuspendedEvent],
  },
  async ({ event, step }) => {
    const { zoneId, reasonAr, reasonEn } = event.data;

    const plan = await step.run("find-future-bookings", async () => {
      const zone = await getSuspendedZone(zoneId);
      if (!zone) return { bookingIds: [] as string[], found: false };

      const rows = await listFutureBookingsInZone(zoneId, new Date());
      return { bookingIds: rows.map((row) => row.bookingId), found: true };
    });

    if (!plan.found) return { zoneId, skipped: "zone-not-suspended" };

    let cancelled = 0;
    for (const bookingId of plan.bookingIds) {
      const done = await step.run(`cancel-${bookingId}`, () =>
        cancelOne(bookingId, zoneId, reasonAr, reasonEn),
      );
      if (done) cancelled += 1;
    }

    return { zoneId, future: plan.bookingIds.length, cancelled };
  },
);

async function cancelOne(
  bookingId: string,
  zoneId: string,
  reasonAr: string,
  reasonEn: string,
): Promise<boolean> {
  if (!(await getSuspendedZone(zoneId))) return false;

  const row = await getLiveBooking(bookingId);
  if (!row) return false;

  const reason = row.pilotLocale === "ar" ? reasonAr : reasonEn;

  const outcome = await applyTransition({
    transition: "booking.cancelled_by_closure",
    id: bookingId,
    actor: SYSTEM_ACTOR,
    // Arabic on the row, as the closure fan-out does: the record keeps the
    // authored language, and the pilot's locale decides only what they read.
    reason: reasonAr,
    patch: { cancelledAt: new Date(), cancellationReason: reasonAr },
    notification: {
      userId: row.pilotUserId,
      type: "zoneSuspended",
      params: {
        zoneAr: row.zoneNameAr,
        zoneEn: row.zoneNameEn,
        reasonAr,
        reasonEn,
      },
      entityType: "booking",
      entityId: bookingId,
      href: `/bookings/${bookingId}`,
      // No category — a pilot who muted this would turn up to closed airspace.
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
      // Verbatim. The template quotes the authority; it does not paraphrase it.
      reason,
      bookingsUrl: localeUrl("/bookings", row.pilotLocale),
    },
  });

  return true;
}
