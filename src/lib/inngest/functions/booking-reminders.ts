import { cron } from "inngest";
import { audit, SYSTEM_ACTOR } from "@/lib/audit";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { emailEnabled, notify } from "@/lib/notify";
import { localeUrl } from "@/lib/url";
import { inngest } from "../client";
import {
  getApprovedBooking,
  hasBookingMarker,
  listBookingsToRemind,
  type BookingRow,
} from "../queries";
import {
  BOOKING_REMINDER_ACTION,
  bookingReminderWindow,
  CRON_SCHEDULES,
  riyadhCron,
} from "../rules";

/**
 * Hourly: the day before an approved slot, remind the pilot.
 *
 * The window is deliberately the **whole** 24 hours ahead rather than an hourly
 * slice — a booking created inside the window would fall in no slice at all and
 * would silently get no reminder. The marker is what keeps that from sending
 * twenty-four of them.
 */
export const bookingReminders = inngest.createFunction(
  {
    id: "booking-reminders",
    name: "Booking reminders",
    triggers: [cron(riyadhCron(CRON_SCHEDULES["booking-reminders"]))],
  },
  async ({ step }) => {
    const { from, to } = bookingReminderWindow(new Date());

    const bookingIds = await step.run("find-upcoming", async () =>
      (await listBookingsToRemind(from, to)).map((row) => row.bookingId),
    );

    let reminded = 0;
    for (const bookingId of bookingIds) {
      const sent = await step.run(`remind-${bookingId}`, () =>
        remindOne(bookingId),
      );
      if (sent) reminded += 1;
    }

    return { candidates: bookingIds.length, reminded };
  },
);

async function remindOne(bookingId: string): Promise<boolean> {
  const row = await getApprovedBooking(bookingId);
  if (!row) return false;
  if (await hasBookingMarker(bookingId, BOOKING_REMINDER_ACTION)) return false;

  const zoneName = row[row.pilotLocale === "ar" ? "zoneNameAr" : "zoneNameEn"];

  const wantsEmail = await db.transaction(async (tx) => {
    await audit(tx, {
      actor: SYSTEM_ACTOR,
      entityType: "booking",
      entityId: bookingId,
      action: BOOKING_REMINDER_ACTION,
      after: { slotStart: row.slotStart.toISOString() },
    });

    await notify(tx, {
      userId: row.pilotUserId,
      type: "bookingReminder",
      /**
       * Both names, so the bell can render in whichever locale the reader has
       * open later — a pilot who switches to English must not find an Arabic
       * zone name frozen into an old notification.
       */
      params: { zoneAr: row.zoneNameAr, zoneEn: row.zoneNameEn },
      entityType: "booking",
      entityId: bookingId,
      href: `/bookings/${bookingId}`,
      category: "booking_reminder",
    });

    return emailEnabled(tx, row.pilotUserId, "booking_reminder");
  });

  if (wantsEmail) await emailReminder(row, zoneName);
  return true;
}

async function emailReminder(row: BookingRow, zoneName: string): Promise<void> {
  await sendEmail({
    to: row.pilotEmail,
    template: "booking-reminder",
    locale: row.pilotLocale,
    userId: row.pilotUserId,
    entityId: row.bookingId,
    params: {
      zoneName,
      startsAt: row.slotStart,
      endsAt: row.slotEnd,
      ceilingMetres: row.ceilingAglM,
      remoteIdCode: row.remoteIdCode ?? "—",
      bookingUrl: localeUrl(`/bookings/${row.bookingId}`, row.pilotLocale),
    },
  });
}
