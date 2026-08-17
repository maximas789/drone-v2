import "server-only";

import { eq } from "drizzle-orm";
import { audit, type Actor } from "@/lib/audit";
import type { DbExecutor } from "@/lib/db";
import { remoteId } from "@/lib/db/schema";
import { generateCode } from "./codec";

/**
 * Issuance: the moment a drone stops being a form and becomes an aircraft with
 * an identity.
 *
 * **A `remote_id` row exists only for an approved drone.** Nothing here checks
 * the status — the caller is [F14]'s approval transaction, and it is the one
 * that knows the drone was just approved. What this module guarantees is the
 * two things a caller cannot: a code that is unique, and a code that survives.
 */

/** Regenerate-and-retry ceiling. Five is already absurd; see below. */
const MAX_ATTEMPTS = 5;

/** Drizzle emits these; postgres.js reports the constraint by name on 23505. */
const CODE_CONSTRAINT = "remote_id_code_unique";
const DRONE_CONSTRAINT = "remote_id_droneId_unique";

export type IssueResult = {
  remoteIdId: string;
  code: string;
  /** `false` when the drone already had one — a renewal, not a reissue. */
  created: boolean;
};

/**
 * Issues a Remote ID for a drone, or returns the one it already has.
 *
 * **The code survives renewal, and that is the whole reason this is not an
 * insert at the call site.** A registration that expires and is resubmitted
 * moves the *drone* back through the state machine; the `remote_id` row is
 * untouched. A QR sticker already applied to an airframe must keep resolving —
 * minting a second code would strand every label already printed, and the
 * airframe would then carry an identifier that answers "not registered".
 *
 * Takes the executor, never `db`: the code and the approval it belongs to
 * commit together or neither does.
 */
export async function issueRemoteId(
  tx: DbExecutor,
  {
    droneId,
    actor,
    /**
     * The generator, injectable **solely so the collision path can be driven
     * on purpose**. A retry loop nobody has ever executed is a retry loop that
     * does not work; the odds of hitting one naturally are ~9 × 10⁻⁸ per
     * insert, so the only way to see it run is to hand it a generator that
     * repeats. Every caller in the app uses the default.
     */
    generate = generateCode,
  }: { droneId: string; actor: Actor; generate?: () => string },
): Promise<IssueResult> {
  const existing = await findForDrone(tx, droneId);
  if (existing) {
    return { remoteIdId: existing.id, code: existing.code, created: false };
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const code = generate();

    try {
      /**
       * A **savepoint**, not a bare insert. A unique violation aborts the whole
       * Postgres transaction, so a retry inside the same one would fail with
       * "current transaction is aborted" rather than with a second code —
       * turning a recoverable collision into a failed approval. `tx.transaction`
       * on an open transaction issues `SAVEPOINT`, which rolls back just this
       * attempt.
       */
      const [row] = await tx.transaction(async (savepoint) =>
        savepoint
          .insert(remoteId)
          .values({
            droneId,
            code,
            /**
             * **Ajniha implements Network Remote ID itself**, so this is true
             * from the moment of issue: the platform holds registration, owner
             * and active-booking data, resolvable through the scan endpoint.
             * That network resolution is the mechanism replacing the serial
             * number.
             *
             * Set here rather than as the column default, which stays `false`:
             * a row created by any other route has not earned the claim, and a
             * capability the app cannot actually deliver is a lie in a
             * regulator-facing record.
             */
            networkCapable: true,
            /**
             * **Only a verified declaration flips this** — see
             * `declaration.ts`. Self-declaration alone unlocks nothing, so a
             * zone that requires broadcast Remote ID still refuses.
             */
            broadcastCapable: false,
          })
          .returning({ id: remoteId.id, code: remoteId.code }),
      );

      if (!row) throw new Error(`remote_id insert returned no row (${droneId})`);

      await audit(tx, {
        actor,
        entityType: "remote_id",
        entityId: row.id,
        action: "remote_id.issued",
        after: { code: row.code, droneId, attempt },
      });

      return { remoteIdId: row.id, code: row.code, created: true };
    } catch (caught) {
      const constraint = uniqueViolationConstraint(caught);
      if (!constraint) throw caught;

      /**
       * Someone else issued for this same drone while we were inside this
       * transaction. Not a collision — a race, and the other side won. Their
       * code is now the airframe's code, and returning it is the only answer
       * that keeps "one drone, one Remote ID, for ever" true.
       */
      if (constraint === DRONE_CONSTRAINT) {
        const won = await findForDrone(tx, droneId);
        if (won) return { remoteIdId: won.id, code: won.code, created: false };
        throw caught;
      }

      if (constraint !== CODE_CONSTRAINT) throw caught;

      /**
       * A genuine code collision. **Every one of these is written to the
       * trail**, and it is the documented upgrade trigger: at 100 000 issued
       * codes the per-insert probability is ~9 × 10⁻⁸, so if
       * `remote_id.collision` ever appears more than a handful of times the
       * format needs a ninth symbol — the format is wrong, not the dice.
       */
      await audit(tx, {
        actor,
        entityType: "remote_id",
        entityId: droneId,
        action: "remote_id.collision",
        after: { attempt, collidedWith: code },
      });
    }
  }

  /**
   * Throws rather than inserting a duplicate. Five consecutive collisions at
   * this entropy is not bad luck — it is a broken generator or an exhausted
   * space, and both are things a person must look at rather than something to
   * paper over with a sixth attempt.
   */
  throw new Error(
    `Could not issue a Remote ID for drone ${droneId} after ${MAX_ATTEMPTS} attempts. ` +
      "Check audit_event for remote_id.collision — this many in a row means the format needs a ninth symbol.",
  );
}

async function findForDrone(tx: DbExecutor, droneId: string) {
  return tx.query.remoteId.findFirst({
    where: eq(remoteId.droneId, droneId),
    columns: { id: true, code: true },
  });
}

/**
 * The constraint a 23505 names, or `null` for anything else.
 *
 * **The cause chain has to be walked.** Drizzle wraps every driver error in a
 * `DrizzleQueryError` whose own `code` is undefined and whose `cause` is
 * postgres.js's `PostgresError` — so reading `code` off the top-level error
 * finds nothing, every collision is rethrown, and the retry loop never runs.
 * Found by forcing a collision and watching the throw.
 *
 * Anything that is not a unique violation is rethrown untouched; swallowing it
 * here would turn a broken schema into five silent retries.
 */
export function uniqueViolationConstraint(caught: unknown): string | null {
  let node: unknown = caught;

  for (let depth = 0; depth < 5 && node; depth += 1) {
    if (typeof node !== "object") return null;
    const error = node as {
      code?: unknown;
      constraint_name?: unknown;
      cause?: unknown;
    };
    if (error.code === "23505") {
      return typeof error.constraint_name === "string"
        ? error.constraint_name
        : "";
    }
    node = error.cause;
  }

  return null;
}
