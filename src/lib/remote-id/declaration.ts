import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { audit, type Actor } from "@/lib/audit";
import type { DbExecutor } from "@/lib/db";
import { remoteId, remoteIdDeclaration } from "@/lib/db/schema";
import type { remoteIdDeclKind } from "@/lib/db/enums";
import { uniqueViolationConstraint } from "./issue";

/**
 * Declared external Remote ID modules — the FAA-model broadcast module, GACA's
 * DRI/NRI, or something else the pilot names.
 *
 * **A declaration is a claim, not a capability.** `broadcastCapable` is set by
 * `verifyDeclaration` and by nothing else, because self-declaration that
 * unlocked a broadcast-only zone would make the requirement decorative.
 *
 * Every write here takes the executor: the flag on `remote_id` and the row on
 * `remote_id_declaration` are one fact, and they commit together.
 */

export type DeclarationKind = (typeof remoteIdDeclKind.enumValues)[number];

const MODULE_CONSTRAINT = "remote_id_decl_active_module_uniq";

export type DeclareInput = {
  remoteIdId: string;
  kind: DeclarationKind;
  manufacturer?: string | null;
  moduleSerial?: string | null;
  docReference?: string | null;
  validFrom?: Date | null;
  validUntil?: Date | null;
  notesAr?: string | null;
  notesEn?: string | null;
  actor: Actor;
};

export type DeclareResult =
  | { ok: true; declarationId: string }
  /** Another airframe holds an unsuperseded claim on this exact module. */
  | { ok: false; reason: "module_already_claimed" };

/**
 * Records a declaration, superseding whatever this airframe declared before.
 *
 * **One module at a time per airframe**, and one airframe at a time per
 * module. The first is this function's `supersedePrevious`; the second is the
 * partial unique index, which is what stops two pilots claiming the same
 * hardware — while still allowing a legitimate transfer once the first claim is
 * superseded.
 *
 * A refusal comes back as a value, never as an exception: "somebody else has
 * claimed this serial" is an answer the pilot needs to read, not a crash.
 */
export async function declareModule(
  tx: DbExecutor,
  {
    remoteIdId,
    kind,
    manufacturer = null,
    moduleSerial = null,
    docReference = null,
    validFrom = null,
    validUntil = null,
    notesAr = null,
    notesEn = null,
    actor,
  }: DeclareInput,
): Promise<DeclareResult> {
  await supersedePrevious(tx, remoteIdId);

  let declarationId: string;
  try {
    // Savepoint: a unique violation would otherwise abort the caller's whole
    // transaction, and this refusal has to be returnable.
    const [row] = await tx.transaction(async (savepoint) =>
      savepoint
        .insert(remoteIdDeclaration)
        .values({
          remoteIdId,
          kind,
          manufacturer,
          moduleSerial,
          docReference,
          validFrom,
          validUntil,
          notesAr,
          notesEn,
        })
        .returning({ id: remoteIdDeclaration.id }),
    );
    if (!row) throw new Error(`declaration insert returned no row (${remoteIdId})`);
    declarationId = row.id;
  } catch (caught) {
    if (isModuleClaimConflict(caught)) {
      return { ok: false, reason: "module_already_claimed" };
    }
    throw caught;
  }

  await audit(tx, {
    actor,
    entityType: "remote_id",
    entityId: remoteIdId,
    action: "remote_id.declaration_filed",
    after: { declarationId, kind, moduleSerial, docReference },
  });

  // Unverified, so the flag cannot have moved — but a *previous* verified
  // declaration was just superseded, and the capability went with it.
  await refreshBroadcastCapable(tx, remoteIdId);

  return { ok: true, declarationId };
}

/**
 * A reviewer confirms the module is real. **The only thing that ever sets
 * `broadcastCapable`.**
 */
