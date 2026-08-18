import { db } from "@/lib/db";
import { linkNotificationEmail } from "@/lib/data/notification";
import { sendEmail } from "@/lib/email/send";
import { storeQrForRemoteId } from "@/lib/qr/store";
import { localeUrl } from "@/lib/url";
import { inngest } from "../client";
import { droneApprovedEvent } from "../events";
import { getApprovedDroneForQr } from "../queries";

/**
 * On approval: render the QR sticker, store it, record where it went, then tell
 * the pilot.
 *
 * **A job rather than an inline call inside the approval action.** Storage is a
 * network call that can fail transiently, and a reviewer's decision must not be
 * held hostage to it — the decision commits, this retries.
 *
 * The order matters: **store before emailing**. The approval email links to the
 * digital ID card, and a card with no QR on it is the one thing that email is
 * for.
 */
export const qrRender = inngest.createFunction(
  { id: "qr-render", name: "Render Remote ID QR", triggers: [droneApprovedEvent] },
  async ({ event, step }) => {
    const { droneId } = event.data;

    const stored = await step.run("render-and-store", async () => {
      const row = await getApprovedDroneForQr(droneId);
      if (!row) return { skipped: "drone-not-found" as const };
      if (row.status !== "approved") return { skipped: "not-approved" as const };
      if (!row.remoteIdId || !row.remoteIdCode) {
        return { skipped: "no-remote-id" as const };
      }

      /**
       * **Shared with F19's retry**, which is the same act driven by a pilot
       * looking at a card with no QR on it. Same code, same pathname,
       * overwritten in place: re-running must never mint a second file, because
       * a sticker already on an airframe points at the first one.
       */
      const pathname = await storeQrForRemoteId({
        remoteIdId: row.remoteIdId,
        code: row.remoteIdCode,
      });

      return { skipped: null, pathname };
    });

    if (stored.skipped) return { droneId, skipped: stored.skipped };

    await step.run("email-approval", async () => {
      const row = await getApprovedDroneForQr(droneId);
      if (!row || !row.remoteIdCode) return;

      const sent = await sendEmail({
        to: row.ownerEmail,
        template: "drone-approved",
        locale: row.ownerLocale,
        userId: row.ownerUserId,
        entityId: droneId,
        params: {
          nickname: row.nickname,
          remoteIdCode: row.remoteIdCode,
          /**
           * A registration with no expiry date should not exist by the time a
           * drone is approved — F14 sets it. Falling back to "now" would print
           * a card that expired the moment it was issued, so the job fails
           * loudly instead and retries once the column is right.
           */
          validUntil: mustHaveExpiry(row.registrationExpiresAt, droneId),
          cardUrl: localeUrl(`/drones/${droneId}/remote-id`, row.ownerLocale),
        },
      });

      /**
       * Ties the in-app notification to the email that carried it, which is
       * what lets F29 answer "the notification is there — why didn't the email
       * arrive?" with the provider's own error rather than a shrug.
       *
       * **After the send, never before**, and it never fails the run: the
       * approval and the notification are already committed, and a missing link
       * is a worse report, not a worse outcome.
       */
      if (sent.logId) {
        await linkNotificationEmail(db, {
          userId: row.ownerUserId,
          entityId: droneId,
          emailLogId: sent.logId,
        });
      }
    });

    return { droneId, skipped: null, pathname: stored.pathname };
  },
);

function mustHaveExpiry(value: Date | null, droneId: string): Date {
  if (!value) {
    throw new Error(
      `Drone ${droneId} is approved with no registrationExpiresAt — the approval that set the status must also set the expiry.`,
    );
  }
  return value;
}
