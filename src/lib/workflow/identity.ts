import "server-only";

import { eq } from "drizzle-orm";
import { audit, type Actor } from "@/lib/audit";
import type { DbExecutor } from "@/lib/db";
import { pilotProfile } from "@/lib/db/schema";
import { isOwnSubmission } from "./rules";

/**
 * A reviewer's decision on a **pilot's identity**.
 *
 * `pilot_profile.verifiedAt` / `rejectedAt` are a status in everything but
 * name — `evaluateAirspace` refuses a booking with `identity_unverified` when
 * the first is null — so rule 11 puts every write of them here, in one
 * transaction with the audit event. Same placement and the same reasoning as
 * `declaration.ts`.
 *
 * **This is the human check the whole product rests on**, and the honesty rules
 * say so out loud: identity is verified by a person, never automatically, and
 * nothing in this app may imply otherwise. There is no SMS step, no document
 * scanner and no score. A reviewer looks at the document, reveals the number
 * through the audited path, and presses one of two buttons.
 *
 * **Verification does not copy the document anywhere.** The audit event records
 * *that* an identity was verified, by whom and when — never the number, not
 * even masked. An append-only log that accumulates masks accumulates a corpus.
 */

export type IdentityOutcome =
  | { ok: true; verified: boolean }
  | {
      ok: false;
      reason: "not_found" | "already_applied" | "own_submission";
    };

/**
 * Mark an identity as checked by a human.
 *
 * `verifiedByUserId` is stored beside the timestamp because "who vouched for
 * this person" is the question an incident review asks first, and a trail entry
 * alone would answer it only for as long as nobody archives the log.
 *
 * An earlier refusal is cleared, so the two columns cannot both be set and
 * leave the row ambiguous — `declaration.ts` does the same, for the same
 * reason.
 */
export async function verifyIdentity(
  tx: DbExecutor,
  { userId, actor, at = new Date() }: { userId: string; actor: Actor; at?: Date },
): Promise<IdentityOutcome> {
  const row = await lockProfile(tx, userId);
  if (!row) return { ok: false, reason: "not_found" };
  /**
   * **Four eyes.** A reviewer vouching for their own identity document is the
   * purest form of the thing the rule exists to stop: it is the one check that
   * turns an account into a person, and self-certification would make every
   * booking that check gates worthless.
   */
  if (isOwnSubmission(actor.userId, row.userId)) {
    return { ok: false, reason: "own_submission" };
  }
  if (row.verifiedAt !== null) return { ok: false, reason: "already_applied" };

  await tx
    .update(pilotProfile)
    .set({
      verifiedAt: at,
      verifiedByUserId: actor.userId,
      rejectedAt: null,
      rejectionReason: null,
      updatedAt: at,
    })
    .where(eq(pilotProfile.id, row.id));

  await audit(tx, {
    actor,
    entityType: "pilot_profile",
    entityId: row.id,
    action: "pilot_profile.identity_verified",
    // The subject, never the document. Not the number, not the mask.
    before: { userId: row.userId, verifiedAt: null },
    after: { userId: row.userId, verifiedAt: at.toISOString() },
  });

  return { ok: true, verified: true };
}

/**
 * Refuse an identity, with a reason the pilot reads verbatim.
 *
 * F17 already renders that reason as a banner on the profile screen and invites
 * the pilot to correct their details — the banner existed before anything could
 * set the column, and this is what finally sets it.
 *
 * **A refusal clears `verifiedAt`.** A reviewer who verified the wrong person
 * must be able to take it back, and leaving the timestamp set would keep that
 * pilot bookable off a document that has since been refused.
 */
export async function rejectIdentity(
  tx: DbExecutor,
  {
    userId,
    actor,
    reason,
    at = new Date(),
  }: { userId: string; actor: Actor; reason: string; at?: Date },
): Promise<IdentityOutcome> {
  const row = await lockProfile(tx, userId);
  if (!row) return { ok: false, reason: "not_found" };
  if (isOwnSubmission(actor.userId, row.userId)) {
    return { ok: false, reason: "own_submission" };
  }
  if (row.rejectedAt !== null) return { ok: false, reason: "already_applied" };

  await tx
    .update(pilotProfile)
    .set({
      rejectedAt: at,
      rejectionReason: reason.trim(),
      verifiedAt: null,
      verifiedByUserId: null,
      updatedAt: at,
    })
    .where(eq(pilotProfile.id, row.id));

  await audit(tx, {
    actor,
    entityType: "pilot_profile",
    entityId: row.id,
    action: "pilot_profile.identity_rejected",
    before: { userId: row.userId, rejectedAt: null },
    after: { userId: row.userId, rejectedAt: at.toISOString() },
    reason: reason.trim(),
  });

  return { ok: true, verified: false };
}

/**
 * `select … for update`, for `apply.ts`'s reason: two reviewers deciding the
 * same person at once must serialise, so the second reads the new state and
 * answers `already_applied` rather than writing a second decision over the
 * first.
 */
async function lockProfile(tx: DbExecutor, userId: string) {
  const [row] = await tx
    .select({
      id: pilotProfile.id,
      userId: pilotProfile.userId,
      verifiedAt: pilotProfile.verifiedAt,
      rejectedAt: pilotProfile.rejectedAt,
    })
    .from(pilotProfile)
    .where(eq(pilotProfile.userId, userId))
    .for("update");
  return row ?? null;
}
