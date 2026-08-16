import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { remoteId } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/send";
import { qrPathnameFor, renderQrPng } from "@/lib/qr/render";
import { putFile } from "@/lib/storage";
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

      const png = await renderQrPng(row.remoteIdCode);
      /**
       * Same code, same pathname, overwritten in place. Re-running this must
       * never mint a second file — a sticker already on an airframe points at
       * the first one.
       */
      const file = await putFile({
        buffer: png,
        filename: qrPathnameFor(row.remoteIdCode),
        contentType: "image/png",
        prefix: "qr",
      });

      await db
        .update(remoteId)
        .set({ qrPathname: file.pathname, updatedAt: new Date() })
        .where(eq(remoteId.id, row.remoteIdId));

      return { skipped: null, pathname: file.pathname };
    });

    if (stored.skipped) return { droneId, skipped: stored.skipped };

    await step.run("email-approval", async () => {
      const row = await getApprovedDroneForQr(droneId);
      if (!row || !row.remoteIdCode) return;

      await sendEmail({
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
          cardUrl: localeUrl(`/drones/${droneId}/card`, row.ownerLocale),
        },
      });
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
