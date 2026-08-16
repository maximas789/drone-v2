import "server-only";

import { eq } from "drizzle-orm";
import { audit, type Actor } from "@/lib/audit";
import { db, type DbExecutor } from "@/lib/db";
import { booking, drone } from "@/lib/db/schema";
import { notify, type NotifyInput } from "@/lib/notify";
import {
  isAlreadyApplied,
  isLegalEdge,
  transitionFor,
  type ActorKind,
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
 * returns `already_applied` and writes nothing. Only genuine breakage throws.
 */

export type TransitionOutcome =
  | { ok: true; from: string; to: string }
  | {
      ok: false;
      reason: "not_found" | "invalid_transition" | "already_applied";
      from?: string;
    };

export type ApplyTransitionInput = {
  transition: TransitionName;
  id: string;
  actor: Actor;
  /** Required by some edges (F14); recorded on the row and in the trail. */
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
 * Runs in its own transaction unless an executor is passed in. F14's server
 * actions will pass one, because a decision writes more than the status.
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

  /**
   * Only `"system"` maps today. **F14 adds the role branch here** — and until
   * it does, a human actor must not be able to drive one of these four. A pilot
   * who could mark their own booking `completed` is a pilot who never no-shows.
   */
  const actorKind: ActorKind | null = actor.isSystem ? "system" : null;
  if (!actorKind || !def.actors.includes(actorKind)) {
    return { ok: false, reason: "invalid_transition" };
  }

  const before = await lockStatus(tx, def.entity, id);
  if (!before) return { ok: false, reason: "not_found" };
  if (isAlreadyApplied(transition, before)) {
    return { ok: false, reason: "already_applied", from: before };
  }
  if (!isLegalEdge(transition, before)) {
    return { ok: false, reason: "invalid_transition", from: before };
  }

  await writeStatus(tx, def.entity, id, def.to, patch);

  await audit(tx, {
    actor,
    entityType: def.entity,
    entityId: id,
    action: def.action,
    before: { status: before },
    after: { status: def.to },
    reason,
  });

  if (notification) await notify(tx, notification);

  return { ok: true, from: before, to: def.to };
}

/**
 * `select … for update` is what makes two concurrent runs of the same sweep
 * safe: the second blocks on the row until the first commits, then reads the
 * **new** status and refuses with `already_applied`. A plain read would let
 * both pass the check and write two audit events — and send two emails.
 */
async function lockStatus(
  tx: DbExecutor,
  entity: "drone" | "booking",
  id: string,
): Promise<string | null> {
  if (entity === "drone") {
    const [row] = await tx
      .select({ status: drone.status })
      .from(drone)
      .where(eq(drone.id, id))
      .for("update");
    return row?.status ?? null;
  }
  const [row] = await tx
    .select({ status: booking.status })
    .from(booking)
    .where(eq(booking.id, id))
    .for("update");
  return row?.status ?? null;
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
