"use server";

import { revalidatePath } from "next/cache";
import { refuse, refuseWith, type ActionResult } from "@/lib/actions/result";
import type { Actor } from "@/lib/audit";
import { getSession } from "@/lib/auth-guards";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { drone } from "@/lib/db/schema";
import { getDroneById } from "@/lib/data/drone";
import { listDroneFilePathnames } from "@/lib/data/upload";
import { deleteFile } from "@/lib/storage";
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
import {
  isDroneEditable,
  validateDroneSpecs,
  validateDroneType,
  type SpecsDraft,
  type TypeDraft,
} from "@/lib/validation/drone";

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

export type DraftInput = {
  type: TypeDraft;
  specs: Omit<SpecsDraft, "buildType">;
};

/**
 * Create or update a **draft** registration. F18's wizard, panes 1 and 2.
 *
 * **The row appears when pane 2 is answered, not pane 1** — `drone.nickname`,
 * `buildType`, `weightGrams` and `weightClass` are all NOT NULL, so there is no
 * half-row to save after the first pane. Exactly the shape F17 hit with
 * `pilot_profile`, and resolved the same way: the panes are five, the first
 * write is one, and the UI only claims a step is saved where it is. Loosening
 * the columns so a form could save half an airframe would weaken a
 * regulator-facing record for the sake of a wizard.
 *
 * **`weightClass` is derived here, never accepted from the caller.** A pilot
 * who picks their own class picks the flattering one, and the class is what the
 * airspace engine compares a zone's ceiling against.
 *
 * Editing is refused once the drone leaves `draft` **or `rejected`**: a
 * submitted registration is part of the regulatory record, and the check is
 * server-side because the absence of an Edit button is not a check.
 *
 * **`rejected` is editable, and F18a had it wrong.** F18's own criterion says a
 * rejection re-enables editing, and F07 had already settled the same question
 * the same way — `EDITABLE_DRONE_STATUSES` is `["draft", "rejected"]`, so a
 * rejected drone has been accepting new *photographs* since Wave 4 while this
 * action refused to let its *weight* be corrected. A pilot told "the weight you
 * declared does not match the airframe" could not act on it. The two lists are
 * now one list, imported rather than repeated, so they cannot drift again.
 *
 * `pending`, `approved`, `expired` and `revoked` are still refused, which is
 * the half F18a proved over HTTP.
 */
export async function saveDroneDraftAction(
  droneId: string | null,
  input: DraftInput,
): Promise<ActionResult<{ droneId: string; weightClass: string }>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");

  const limit = await enforceLimit("drone.draft", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const type = validateDroneType(input.type);
  if (!type.ok) return refuse(...type.problems);

  const specs = validateDroneSpecs({
    ...input.specs,
    // Taken from the validated type, not from the specs payload — otherwise a
    // direct POST could claim `self_built` on pane 1 and `commercial` on pane 2
    // and slip past the serial rule in whichever direction suited it.
    buildType: type.value.buildType,
  });
  if (!specs.ok) return refuse(...specs.problems);

  const values = { ...type.value, ...specs.value };

  if (droneId) {
    const owned = await getDroneById(session, droneId);
    // A reviewer can *read* somebody else's drone; nobody edits one but its
    // owner, so this checks the owner rather than reusing the read's verdict.
    if (!owned || owned.ownerUserId !== session.user.id) return refuse("not_found");
    if (!isDroneEditable(owned.status)) return refuse("not_editable");

    await db
      .update(drone)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(drone.id, droneId));

    revalidatePath("/[locale]/drones", "page");
    revalidatePath("/[locale]/drones/[id]", "page");
    return {
      ok: true,
      data: { droneId, weightClass: values.weightClass },
    };
  }

  const [row] = await db
    .insert(drone)
    .values({ ...values, ownerUserId: session.user.id })
    .returning({ id: drone.id });
  if (!row) throw new Error("drone insert returned no row");

  /**
   * **No audit event for a draft, and none for editing one.** `audit_event` is
   * the regulator's approval trail; a pilot typing a weight into a form they
   * have not submitted is not a decision anybody needs to answer for. The trail
   * starts at `drone.submitted`, which is where `applyTransition` picks it up.
   */
  revalidatePath("/[locale]/drones", "page");
  revalidatePath("/[locale]/drones/[id]", "page");
  return { ok: true, data: { droneId: row.id, weightClass: values.weightClass } };
}

