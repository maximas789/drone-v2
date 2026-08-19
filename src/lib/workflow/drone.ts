import "server-only";

import { and, count, eq, isNull } from "drizzle-orm";
import type { Actor } from "@/lib/audit";
import { db, type DbExecutor } from "@/lib/db";
import { drone, dronePhoto, pilotProfile } from "@/lib/db/schema";
import { issueRemoteId } from "@/lib/remote-id/issue";
import { applyTransition, type TransitionOutcome } from "./apply";
import { isOwnSubmission, registrationExpiryFrom } from "./rules";
import { reactivateRemoteIdForDrone, suspendRemoteIdForDrone } from "./remote-id";

/**
 * The drone lifecycle: the guards that need to *read* something, and the
 * side-effects that must commit with the status.
 *
 * `transitions.ts` says which edges exist and who may drive them.
 * `apply.ts` enforces that, plus the written reason. **This file is where the
 * questions live that a table cannot answer** — whether a profile is complete,
 * whether there is a photograph, whether the aircraft has a Remote ID yet.
 *
 * Every function takes the executor when it has one, because approving a drone
 * is four writes (status, registration dates, Remote ID row, audit event) that
 * are one fact.
 */

export type DroneOutcome =
  | { ok: true; from: string; to: string; remoteIdCode?: string }
  | {
      ok: false;
      reason:
        | "not_found"
        | "invalid_transition"
        | "already_applied"
        | "reason_required"
        | "profile_incomplete"
        | "photo_required"
        | "serial_required"
        /** Four eyes: the reviewer is the pilot who submitted it. */
        | "own_submission";
      from?: string;
    };

/**
 * Draft → pending.
 *
 * The guards are the reviewer's time: a submission with no photograph, or from
 * a pilot with no profile, is one the queue would bounce straight back.
 *
 * **The serial rule is the exact inversion of GACA's** — a serial number is
 * required *only* for a commercial airframe. A self-built or FPV aircraft has
 * none, and that is the entire product.
 */
export async function submitDrone(
  tx: DbExecutor,
  { droneId, actor }: { droneId: string; actor: Actor },
): Promise<DroneOutcome> {
  const row = await tx.query.drone.findFirst({ where: eq(drone.id, droneId) });
  if (!row) return { ok: false, reason: "not_found" };

  const guard = await submissionGuards(tx, row);
  if (guard) return { ok: false, reason: guard };

  return toOutcome(
    await applyTransition(
      {
        transition: "drone.submitted",
        id: droneId,
        actor,
        patch: { submittedAt: new Date() },
      },
      tx,
    ),
  );
}

/** Rejected → pending. The prior rejection stays in the trail; the count goes up. */
export async function resubmitDrone(
  tx: DbExecutor,
  { droneId, actor }: { droneId: string; actor: Actor },
): Promise<DroneOutcome> {
  const row = await tx.query.drone.findFirst({ where: eq(drone.id, droneId) });
  if (!row) return { ok: false, reason: "not_found" };

  const guard = await submissionGuards(tx, row);
  if (guard) return { ok: false, reason: guard };

  return toOutcome(
    await applyTransition(
      {
        transition: "drone.resubmitted",
        id: droneId,
        actor,
        patch: {
          submittedAt: new Date(),
          rejectionCount: row.rejectionCount + 1,
          // The reason is cleared from the *row* — it survives in `audit_event`,
          // which is the copy a regulator reads.
          rejectionReason: null,
        },
      },
      tx,
    ),
  );
}

/**
 * Expired → pending. Renewal, not re-registration.
 *
 * **The Remote ID code is untouched here and reactivated on approval.** A QR
 * sticker already on the airframe must keep resolving; minting a second code
 * would strand every label already printed.
 */
export async function renewDrone(
  tx: DbExecutor,
  { droneId, actor }: { droneId: string; actor: Actor },
): Promise<DroneOutcome> {
  const row = await tx.query.drone.findFirst({ where: eq(drone.id, droneId) });
  if (!row) return { ok: false, reason: "not_found" };

  const guard = await submissionGuards(tx, row);
  if (guard) return { ok: false, reason: guard };

  return toOutcome(
    await applyTransition(
      {
        transition: "drone.renewal_submitted",
        id: droneId,
        actor,
        patch: { submittedAt: new Date() },
      },
      tx,
    ),
  );
}

