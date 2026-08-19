import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { audit, type Actor } from "@/lib/audit";
import type { DbExecutor } from "@/lib/db";
import { drone, remoteId, remoteIdDeclaration } from "@/lib/db/schema";
import { isOwnSubmission } from "./rules";

/**
 * A reviewer's decision on a **declared Remote ID module**.
 *
 * Here rather than in the action for rule 11's reason: `verifiedAt` and
 * `rejectedAt` are a status in everything but name — they are what
 * `broadcastCapableAt` reads to decide whether an aircraft may legally fly —
 * and every write of one lives in this folder, in a single transaction with its
 * audit event. Same placement, and the same reasoning, as
 * `suspendRemoteIdForDrone` in `remote-id.ts`.
 *
 * **A declaration has no `TRANSITIONS` entry.** It is not a workflow: there are
 * exactly two terminal decisions and no path between them, so the four-state
 * machinery in `apply.ts` would be scaffolding around a boolean. What it *does*
 * borrow from `apply.ts` is the shape of a refusal — `not_found`,
 * `already_applied`, `invalid_transition` — so a caller branches on the same
 * codes it branches on everywhere else.
 *
 * **Closing thread 49.** `validFrom`, `validUntil`, `verifiedAt` and
 * `rejectedAt` were written by nobody: the pilot's declaration form
 * deliberately does not collect a validity window, because a pilot typing a
 * certificate's dates before anyone has read the certificate puts an unchecked
 * claim on the ID card beside the verified ones. The reviewer holding the
 * document is who fills them in, and this is where.
 */

export type DeclarationOutcome =
  | { ok: true; remoteIdId: string; broadcastCapable: boolean }
  | {
      ok: false;
      reason:
        | "not_found"
        | "already_applied"
        | "invalid_transition"
        /** Four eyes: the module was declared on the reviewer's own aircraft. */
        | "own_submission";
    };

type VerifyInput = {
  declarationId: string;
  actor: Actor;
  /** Both optional. Null means "no stated limit", which is how the engine reads it. */
  validFrom: Date | null;
  validUntil: Date | null;
};

/**
 * Verify a declared module.
 *
 * The validity window is the reviewer's, taken from the document in front of
 * them. **Null on either end means unbounded**, which is exactly how
 * `broadcastCapableAt` reads it — so a module whose certificate carries no
 * expiry is verified without one, rather than being given an invented date that
 * would silently ground the aircraft on an arbitrary day.
 *
 * A **superseded** declaration cannot be verified. The pilot has already
 * replaced it, and verifying a row nothing consults would put a decision in the
 * trail that changes nothing — the `invalid_transition` a reviewer gets instead
 * tells them to look at the current row.
 */
export async function verifyDeclaration(
  tx: DbExecutor,
  { declarationId, actor, validFrom, validUntil }: VerifyInput,
): Promise<DeclarationOutcome> {
  const row = await lockDeclaration(tx, declarationId);
  if (!row) return { ok: false, reason: "not_found" };
  if (isOwnSubmission(actor.userId, row.ownerUserId)) {
    return { ok: false, reason: "own_submission" };
  }
  if (row.supersededAt !== null) {
    return { ok: false, reason: "invalid_transition" };
  }
  if (row.verifiedAt !== null) return { ok: false, reason: "already_applied" };

  const now = new Date();
  await tx
    .update(remoteIdDeclaration)
    .set({
      verifiedAt: now,
      verifiedByUserId: actor.userId,
      // A verification clears any earlier refusal on the same row, so the two
      // columns cannot both be set and leave the row's state ambiguous.
      rejectedAt: null,
      rejectionReason: null,
      validFrom,
      validUntil,
      updatedAt: now,
    })
    .where(eq(remoteIdDeclaration.id, declarationId));

  const broadcastCapable = await syncBroadcastCapable(tx, row.remoteIdId, actor);

  await audit(tx, {
    actor,
    entityType: "remote_id",
    entityId: row.remoteIdId,
    action: "remote_id.declaration_verified",
    before: { declarationId, verifiedAt: null },
    after: {
      declarationId,
      kind: row.kind,
      moduleSerial: row.moduleSerial,
      validFrom: validFrom?.toISOString() ?? null,
      validUntil: validUntil?.toISOString() ?? null,
    },
  });

  return { ok: true, remoteIdId: row.remoteIdId, broadcastCapable };
}

/**
 * Refuse a declared module. The reason is required by the action and is quoted
 * to the pilot verbatim, exactly as a registration rejection is.
 *
 * **The row is not deleted and the pilot's claim is not erased.** A refused
 * declaration stays queryable, because "what was this aircraft claiming to
 * broadcast on 3 March, and did anyone believe it" is a question a regulator
 * asks after an incident.
 */
