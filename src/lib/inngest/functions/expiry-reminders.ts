import { cron } from "inngest";
import { audit, SYSTEM_ACTOR } from "@/lib/audit";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { formatNumber } from "@/lib/format";
import { emailEnabled, notify } from "@/lib/notify";
import { localeUrl } from "@/lib/url";
import { inngest } from "../client";
import {
  getApprovedDroneWithExpiry,
  hasReminderMarker,
  listDronesExpiringWithin,
  type ExpiringDroneRow,
} from "../queries";
import {
  CRON_SCHEDULES,
  daysUntilRiyadhDay,
  EXPIRY_REMINDER_ACTION,
  EXPIRY_REMINDER_DAYS,
  reminderThresholdFor,
  riyadhCron,
} from "../rules";

/**
 * Nightly, just after the sweep: warn pilots 60, 30 and 7 days out.
 *
 * **No status changes here**, so nothing goes through the state machine — a
 * reminder is a notification plus a marker, and the marker is what makes the job
 * idempotent. A drone sitting at 29 days out is inside the 30-day threshold on
 * seven consecutive nights; without the marker each of those nights would send
 * the same warning again.
 */
export const registrationExpiryReminders = inngest.createFunction(
  {
    id: "registration-expiry-reminders",
    name: "Registration expiry reminders",
    triggers: [
      cron(riyadhCron(CRON_SCHEDULES["registration-expiry-reminders"])),
    ],
  },
  async ({ step }) => {
    const now = new Date();
    const widest = Math.max(...EXPIRY_REMINDER_DAYS);

    const droneIds = await step.run("find-expiring", async () =>
      (await listDronesExpiringWithin(now, widest)).map((row) => row.droneId),
    );

    let reminded = 0;
    for (const droneId of droneIds) {
      const sent = await step.run(`remind-${droneId}`, () => remindOne(droneId));
      if (sent) reminded += 1;
    }

    return { candidates: droneIds.length, reminded };
  },
);

async function remindOne(droneId: string): Promise<boolean> {
  const now = new Date();
  const row = await getApprovedDroneWithExpiry(droneId);
  if (!row?.registrationExpiresAt) return false;
  const expiresAt = row.registrationExpiresAt;

  /**
   * Riyadh civil days, not `(expiry - now) / 86400000`. A pilot reading "7 days
   * left" is counting calendar days in their own timezone, and 6.4 days of
   * elapsed milliseconds is either 6 or 7 depending on the hour the job ran.
   */
  const daysRemaining = daysUntilRiyadhDay(expiresAt, now);
  const threshold = reminderThresholdFor(daysRemaining);
  if (threshold === null) return false;

  if (await hasReminderMarker(droneId, threshold, EXPIRY_REMINDER_ACTION)) {
    return false;
  }

  /**
   * Marker and notification commit together. If the marker were written after
   * a separate notification insert and the process died between them, the next
   * night would send a second copy of the same warning.
   */
  const wantsEmail = await db.transaction(async (tx) => {
    await audit(tx, {
      actor: SYSTEM_ACTOR,
      entityType: "drone",
      entityId: droneId,
      action: EXPIRY_REMINDER_ACTION,
      after: { threshold, daysRemaining },
    });

    await notify(tx, {
      userId: row.ownerUserId,
      type: "registrationExpiring",
      params: {
        drone: row.nickname,
        // Pre-formatted: a bare number reaching an ICU message is formatted by
        // next-intl in the page locale and comes out ٣٠ under `ar`.
        days: formatNumber(daysRemaining, row.ownerLocale),
      },
      entityType: "drone",
      entityId: droneId,
      href: `/drones/${droneId}`,
      category: "registration_expiry",
    });

    return emailEnabled(tx, row.ownerUserId, "registration_expiry");
  });

  if (wantsEmail) await emailReminder(row, expiresAt, daysRemaining);
  return true;
}

async function emailReminder(
  row: ExpiringDroneRow,
  expiresAt: Date,
  daysRemaining: number,
): Promise<void> {
  await sendEmail({
    to: row.ownerEmail,
    template: "drone-expiring",
    locale: row.ownerLocale,
    userId: row.ownerUserId,
    entityId: row.droneId,
    params: {
      nickname: row.nickname,
      remoteIdCode: row.remoteIdCode ?? "—",
      expiresAt,
      daysRemaining,
      renewUrl: localeUrl(`/drones/${row.droneId}`, row.ownerLocale),
    },
  });
}