/**
 * Pending → approved. **The moment a form becomes an aircraft.**
 *
 * Four things commit together: the status, the registration window, the
 * `remote_id` row, and the audit event. If the Remote ID cannot be issued, the
 * approval does not happen — an approved drone with no identity is precisely
 * the state this product exists to make impossible.
 *
 * The QR render and the approval email are **not** here. They are an Inngest
 * job (F08), because storage and mail are network calls that can fail
 * transiently and a reviewer's decision must not be held hostage to either. The
 * caller sends `droneApprovedEvent` **after the transaction commits**.
 */
export async function approveDrone(
  tx: DbExecutor,
  {
    droneId,
    actor,
    at = new Date(),
  }: { droneId: string; actor: Actor; at?: Date },
): Promise<DroneOutcome> {
  const row = await tx.query.drone.findFirst({ where: eq(drone.id, droneId) });
  if (!row) return { ok: false, reason: "not_found" };
  /**
   * **Four eyes, refused here rather than in the action.** The panel greys the
   * buttons and says why, but a server action is an ordinary POST and the
   * screen is not a check. Checked before the transition, so a refused
   * self-approval writes nothing at all — not even an audit event, because
   * nothing happened.
   */
  if (isOwnSubmission(actor.userId, row.ownerUserId)) {
    return { ok: false, reason: "own_submission", from: row.status };
  }

  const outcome = await applyTransition(
    {
      transition: "drone.approved",
      id: droneId,
      actor,
      patch: {
        decidedAt: at,
        decidedByUserId: actor.userId,
        rejectionReason: null,
        registrationIssuedAt: at,
        registrationExpiresAt: registrationExpiryFrom(at),
      },
      notification: {
        userId: row.ownerUserId,
        type: "droneApproved",
        params: { drone: row.nickname },
        entityType: "drone",
        entityId: droneId,
        href: `/drones/${droneId}`,
        // No category. An approval is not something a pilot may switch off.
      },
    },
    tx,
  );

  if (!outcome.ok) return toOutcome(outcome);

  /**
   * Issued **after** the transition, inside the same transaction. A renewal
   * finds the existing row and keeps its code; only a first approval mints one.
   */
  const issued = await issueRemoteId(tx, { droneId, actor });

  /**
   * A renewal's Remote ID was suspended when the registration lapsed — or was
   * never suspended at all, in which case this writes nothing. Idempotent
   * either way.
   */
  await reactivateRemoteIdForDrone(tx, { droneId, actor });

  return { ok: true, from: outcome.from, to: outcome.to, remoteIdCode: issued.code };
}

/** Pending → rejected. The reason is required, ≥ 20 characters, and quoted verbatim to the pilot. */
export async function rejectDrone(
  tx: DbExecutor,
  {
    droneId,
    actor,
    reason,
    at = new Date(),
  }: { droneId: string; actor: Actor; reason: string; at?: Date },
): Promise<DroneOutcome> {
  const row = await tx.query.drone.findFirst({ where: eq(drone.id, droneId) });
  if (!row) return { ok: false, reason: "not_found" };
  // Four eyes applies to a refusal as much as to an approval: a reviewer who
  // can reject their own submission can clear their own queue.
  if (isOwnSubmission(actor.userId, row.ownerUserId)) {
    return { ok: false, reason: "own_submission", from: row.status };
  }

  return toOutcome(
    await applyTransition(
      {
        transition: "drone.rejected",
        id: droneId,
        actor,
        reason,
        patch: {
          decidedAt: at,
          decidedByUserId: actor.userId,
          rejectionReason: reason.trim(),
        },
        notification: {
          userId: row.ownerUserId,
          type: "droneRejected",
          params: { drone: row.nickname },
          entityType: "drone",
          entityId: droneId,
          href: `/drones/${droneId}`,
        },
      },
      tx,
    ),
  );
}

/**
 * Approved → revoked. **Admin only.**
 *
 * The Remote ID is suspended here, in the same transaction as the status — the
 * two are one fact, and a revoked drone whose identity still reads "active" to
 * a field inspector would be the worst possible half-state. Cancelling the
 * drone's future bookings is the *consequence* and is fanned out by the
 * `drone/revoked` job, one step per booking, which the caller sends after the
 * commit.
 */
