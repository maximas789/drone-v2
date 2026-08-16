import { SYSTEM_ACTOR } from "@/lib/audit";
import { sendEmail } from "@/lib/email/send";
import { localeUrl } from "@/lib/url";
import { applyTransition } from "@/lib/workflow";
import { inngest } from "../client";
import { zoneClosurePublishedEvent } from "../events";
import {
  getLiveBooking,
  getPublishedClosure,
  listBookingsOverlapping,
} from "../queries";

/**
 * A published closure cancels every booking it overtakes.
 *
 * **One `step.run` per booking.** A single failing notification then retries
 * alone; the alternative — one step over the whole list — would replay
 * cancellations that already committed and re-send the emails that went with
 * them. Each step is idempotent anyway: a booking already `cancelled` refuses
 * with `already_applied` and writes nothing.
 *
 * The pilot email here is the one message in this app whose failure has a
 * consequence **outside** the app: a pilot who does not read it may fly a slot
 * that is no longer authorised.
 */
export const closureFanout = inngest.createFunction(
  {
    id: "closure-fanout",
    name: "Cancel bookings under a published closure",
    triggers: [zoneClosurePublishedEvent],
  },
  async ({ event, step }) => {
    const { closureId } = event.data;

    const plan = await step.run("find-overlapping", async () => {
      const closure = await getPublishedClosure(closureId);
      // Unpublished or deleted between send and run: cancelling flights over a
      // closure nobody published would be the worst possible over-reach.
      if (!closure) return { bookingIds: [] as string[], found: false };

      const rows = await listBookingsOverlapping(
        closure.zoneId,
        closure.startsAt,
        closure.endsAt,
      );
      return { bookingIds: rows.map((r) => r.bookingId), found: true };
    });

    if (!plan.found) return { closureId, skipped: "closure-not-published" };

    let cancelled = 0;
    for (const bookingId of plan.bookingIds) {
      const done = await step.run(`cancel-${bookingId}`, () =>
        cancelOne(bookingId, closureId),
      );
      if (done) cancelled += 1;
    }

    return { closureId, overlapping: plan.bookingIds.length, cancelled };
  },
);

async function cancelOne(
  bookingId: string,
  closureId: string,
): Promise<boolean> {
  const closure = await getPublishedClosure(closureId);
  if (!closure) return false;

  const row = await getLiveBooking(bookingId);
  if (!row) return false;

  const reasonAr = closure.reasonAr;
  const reasonEn = closure.reasonEn;
  const reason = row.pilotLocale === "ar" ? reasonAr : reasonEn;

  const outcome = await applyTransition({
    transition: "booking.cancelled_by_closure",
    id: bookingId,
    actor: SYSTEM_ACTOR,
    /**
     * Stored in Arabic, the authored language, because the row is the record —
     * the pilot's own locale decides only what the message to them says.
     */
    reason: reasonAr,
    patch: { cancelledAt: new Date(), cancellationReason: reasonAr },
    notification: {
      userId: row.pilotUserId,
      type: "zoneClosed",
      params: {
        zoneAr: row.zoneNameAr,
        zoneEn: row.zoneNameEn,
        reasonAr,
        reasonEn,
      },
      entityType: "booking",
      entityId: bookingId,
      href: `/bookings/${bookingId}`,
      // No category. A cancellation is not a preference — a pilot who muted it
      // would turn up to a closed zone.
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
      // Verbatim. The template exists to quote the authority, not paraphrase it.
      reason,
      bookingsUrl: localeUrl("/bookings", row.pilotLocale),
    },
  });

  return true;
}
