import { sendEmail } from "@/lib/email/send";
import { localeUrl } from "@/lib/url";
import { inngest } from "../client";
import { bookingRejectedEvent } from "../events";
import { getRejectedBookingForEmail } from "../queries";

/**
 * A refused booking, explained to the pilot in their own inbox.
 *
 * The twin of `drone-rejected`, and the second half of thread 61:
 * `booking-rejected` was written, registered and tested with no caller, so a
 * pilot whose slot was refused learned it only by opening the app. Through a
 * job rather than from the action, for thread 24's reason.
 *
 * **The reviewer's reason is quoted verbatim** — the same rule the drone
 * rejection follows, and the reason the column is free text.
 *
 * **`alternatives` is sent empty, deliberately.** The template is built for
 * that case and says so rather than dropping the section, and the honest
 * alternative is worse: a real list would have to come from the airspace
 * context — a zone's hours, its closures, and the seats already taken on each
 * candidate slot — which is built per-session by `buildDayContext`, not
 * available to a system actor. Offering slots that turn out to be closed or
 * full would send a refused pilot to a second refusal, with the app's name on
 * the suggestion. The email carries the reason and the link to the picker,
 * which is the surface that always knows the truth.
 */
export const bookingRejected = inngest.createFunction(
  {
    id: "booking-rejected",
    name: "Email the pilot a refused booking",
    triggers: [bookingRejectedEvent],
  },
  async ({ event, step }) => {
    const { bookingId } = event.data;

    return step.run("send-rejection-email", async () => {
      const row = await getRejectedBookingForEmail(bookingId);

      /**
       * Re-read and refuse anything no longer rejected — the decision that sent
       * this event is the authority. A booking since reinstated, or cancelled
       * by its pilot, must not be described to them as refused.
       */
      if (!row || row.status !== "rejected") {
        return { sent: false, reason: "not-rejected" as const };
      }

      await sendEmail({
        to: row.pilotEmail,
        template: "booking-rejected",
        locale: row.pilotLocale,
        userId: row.pilotUserId,
        entityId: bookingId,
        params: {
          zoneName: row.pilotLocale === "ar" ? row.zoneNameAr : row.zoneNameEn,
          startsAt: row.slotStart,
          endsAt: row.slotEnd,
          reason: row.rejectionReason ?? "",
          alternatives: [],
          bookUrl: localeUrl("/bookings/new", row.pilotLocale),
        },
      });

      return { sent: true, bookingId };
    });
  },
);