export async function verifyDeclaration(
  tx: DbExecutor,
  {
    declarationId,
    actor,
    at = new Date(),
  }: { declarationId: string; actor: Actor; at?: Date },
): Promise<{ ok: boolean; broadcastCapable: boolean }> {
  const row = await findDeclaration(tx, declarationId);
  if (!row) return { ok: false, broadcastCapable: false };

  await tx
    .update(remoteIdDeclaration)
    .set({
      verifiedAt: at,
      verifiedByUserId: actor.userId,
      // Verification clears an earlier rejection: the same row, re-decided.
      rejectedAt: null,
      rejectionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(remoteIdDeclaration.id, declarationId));

  await audit(tx, {
    actor,
    entityType: "remote_id",
    entityId: row.remoteIdId,
    action: "remote_id.declaration_verified",
    before: { verifiedAt: row.verifiedAt },
    after: { declarationId, verifiedAt: at },
  });

  const broadcastCapable = await refreshBroadcastCapable(tx, row.remoteIdId, at);
  return { ok: true, broadcastCapable };
}

export async function rejectDeclaration(
  tx: DbExecutor,
  {
    declarationId,
    actor,
    reason,
    at = new Date(),
  }: { declarationId: string; actor: Actor; reason: string; at?: Date },
): Promise<{ ok: boolean; broadcastCapable: boolean }> {
  const row = await findDeclaration(tx, declarationId);
  if (!row) return { ok: false, broadcastCapable: false };

  await tx
    .update(remoteIdDeclaration)
    .set({
      rejectedAt: at,
      rejectionReason: reason,
      verifiedAt: null,
      verifiedByUserId: null,
      updatedAt: new Date(),
    })
    .where(eq(remoteIdDeclaration.id, declarationId));

  await audit(tx, {
    actor,
    entityType: "remote_id",
    entityId: row.remoteIdId,
    action: "remote_id.declaration_rejected",
    after: { declarationId, rejectedAt: at },
    reason,
  });

  const broadcastCapable = await refreshBroadcastCapable(tx, row.remoteIdId, at);
  return { ok: true, broadcastCapable };
}

/**
 * Retires a claim without deleting it. **Never a delete** — "what was
 * broadcasting on 3 March" is the regulator's question, and a deleted row
 * cannot answer it. Superseding is also what frees the module serial for the
 * next airframe.
 */
export async function supersedeDeclaration(
  tx: DbExecutor,
  {
    declarationId,
    actor,
    at = new Date(),
  }: { declarationId: string; actor: Actor; at?: Date },
): Promise<{ ok: boolean; broadcastCapable: boolean }> {
  const row = await findDeclaration(tx, declarationId);
  if (!row) return { ok: false, broadcastCapable: false };
  if (row.supersededAt) {
    return {
      ok: true,
      broadcastCapable: await currentBroadcastCapable(tx, row.remoteIdId),
    };
  }

  await tx
    .update(remoteIdDeclaration)
    .set({ supersededAt: at, updatedAt: new Date() })
    .where(eq(remoteIdDeclaration.id, declarationId));

  await audit(tx, {
    actor,
    entityType: "remote_id",
    entityId: row.remoteIdId,
    action: "remote_id.declaration_superseded",
    after: { declarationId, supersededAt: at },
  });

  const broadcastCapable = await refreshBroadcastCapable(tx, row.remoteIdId, at);
  return { ok: true, broadcastCapable };
}

/**
 * Recomputes the flag from the rows, rather than toggling it.
 *
 * Derived state that is *set* drifts: a verified module superseded by an
 * unverified replacement would otherwise leave the airframe claiming a
 * capability it no longer has.
 *
 * **Known limitation, stated rather than hidden:** the flag is a snapshot taken
 * at write time, so a declaration whose `validUntil` passes overnight leaves it
 * stale until the next write. Nothing sweeps it — there is no job for this, and
 * inventing one before anything reads the flag would be building for a caller
 * that does not exist. F12 evaluates a booking for a *future* slot and must
 * therefore check the declaration's window itself rather than trusting this
 * boolean.
 */
async function refreshBroadcastCapable(
  tx: DbExecutor,
  remoteIdId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const capable = await currentBroadcastCapable(tx, remoteIdId, now);

  await tx
    .update(remoteId)
    .set({ broadcastCapable: capable, updatedAt: new Date() })
    .where(eq(remoteId.id, remoteIdId));

  return capable;
}

async function currentBroadcastCapable(
  tx: DbExecutor,
  remoteIdId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const rows = await tx.query.remoteIdDeclaration.findMany({
    where: and(
      eq(remoteIdDeclaration.remoteIdId, remoteIdId),
      isNull(remoteIdDeclaration.supersededAt),
    ),
    columns: {
      verifiedAt: true,
      rejectedAt: true,
      validFrom: true,
      validUntil: true,
    },
  });

  return rows.some(
    (row) =>
      row.verifiedAt !== null &&
      row.rejectedAt === null &&
      (row.validFrom === null || row.validFrom <= now) &&
      (row.validUntil === null || row.validUntil > now),
  );
}

async function supersedePrevious(tx: DbExecutor, remoteIdId: string) {
  await tx
    .update(remoteIdDeclaration)
    .set({ supersededAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(remoteIdDeclaration.remoteIdId, remoteIdId),
        isNull(remoteIdDeclaration.supersededAt),
      ),
    );
}

async function findDeclaration(tx: DbExecutor, declarationId: string) {
  return tx.query.remoteIdDeclaration.findFirst({
    where: eq(remoteIdDeclaration.id, declarationId),
    columns: {
      id: true,
      remoteIdId: true,
      verifiedAt: true,
      supersededAt: true,
    },
  });
}

/** Same cause-chain walk as issuance — drizzle wraps the driver's error. */
function isModuleClaimConflict(caught: unknown): boolean {
  return uniqueViolationConstraint(caught) === MODULE_CONSTRAINT;
}
