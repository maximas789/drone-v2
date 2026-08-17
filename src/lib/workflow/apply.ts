import "server-only";

import { eq } from "drizzle-orm";
import { audit, type Actor } from "@/lib/audit";
import { db, type DbExecutor } from "@/lib/db";
import { booking, drone } from "@/lib/db/schema";
import { notify, type NotifyInput } from "@/lib/notify";
import {
  actorKindsFor,
  actorMayDrive,
  isAlreadyApplied,
  isLegalEdge,
  reasonIsSufficient,
  transitionFor,
  type TransitionName,
} from "./transitions";

/**
 * The one entry point that changes a drone's or a booking's status.
 *
 * **The row, the audit event and the notification go in a single
 * transaction** — all three, or none. A status change missing from the trail is
 * a change a regulator cannot see, and a notification about a change that
 * rolled back is worse than silence.
 *
 * **A refusal is never an exception.** An illegal edge returns
 * `invalid_transition` and writes nothing; a row already in the target status
 * returns `already_applied` and writes nothing; a missing or too-short reason
 * returns `reason_required` and writes nothing. Only genuine breakage throws.
 */

export type TransitionOutcome =
  | { ok: true; from: string; to: string }
  | {
      ok: false;
      reason:
        | "not_found"
        | "invalid_transition"
        | "already_applied"
        | "reason_required";
      from?: string;
    };

export type ApplyTransitionInput = {
  transition: TransitionName;
  id: string;
  actor: Actor;
  /** Required by some edges; recorded on the row and in the trail. */
  reason?: string | null;
  /**
   * Extra columns the edge sets alongside the status — `completedAt`,
   * `cancellationReason`. Kept out of `transitions.ts` so that file stays pure
   * data with no column types in it.
   */
  patch?: Record<string, unknown>;
  /** Written in the same transaction. Omit when the edge notifies nobody. */
  notification?: NotifyInput;
};

/**
 * Runs in its own transaction unless an executor is passed in. Every caller in
 * `drone.ts` and `booking.ts` passes one, because a decision writes more than
 * the status — the registration dates, the Remote ID row, the snapshot.
 */
export async function applyTransition(
  input: ApplyTransitionInput,
  tx?: DbExecutor,
): Promise<TransitionOutcome> {
  if (tx) return applyWithin(tx, input);
  return db.transaction((inner) => applyWithin(inner, input));
}

async function applyWithin(
  tx: DbExecutor,
  {
    transition,
    id,
    actor,
    reason = null,
    patch = {},
    notification,
  }: ApplyTransitionInput,
): Promise<TransitionOutcome> {
  const def = transitionFor(transition);

  const locked = await lockRow(tx, def.entity, id);
  if (!locked) return { ok: false, reason: "not_found" };

  /**
   * The role branch. `owner` is resolved from the row that was just locked, not
   * from anything the caller said about itself — which is the whole reason this
   * happens here rather than at the call site.
   */
  const kinds = actorKindsFor(actor, locked.ownerUserId);
  if (!actorMayDrive(transition, kinds)) {
    return { ok: false, reason: "invalid_transition", from: locked.status };
  }

  /**
   * Checked **before** the edge legality, so that a reviewer who typed "no" is
   * told to write a reason rather than being told the transition is invalid —
   * two very different things to be told, and only one of them is true.
   */
  if (!reasonIsSufficient(transition, reason)) {
    return { ok: false, reason: "reason_required", from: locked.status };
  }

  if (isAlreadyApplied(transition, locked.status)) {
    return { ok: false, reason: "already_applied", from: locked.status };
  }
  if (!isLegalEdge(transition, locked.status)) {
    return { ok: false, reason: "invalid_transition", from: locked.status };
  }

  await writeStatus(tx, def.entity, id, def.to, patch);

  await audit(tx, {
    actor,
    entityType: def.entity,
    entityId: id,
    action: def.action,
    before: { status: locked.status },
    after: { status: def.to },
    reason,
  });

  if (notification) await notify(tx, notification);

  return { ok: true, from: locked.status, to: def.to };
}

/**
 * `select … for update` is what makes two concurrent runs of the same sweep
 * safe: the second blocks on the row until the first commits, then reads the
 * **new** status and refuses with `already_applied`. A plain read would let
 * both pass the check and write two audit events — and send two emails.
 *
 * It returns the owner as well, because "may this actor drive this edge" is a
 * question about the row and not only about the session.
 */
async function lockRow(
  tx: DbExecutor,
  entity: "drone" | "booking",
  id: string,
): Promise<{ status: string; ownerUserId: string } | null> {
  if (entity === "drone") {
    const [row] = await tx
      .select({ status: drone.status, ownerUserId: drone.ownerUserId })
      .from(drone)
      .where(eq(drone.id, id))
      .for("update");
    return row ?? null;
  }
  const [row] = await tx
    .select({ status: booking.status, ownerUserId: booking.pilotUserId })
    .from(booking)
    .where(eq(booking.id, id))
    .for("update");
  return row ?? null;
}

async function writeStatus(
  tx: DbExecutor,
  entity: "drone" | "booking",
  id: string,
  to: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const common = { updatedAt: new Date(), ...patch };
  if (entity === "drone") {
    await tx
      .update(drone)
      .set({ ...common, status: to as (typeof drone.status.enumValues)[number] })
      .where(eq(drone.id, id));
    return;
  }
  await tx
    .update(booking)
    .set({ ...common, status: to as (typeof booking.status.enumValues)[number] })
    .where(eq(booking.id, id));
}