export async function rejectDeclaration(
  tx: DbExecutor,
  {
    declarationId,
    actor,
    reason,
  }: { declarationId: string; actor: Actor; reason: string },
): Promise<DeclarationOutcome> {
  const row = await lockDeclaration(tx, declarationId);
  if (!row) return { ok: false, reason: "not_found" };
  if (isOwnSubmission(actor.userId, row.ownerUserId)) {
    return { ok: false, reason: "own_submission" };
  }
  if (row.rejectedAt !== null) return { ok: false, reason: "already_applied" };

  const now = new Date();
  await tx
    .update(remoteIdDeclaration)
    .set({
      rejectedAt: now,
      rejectionReason: reason,
      // A refusal overrides an earlier verification — a reviewer who verified
      // the wrong row must be able to take it back, and leaving `verifiedAt`
      // set would keep the aircraft broadcast-capable off a refused module.
      verifiedAt: null,
      verifiedByUserId: null,
      updatedAt: now,
    })
    .where(eq(remoteIdDeclaration.id, declarationId));

  const broadcastCapable = await syncBroadcastCapable(tx, row.remoteIdId, actor);

  await audit(tx, {
    actor,
    entityType: "remote_id",
    entityId: row.remoteIdId,
    action: "remote_id.declaration_rejected",
    before: { declarationId, rejectedAt: null },
    after: { declarationId, kind: row.kind, moduleSerial: row.moduleSerial },
    reason,
  });

  return { ok: true, remoteIdId: row.remoteIdId, broadcastCapable };
}

/**
 * `select … for update`, for the reason `apply.ts` gives: two reviewers
 * deciding the same module at once must serialise, so the second reads the
 * **new** state and answers `already_applied` rather than writing a second
 * audit event for a decision that had already been made.
 */
async function lockDeclaration(tx: DbExecutor, declarationId: string) {
  const [row] = await tx
    .select({
      id: remoteIdDeclaration.id,
      remoteIdId: remoteIdDeclaration.remoteIdId,
      kind: remoteIdDeclaration.kind,
      moduleSerial: remoteIdDeclaration.moduleSerial,
      verifiedAt: remoteIdDeclaration.verifiedAt,
      rejectedAt: remoteIdDeclaration.rejectedAt,
      supersededAt: remoteIdDeclaration.supersededAt,
      /**
       * Two joins out to the aircraft's owner, for the four-eyes check. A
       * declaration belongs to a Remote ID, which belongs to a drone, which
       * belongs to a pilot — and a reviewer verifying the module on their *own*
       * airframe is deciding their own submission just as much as one approving
       * their own registration.
       *
       * **`for("update", { of: remoteIdDeclaration })` — the `of` is load-
       * bearing.** A bare `FOR UPDATE` over these joins is refused by Postgres
       * outright: it cannot lock the nullable side of an outer join. Naming the
       * one table being written locks exactly that row and leaves the drone and
       * Remote ID read-only, which is all this needs them for.
       */
      ownerUserId: drone.ownerUserId,
    })
    .from(remoteIdDeclaration)
    .leftJoin(remoteId, eq(remoteId.id, remoteIdDeclaration.remoteIdId))
    .leftJoin(drone, eq(drone.id, remoteId.droneId))
    .where(eq(remoteIdDeclaration.id, declarationId))
    .for("update", { of: remoteIdDeclaration });
  return row ?? null;
}

/**
 * `remote_id.broadcastCapable`, recomputed from the rows.
 *
 * **It is a display snapshot and nothing else.** The airspace engine never
 * reads it — `broadcastCapableAt` computes capability at the *instant of the
 * flight* from the declaration rows, because a module whose `validUntil` passes
 * overnight would leave a stored boolean stale with nothing sweeping it. The
 * flag exists so the ID card and the scan page can say "broadcasts" without
 * every render re-deriving it, and F22 is what finally writes it truthfully.
 *
 * Computed **without** a validity-window test, deliberately: "does this
 * aircraft have a verified module at all" is the question the card answers, and
 * folding today's date into a stored column is what would make it go stale.
 */
async function syncBroadcastCapable(
  tx: DbExecutor,
  remoteIdId: string,
  actor: Actor,
): Promise<boolean> {
  const capable = await tx.query.remoteIdDeclaration
    .findMany({
      where: and(
        eq(remoteIdDeclaration.remoteIdId, remoteIdId),
        isNull(remoteIdDeclaration.rejectedAt),
        isNull(remoteIdDeclaration.supersededAt),
      ),
      columns: { verifiedAt: true },
    })
    .then((rows) => rows.some((row) => row.verifiedAt !== null));

  const [current] = await tx
    .select({ broadcastCapable: remoteId.broadcastCapable })
    .from(remoteId)
    .where(eq(remoteId.id, remoteIdId));

  if (current && current.broadcastCapable !== capable) {
    await tx
      .update(remoteId)
      .set({ broadcastCapable: capable, updatedAt: new Date() })
      .where(eq(remoteId.id, remoteIdId));

    await audit(tx, {
      actor,
      entityType: "remote_id",
      entityId: remoteIdId,
      action: "remote_id.broadcast_capability_changed",
      before: { broadcastCapable: current.broadcastCapable },
      after: { broadcastCapable: capable },
    });
  }

  return capable;
}