/**
 * Delete a registration. **Drafts only.**
 *
 * A submitted registration is part of the regulatory record: once a reviewer
 * has seen it, "it was never here" is not a thing the pilot gets to say. The
 * status is re-checked here rather than trusted from the page, because the
 * absence of a Delete button is not a check — this action is an ordinary POST.
 *
 * **The bytes go before the row does.** `drone_photo` cascades when the drone
 * row is deleted, and at that moment every pathname the app knew about is gone
 * with it — nothing left in the database will ever tell you the files were left
 * behind. An orphaned blob is not litter, it is a photograph of somebody's
 * aircraft that stays fetchable to anyone holding the pathname, for ever, with
 * no row and no ownership check in front of it any more.
 *
 * So the order is: read the pathnames, delete the bytes, then delete the row.
 * The failure this ordering chooses is the recoverable one — if the row delete
 * fails after the files are gone, the pilot sees a draft with broken thumbnails
 * and deletes it again, and the second attempt succeeds. The other order fails
 * to a leak nobody can see or clean up.
 *
 * **No audit event**, matching F18a's call on creating and editing a draft:
 * `audit_event` is the regulator's approval trail, and it starts at
 * `drone.submitted`. A draft never entered it, so an event recording its
 * deletion would be the only trace in the trail of an aircraft that was never
 * registered.
 */
export async function deleteDroneAction(
  droneId: string,
): Promise<ActionResult<undefined>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");

  const limit = await enforceLimit("drone.draft", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const owned = await getDroneById(session, droneId);
  // A reviewer may read someone else's drone; nobody deletes one but its owner.
  if (!owned || owned.ownerUserId !== session.user.id) return refuse("not_found");
  if (owned.status !== "draft") return refuse("not_deletable");

  const pathnames = await listDroneFilePathnames(session, droneId);
  for (const pathname of pathnames) {
    await deleteFile(pathname);
  }

  await db.delete(drone).where(eq(drone.id, droneId));

  revalidatePath("/[locale]/drones", "page");
  revalidatePath("/[locale]/drones/[id]", "page");
  return { ok: true, data: undefined };
}

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
  revalidatePath("/[locale]/drones/[id]", "page");
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
): Promise<
  ActionResult<{ status: string; remoteIdCode?: string; stickerQueued: boolean }>
> {
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

  /**
   * **The approval has committed; the QR job is a separate promise.**
   *
   * `inngest.send` throws when it has no event key and when nothing is
   * listening — and it threw, in a browser, over an approval that had already
   * been written. The reviewer got Next's error page over a registration that
   * *was* granted, a Remote ID that *was* minted and an audit row that *was*
   * appended. Same pair of outcomes `suspendZoneAction` already guards against
   * (thread 69), on the one action this whole product is a demo of.
   *
   * So the send is guarded and its failure is **reported, not swallowed**.
   * The registration stands either way — that part is committed and correct —
   * and `stickerQueued: false` lets the screen say plainly that the QR has not
   * been rendered and the pilot has not been emailed. F29a's system page
   * carries a Re-render control for exactly that state.
   */
  let stickerQueued = true;
  try {
    await inngest.send(droneApprovedEvent.create({ droneId }));
  } catch {
    stickerQueued = false;
  }

  revalidatePath("/[locale]/admin", "page");
  revalidatePath("/[locale]/drones", "page");
  revalidatePath("/[locale]/drones/[id]", "page");
  return {
    ok: true,
    data: {
      status: outcome.to,
      remoteIdCode: outcome.remoteIdCode,
      stickerQueued,
    },
  };
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
): Promise<ActionResult<{ status: string; notifyQueued: boolean }>> {
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

  /**
   * Guarded for the reason above: a revocation that has committed must not be
   * reported as a crash. The Remote ID is suspended either way; what
   * `notifiedQueued: false` means is that the pilot has not been told — and a
   * pilot who does not know their registration was revoked will fly on it.
   */
  let notifyQueued = true;
  try {
    await inngest.send(
      droneRevokedEvent.create({ droneId, reason: trimmed.trim() }),
    );
  } catch {
    notifyQueued = false;
  }

  revalidatePath("/[locale]/admin", "page");
  return { ok: true, data: { status: outcome.to, notifyQueued } };
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