export async function revokeDrone(
  tx: DbExecutor,
  {
    droneId,
    actor,
    reason,
    at = new Date(),
  }: { droneId: string; actor: Actor; reason: string; at?: Date },
): Promise<DroneOutcome> {
  const row = await tx.query.drone.findFirst({ where: eq(drone.id, droneId) });
  if (!row) return { ok: false, reason: "not_found" };

  const outcome = await applyTransition(
    {
      transition: "drone.revoked",
      id: droneId,
      actor,
      reason,
      patch: {
        revokedAt: at,
        revocationReason: reason.trim(),
        decidedAt: at,
        decidedByUserId: actor.userId,
      },
      notification: {
        userId: row.ownerUserId,
        type: "droneRevoked",
        params: { drone: row.nickname },
        entityType: "drone",
        entityId: droneId,
        href: `/drones/${droneId}`,
      },
    },
    tx,
  );

  if (!outcome.ok) return toOutcome(outcome);

  await suspendRemoteIdForDrone(tx, { droneId, actor, reason: reason.trim() });
  return toOutcome(outcome);
}

/** Revoked → approved. Admin only, reason required, and the Remote ID comes back. */
export async function reinstateDrone(
  tx: DbExecutor,
  {
    droneId,
    actor,
    reason,
    at = new Date(),
  }: { droneId: string; actor: Actor; reason: string; at?: Date },
): Promise<DroneOutcome> {
  const row = await tx.query.drone.findFirst({ where: eq(drone.id, droneId) });
  if (!row) return { ok: false, reason: "not_found" };

  const outcome = await applyTransition(
    {
      transition: "drone.reinstated",
      id: droneId,
      actor,
      reason,
      patch: {
        revokedAt: null,
        revocationReason: null,
        decidedAt: at,
        decidedByUserId: actor.userId,
      },
      notification: {
        userId: row.ownerUserId,
        type: "droneReinstated",
        params: { drone: row.nickname },
        entityType: "drone",
        entityId: droneId,
        href: `/drones/${droneId}`,
      },
    },
    tx,
  );

  if (!outcome.ok) return toOutcome(outcome);

  await reactivateRemoteIdForDrone(tx, { droneId, actor });
  return toOutcome(outcome);
}

// --- guards ---------------------------------------------------------------

type DroneRow = typeof drone.$inferSelect;

/**
 * What every submission needs, whether it is the first, a resubmission or a
 * renewal. One function, so the three edges cannot drift into three different
 * standards for the same queue.
 */
async function submissionGuards(
  tx: DbExecutor,
  row: DroneRow,
): Promise<"profile_incomplete" | "photo_required" | "serial_required" | null> {
  const profile = await tx.query.pilotProfile.findFirst({
    where: eq(pilotProfile.userId, row.ownerUserId),
    columns: { completedAt: true },
  });
  if (!profile?.completedAt) return "profile_incomplete";

  const [photos] = await tx
    .select({ value: count() })
    .from(dronePhoto)
    .where(eq(dronePhoto.droneId, row.id));
  if ((photos?.value ?? 0) < 1) return "photo_required";

  /**
   * **The inversion.** GACA requires a serial number from everybody; Ajniha
   * requires one only from the aircraft that has one. `drone.serialNumber` is
   * nullable and that nullability is the product — do not "fix" it.
   */
  if (row.buildType === "commercial" && !row.serialNumber?.trim()) {
    return "serial_required";
  }

  return null;
}

function toOutcome(outcome: TransitionOutcome): DroneOutcome {
  return outcome.ok
    ? { ok: true, from: outcome.from, to: outcome.to }
    : { ok: false, reason: outcome.reason, from: outcome.from };
}

/**
 * Drones awaiting a decision, oldest first — the reviewer queue's count.
 *
 * Here rather than in `src/lib/data/drone.ts` only because the digest job needs
 * it without a session; the session-scoped read already exists there.
 */
export async function countPendingSubmissions(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(drone)
    .where(and(eq(drone.status, "pending"), isNull(drone.revokedAt)));
  return row?.value ?? 0;
}
