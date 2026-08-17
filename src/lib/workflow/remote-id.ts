import "server-only";

import { eq } from "drizzle-orm";
import { audit, type Actor } from "@/lib/audit";
import type { DbExecutor } from "@/lib/db";
import { remoteId } from "@/lib/db/schema";

/**
 * `remote_id.status` is a status, so rule 11 puts it here rather than in the
 * job that triggers it.
 *
 * It is not part of `TRANSITIONS` because a Remote ID has no workflow of its
 * own — it follows the airframe. Suspension is a **consequence** of revoking a
 * drone, never a decision somebody makes about the code.
 *
 * **The code itself is never touched.** A QR sticker already on an airframe
 * must keep resolving after suspension — resolving to "this registration is
 * suspended", which is precisely what a field inspector needs to see. Retiring
 * or reissuing a code would make the sticker lie by going blank.
 */
export async function suspendRemoteIdForDrone(
  tx: DbExecutor,
  {
    droneId,
    actor,
    reason,
  }: { droneId: string; actor: Actor; reason: string | null },
): Promise<{ suspended: boolean; code: string | null }> {
  const row = await tx.query.remoteId.findFirst({
    where: eq(remoteId.droneId, droneId),
    columns: { id: true, code: true, status: true },
  });

  if (!row) return { suspended: false, code: null };
  // Idempotent: a re-delivered `drone/revoked` event writes nothing twice.
  if (row.status === "suspended") return { suspended: false, code: row.code };

  await tx
    .update(remoteId)
    .set({
      status: "suspended",
      suspendedAt: new Date(),
      suspensionReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(remoteId.id, row.id));

  await audit(tx, {
    actor,
    entityType: "remote_id",
    entityId: row.id,
    action: "remote_id.suspended",
    before: { status: row.status },
    after: { status: "suspended" },
    reason,
  });

  return { suspended: true, code: row.code };
}

/**
 * The other direction: a registration that was renewed, or a revocation that a
 * reviewer lifted.
 *
 * **The code is not reissued — it is the same row coming back to life.** That
 * is the whole reason renewal does not go through `issueRemoteId`: a sticker
 * already on the airframe must resolve to "valid again", not to a code nobody
 * printed.
 *
 * Here rather than in `src/lib/remote-id/issue.ts` for rule 11's reason —
 * `remote_id.status` is a status, and every write of one lives in this folder.
 */
export async function reactivateRemoteIdForDrone(
  tx: DbExecutor,
  { droneId, actor }: { droneId: string; actor: Actor },
): Promise<{ reactivated: boolean; code: string | null }> {
  const row = await tx.query.remoteId.findFirst({
    where: eq(remoteId.droneId, droneId),
    columns: { id: true, code: true, status: true },
  });

  if (!row) return { reactivated: false, code: null };
  // Idempotent, like suspension: a re-delivered event writes nothing twice.
  if (row.status === "active") return { reactivated: false, code: row.code };

  await tx
    .update(remoteId)
    .set({
      status: "active",
      suspendedAt: null,
      suspensionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(remoteId.id, row.id));

  await audit(tx, {
    actor,
    entityType: "remote_id",
    entityId: row.id,
    action: "remote_id.reactivated",
    before: { status: row.status },
    after: { status: "active" },
  });

  return { reactivated: true, code: row.code };
}
