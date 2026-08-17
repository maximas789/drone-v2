"use server";

import { revalidatePath } from "next/cache";
import { refuse, refuseWith, type ActionResult } from "@/lib/actions/result";
import type { Actor } from "@/lib/audit";
import { getSession } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { getDroneById } from "@/lib/data/drone";
import { inngest } from "@/lib/inngest/client";
import { droneApprovedEvent, droneRevokedEvent } from "@/lib/inngest/events";
import { enforceLimit } from "@/lib/rate-limit";
import { isAdmin, isReviewer, roleOf, type Session } from "@/lib/session";
import {
  approveDrone,
  reinstateDrone,
  rejectDrone,
  renewDrone,
  resubmitDrone,
  revokeDrone,
  submitDrone,
} from "@/lib/workflow/drone";

/**
 * Every decision anybody makes about a registration.
 *
 * The guard is repeated in each **on purpose**: an action is an ordinary POST
 * to a URL, invokable with `fetch` by anyone holding the action id, and
 * whatever layout guarded the page it was rendered on never runs.
 *
 * **The Inngest event is sent after the transaction commits**, never inside it.
 * A job that started before the row was visible would re-read the drone, find
 * it still `pending`, and skip — the failure mode being an approval email that
 * never arrives for a decision that definitely happened.
 *
 * No `getTranslations` anywhere in this file. Open thread 4: `next/root-params`
 * throws in a Server Action, so an action needing translated text must be
 * handed a locale. These actions need none — every sentence a pilot reads about
 * a decision is rendered from a machine-readable code or sent by a job.
 */

const MAX_REASON_LENGTH = 2_000;

/** The pilot's own path: draft → pending, and the two ways back into the queue. */
export async function submitDroneAction(
  droneId: string,
): Promise<ActionResult<{ status: string }>> {
  return pilotEdge(droneId, "submit");
}

export async function resubmitDroneAction(
  droneId: string,
): Promise<ActionResult<{ status: string }>> {
  return pilotEdge(droneId, "resubmit");
}

export async function renewDroneAction(
  droneId: string,
): Promise<ActionResult<{ status: string }>> {
  return pilotEdge(droneId, "renew");
}

async function pilotEdge(
  droneId: string,
  kind: "submit" | "resubmit" | "renew",
): Promise<ActionResult<{ status: string }>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");

  const limit = await enforceLimit("drone.submit", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  // Ownership is re-checked by `applyTransition` from the locked row; this is
  // the cheap "does it exist for you" pass, and it answers 404-shaped.
  const owned = await getDroneById(session, droneId);
  if (!owned) return refuse("not_found");

  const actor = actorFrom(session);
  const outcome = await db.transaction((tx) => {
    const input = { droneId, actor };
    if (kind === "submit") return submitDrone(tx, input);
    if (kind === "resubmit") return resubmitDrone(tx, input);
    return renewDrone(tx, input);
  });

  if (!outcome.ok) return refuse(outcome.reason);

  revalidatePath("/[locale]/drones", "page");
  return { ok: true, data: { status: outcome.to } };
}

/**
 * Pending → approved.
 *
 * Sets the registration window, issues the Remote ID, and only then — after the
 * commit — asks the QR job to render the sticker and email the pilot.
 */
export async function approveDroneAction(
  droneId: string,
): Promise<ActionResult<{ status: string; remoteIdCode?: string }>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");
  if (!isReviewer(session)) return refuse("not_found");

  const limit = await enforceLimit("review.decide", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const outcome = await db.transaction((tx) =>
    approveDrone(tx, { droneId, actor: actorFrom(session) }),
  );
  if (!outcome.ok) return refuse(outcome.reason);

  await inngest.send(droneApprovedEvent.create({ droneId }));

  revalidatePath("/[locale]/admin", "page");
  revalidatePath("/[locale]/drones", "page");
  return { ok: true, data: { status: outcome.to, remoteIdCode: outcome.remoteIdCode } };
}

/** Pending → rejected. The reason is required and quoted to the pilot verbatim. */
export async function rejectDroneAction(
  droneId: string,
  reason: string,
): Promise<ActionResult<{ status: string }>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");
  if (!isReviewer(session)) return refuse("not_found");

  const limit = await enforceLimit("review.decide", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const outcome = await db.transaction((tx) =>
    rejectDrone(tx, {
      droneId,
      actor: actorFrom(session),
      reason: reason.slice(0, MAX_REASON_LENGTH),
    }),
  );
  if (!outcome.ok) return refuse(outcome.reason);

  revalidatePath("/[locale]/admin", "page");
  return { ok: true, data: { status: outcome.to } };
}

/**
 * Approved → revoked. **Admin only**, and the consequences fan out as a job:
 * the Remote ID is suspended here, every future booking is cancelled there.
 */
export async function revokeDroneAction(
  droneId: string,
  reason: string,
): Promise<ActionResult<{ status: string }>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");
  if (!isAdmin(session)) return refuse("not_found");

  const limit = await enforceLimit("review.decide", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const trimmed = reason.slice(0, MAX_REASON_LENGTH);
  const outcome = await db.transaction((tx) =>
    revokeDrone(tx, { droneId, actor: actorFrom(session), reason: trimmed }),
  );
  if (!outcome.ok) return refuse(outcome.reason);

  await inngest.send(
    droneRevokedEvent.create({ droneId, reason: trimmed.trim() }),
  );

  revalidatePath("/[locale]/admin", "page");
  return { ok: true, data: { status: outcome.to } };
}

/** Revoked → approved. Admin only, reason required, Remote ID reactivated. */
export async function reinstateDroneAction(
  droneId: string,
  reason: string,
): Promise<ActionResult<{ status: string }>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");
  if (!isAdmin(session)) return refuse("not_found");

  const limit = await enforceLimit("review.decide", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const outcome = await db.transaction((tx) =>
    reinstateDrone(tx, {
      droneId,
      actor: actorFrom(session),
      reason: reason.slice(0, MAX_REASON_LENGTH),
    }),
  );
  if (!outcome.ok) return refuse(outcome.reason);

  revalidatePath("/[locale]/admin", "page");
  return { ok: true, data: { status: outcome.to } };
}

/**
 * The role is captured **at the time of the act**, not joined at read time — a
 * reviewer later promoted to admin must not retroactively appear to have acted
 * as one.
 */
function actorFrom(session: Session): Actor {
  return { userId: session.user.id, role: roleOf(session), isSystem: false };
}
