import { cron } from "inngest";
import { SYSTEM_ACTOR } from "@/lib/audit";
import { applyTransition } from "@/lib/workflow";
import { inngest } from "../client";
import { getApprovedBooking, listBookingsToCloseOut } from "../queries";
import { closeoutVerdict, CRON_SCHEDULES, riyadhCron } from "../rules";

/**
 * Every quarter hour: an approved booking whose slot is over stops being
 * approved.
 *
 * Checked in → `completed`. Never checked in, and more than the grace period
 * past the end → `no_show`. Inside the grace period the booking is left alone,
 * because check-in is manual and a pilot packing a drone away is not looking at
 * a phone.
 *
 * **No email and no notification.** Neither outcome is news to the pilot: they
 * either flew or they did not, and a message saying so an hour later is noise
 * that trains people to ignore the messages that matter.
 */
export const bookingCloseout = inngest.createFunction(
  {
    id: "booking-closeout",
    name: "Booking closeout",
    triggers: [cron(riyadhCron(CRON_SCHEDULES["booking-closeout"]))],
  },
  async ({ step }) => {
    const now = new Date();

    const bookingIds = await step.run("find-finished-slots", async () =>
      (await listBookingsToCloseOut(now)).map((row) => row.bookingId),
    );

    let completed = 0;
    let noShow = 0;

    for (const bookingId of bookingIds) {
      const verdict = await step.run(`close-${bookingId}`, () =>
        closeOne(bookingId),
      );
      if (verdict === "completed") completed += 1;
      if (verdict === "no_show") noShow += 1;
    }

    return { found: bookingIds.length, completed, noShow };
  },
);

async function closeOne(bookingId: string): Promise<string | null> {
  const now = new Date();
  const row = await getApprovedBooking(bookingId);
  // Re-read: a pilot may have checked in, or a reviewer cancelled the booking,
  // since the list was collected.
  if (!row) return null;

  const verdict = closeoutVerdict(row, now);
  if (!verdict) return null;

  const outcome = await applyTransition({
    transition: verdict === "completed" ? "booking.completed" : "booking.no_show",
    id: bookingId,
    actor: SYSTEM_ACTOR,
    patch: verdict === "completed" ? { completedAt: now } : {},
  });

  return outcome.ok ? verdict : null;
}
