import { sendEmail } from "@/lib/email/send";
import { localeUrl } from "@/lib/url";
import { inngest } from "../client";
import { droneRejectedEvent } from "../events";
import { getRejectedDroneForEmail } from "../queries";

/**
 * A rejected registration, explained to the pilot in their own inbox.
 *
 * **This closes thread 61.** `drone-rejected` was written, registered in
 * `EMAIL_TEMPLATES` and tested, and nothing ever sent it:
 * `rejectDroneAction` wrote the row, the audit event and a `droneRejected`
 * notification, and stopped. An approval reached the pilot by mail because the
 * QR job sends one; a rejection did not, so a pilot learned their registration
 * had been refused only by opening the app — an asymmetry a reviewer would
 * never expect, on the half of the decision that actually asks them to do
 * something.
 *
 * **Through a job, not from the action** (thread 24). A decision must not fail,
 * or be held open, because a mail provider is slow — and `sendEmail` writes its
 * log row before the network call, so a send that never completes is still
 * visible on the system page rather than lost.
 *
 * **The reason is quoted verbatim.** Not a code, not a summary, not a
 * translation: F06's criterion for this template, and the reason
 * `drone.rejectionReason` is a column rather than an enum. The template renders
 * it as text, never as markup.
 */
export const droneRejected = inngest.createFunction(
  {
    id: "drone-rejected",
    name: "Email the pilot a rejected registration",
    triggers: [droneRejectedEvent],
  },
  async ({ event, step }) => {
    const { droneId } = event.data;

    return step.run("send-rejection-email", async () => {
      const row = await getRejectedDroneForEmail(droneId);

      /**
       * Re-read, and refuse anything that is not still rejected. The decision
       * that sent this event is the authority — if the pilot has already
       * resubmitted, or a reviewer reinstated the registration, then telling
       * them it was refused is worse than telling them nothing.
       */
      if (!row || row.status !== "rejected") {
        return { sent: false, reason: "not-rejected" as const };
      }
      if (!row.ownerUserId || !row.ownerEmail) {
        return { sent: false, reason: "no-owner" as const };
      }

      await sendEmail({
        to: row.ownerEmail,
        template: "drone-rejected",
        locale: row.ownerLocale,
        userId: row.ownerUserId,
        entityId: droneId,
        params: {
          nickname: row.nickname,
          reason: row.rejectionReason ?? "",
          // `rejected` is editable — the pilot is meant to correct and
          // resubmit, so the link goes to the editor rather than the record.
          editUrl: localeUrl(`/drones/${droneId}/edit`, row.ownerLocale),
        },
      });

      return { sent: true, droneId };
    });
  },
);
