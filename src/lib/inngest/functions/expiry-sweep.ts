import { cron } from "inngest";
import { SYSTEM_ACTOR } from "@/lib/audit";
import { sendEmail } from "@/lib/email/send";
import { localeUrl } from "@/lib/url";
import { applyTransition } from "@/lib/workflow";
import { inngest } from "../client";
import {
  getExpiredDrone,
  listExpiredDrones,
  type ExpiringDroneRow,
} from "../queries";
import { CRON_SCHEDULES, riyadhCron } from "../rules";

/**
 * Nightly: every approved registration whose expiry instant has passed becomes
 * `expired`.
 *
 * **Through the state machine, never by an update.** The audit event is written
 * in the same transaction as the status, and it carries `actorIsSystem: true` —
 * which is how a regulator tells "the clock decided" from "a reviewer decided".
 *
 * **Safe to run twice.** The first step collects ids only; each drone is then
 * re-read inside its own step and `applyTransition` refuses with
 * `already_applied` if it is already expired. No second audit event, no second
 * email.
 */
export const registrationExpirySweep = inngest.createFunction(
  {
    id: "registration-expiry-sweep",
    name: "Registration expiry sweep",
    triggers: [cron(riyadhCron(CRON_SCHEDULES["registration-expiry-sweep"]))],
  },
  async ({ step }) => {
    const now = new Date();

    /**
     * Ids only. A step's return value is JSON — a `Date` would come back a
     * string on the next request and every comparison after it would be
     * comparing a string to a `Date`. The row is re-read where it is used.
     */
    const droneIds = await step.run("find-expired", async () =>
      (await listExpiredDrones(now)).map((row) => row.droneId),
    );

    let expired = 0;

    // One step per drone: a failing email retries that drone alone rather than
    // replaying expirations that already committed.
    for (const droneId of droneIds) {
      const done = await step.run(`expire-${droneId}`, () =>
        expireOne(droneId),
      );
      if (done) expired += 1;
    }

    return { found: droneIds.length, expired };
  },
);

async function expireOne(droneId: string): Promise<boolean> {
  // Re-queried, not trusted from the list: the row may have been renewed or
  // revoked in the seconds since, and a sweep acting on a stale snapshot is
  // how a live registration gets expired.
  const row = await getExpiredDrone(droneId, new Date());
  if (!row) return false;

  const outcome = await applyTransition({
    transition: "drone.expired",
    id: droneId,
    actor: SYSTEM_ACTOR,
    notification: {
      userId: row.ownerUserId,
      type: "registrationExpired",
      params: { drone: row.nickname },
      entityType: "drone",
      entityId: droneId,
      href: `/drones/${droneId}`,
      // No category: expiry is not something a pilot may switch off. Flying an
      // expired registration is the consequence, and it is not in the app.
    },
  });

  if (!outcome.ok) return false;

  // After the transaction, deliberately. A mail provider having a bad morning
  // must never roll back a status change the regulator's trail already records.
  await emailExpiry(row);
  return true;
}

async function emailExpiry(row: ExpiringDroneRow): Promise<void> {
  await sendEmail({
    to: row.ownerEmail,
    template: "drone-expired",
    locale: row.ownerLocale,
    userId: row.ownerUserId,
    entityId: row.droneId,
    params: {
      nickname: row.nickname,
      remoteIdCode: row.remoteIdCode ?? "—",
      // Non-null by construction: `getExpiredDrone` selects on it being set.
      expiredAt: row.registrationExpiresAt ?? new Date(),
      renewUrl: localeUrl(`/drones/${row.droneId}`, row.ownerLocale),
    },
  });
}
