"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { refuse, refuseWith, type ActionResult } from "@/lib/actions/result";
import { getSession } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { drone, remoteId } from "@/lib/db/schema";
import { clientIpFrom, hashIp } from "@/lib/ip-hash";
import { storeQrForRemoteId } from "@/lib/qr/store";
import { enforceLimit } from "@/lib/rate-limit";
import { isAdmin, roleOf } from "@/lib/session";

/**
 * Re-render every QR code, against the **current** `APP_URL`.
 *
 * This is the action the `APP_URL` check offers, and the reason that check
 * exists: every sticker embeds the URL at render time, so a deploy that went
 * out with `localhost` in the environment printed a batch of dead stickers and
 * nothing else in the app would ever have said so. This is the repair.
 *
 * **It calls `storeQrForRemoteId`, not the Inngest job.** The job is triggered
 * by `drone.approved`, and firing that event once per aircraft to redraw an
 * image would write a notification and an email log line to every pilot telling
 * them their registration had just been approved — for the second time. The
 * job's own render step calls this same function; going straight to it is the
 * shared primitive, not a shortcut around one.
 *
 * **The pathname is deterministic and overwritten in place**, so a sticker
 * already on an airframe keeps pointing at the same file. That is the property
 * that makes re-rendering safe to run at all, and it belongs to `qrPathnameFor`
 * rather than to this action.
 *
 * Failures are collected, not thrown: one aircraft whose bytes will not write
 * must not stop the other two hundred, and the operator needs the count of what
 * did not work more than they need a stack trace.
 */
export async function regenerateAllQrAction(): Promise<
  ActionResult<{ rendered: number; failed: number }>
> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");
  if (!isAdmin(session)) return refuse("not_found");

  const limit = await enforceLimit(
    "remote_id.qr_render",
    "user",
    session.user.id,
  );
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  /**
   * Approved aircraft only. A draft or rejected registration has no sticker in
   * the world to repair, and rendering one would put a file in storage for an
   * aircraft that is not registered.
   */
  const rows = await db
    .select({ remoteIdId: remoteId.id, code: remoteId.code })
    .from(remoteId)
    .innerJoin(drone, eq(drone.id, remoteId.droneId))
    .where(eq(drone.status, "approved"));

  let rendered = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await storeQrForRemoteId({
        remoteIdId: row.remoteIdId,
        code: row.code,
      });
      rendered += 1;
    } catch (error) {
      failed += 1;
      /**
       * **Which aircraft, and why.** This `catch` reported a bare count on the
       * one page whose stated principle is never a bare red dot — so two
       * stickers could fail to re-render and nothing on the screen, in the
       * audit row or in the log would say which airframes still carry a dead
       * QR. Every other swallowed error in this codebase logs loudly; this one
       * did not.
       */
      console.error("[ops.regenerateQr] render failed", {
        remoteIdId: row.remoteIdId,
        code: row.code,
        error,
      });
    }
  }

  const requestHeaders = await headers();
  const ip = clientIpFrom(requestHeaders);

  await db.transaction(async (tx) => {
    await audit(tx, {
      actor: {
        userId: session.user.id,
        role: roleOf(session),
        isSystem: false,
      },
      entityType: "user",
      entityId: session.user.id,
      /**
       * Filed against the administrator who ran it, like `user.audit_exported`
       * — the row is about what a member of staff *did*, and it touched every
       * aircraft rather than any one of them.
       */
      action: "system.qr_regenerated",
      after: { rendered, failed },
      ipHash: ip ? hashIp(ip) : null,
      userAgent: requestHeaders.get("user-agent"),
    });
  });

  revalidatePath("/[locale]/settings/system", "page");
  return { ok: true, data: { rendered, failed } };
}
