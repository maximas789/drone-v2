import { sendEmail } from "@/lib/email/send";
import { localeUrl } from "@/lib/url";
import { inngest } from "../client";
import { bookingApprovedEvent } from "../events";
import { getApprovedBookingForEmail } from "../queries";

/**
 * An approved booking, confirmed to the pilot in their own inbox.
 *
 * **The third template with no caller**, found by auditing all eleven rather
 * than by taking the two that were reported. `booking-approved` was written,
 * registered and tested, and nothing sent it — so a pilot whose slot a reviewer
 * granted got a bell notification and no mail, while the *rejection* they might
 * equally have received now did send one. F06 specifies it.
 *
 * Only reviewer approvals reach here. A booking in an auto-approving zone is
 * confirmed inside `createBookingAction`, and the pilot is looking at the
 * screen that says so — an email a second later would be telling somebody what
 * they had just that moment read.
 */
export const bookingApproved = inngest.createFunction(
  {
    id: "booking-approved",
    name: "Email the pilot an approved booking",
    triggers: [bookingApprovedEvent],
  },
  async ({ event, step }) => {
    const { bookingId } = event.data;

    return step.run("send-approval-email", async () => {
      const row = await getApprovedBookingForEmail(bookingId);

      // Re-read: a booking cancelled between the decision and this step must
      // not be confirmed to the pilot as though it still stood.
      if (!row || row.status !== "approved") {
        return { sent: false, reason: "not-approved" as const };
      }

      await sendEmail({
        to: row.pilotEmail,
        template: "booking-approved",
        locale: row.pilotLocale,
        userId: row.pilotUserId,
        entityId: bookingId,
        params: {
          zoneName: row.pilotLocale === "ar" ? row.zoneNameAr : row.zoneNameEn,
          startsAt: row.slotStart,
          endsAt: row.slotEnd,
          /**
           * A zone with no ceiling is unlimited, and the template needs a
           * number. `0` would read as "ground level" — the opposite — so the
           * unlimited case falls back to the airspace limit the rest of the app
           * already treats as the ceiling of last resort.
           */
          ceilingMetres: row.ceilingAglM ?? 120,
          bookingUrl: localeUrl(`/bookings/${bookingId}`, row.pilotLocale),
        },
      });

      return { sent: true, bookingId };
    });
  },
);
