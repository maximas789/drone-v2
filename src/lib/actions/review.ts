"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { refuse, refuseWith, type ActionResult } from "@/lib/actions/result";
import { audit, type Actor } from "@/lib/audit";
import { getSession } from "@/lib/auth-guards";
import { getProfileForReveal } from "@/lib/data/review";
import { db } from "@/lib/db";
import { clientIpFrom, hashIp } from "@/lib/ip-hash";
import { enforceLimit } from "@/lib/rate-limit";
import { riyadhMidnight } from "@/lib/admin/validity";
import { isReviewer, roleOf, type Session } from "@/lib/session";
import {
  rejectDeclaration,
  verifyDeclaration,
} from "@/lib/workflow/declaration";

/**
 * The reviewer's acts that are not a drone or booking status change.
 *
 * The five decisions themselves already exist — `approveDroneAction`,
 * `rejectDroneAction` in `actions/drone.ts`, and the three booking ones in
 * `actions/booking.ts`. F22 builds the *surface* over them; what it adds here
 * is the two things a reviewer does that no pilot-facing action ever needed.
 *
 * Every guard is repeated inside every action **on purpose**: an action is an
 * ordinary POST to a URL, invokable with `fetch` by anyone holding its id, and
 * the `(admin)` layout that guarded the page it was rendered on never runs.
 *
 * **`not_found`, not `forbidden`, for a non-reviewer.** The same answer the
 * `(admin)` layout gives, for the same reason: a refusal that distinguishes
 * "you may not" from "it is not there" confirms the surface exists.
 *
 * No `getTranslations` in this file. Open thread 4: `next/root-params` throws
 * in a Server Action, so an action needing translated text must be handed a
 * locale — and none of these need one. Every sentence a pilot reads about a
 * refused module is either their reviewer's own words, quoted verbatim, or
 * rendered from a code at the far end.
 */

const MIN_REASON_LENGTH = 20;
const MIN_REVEAL_REASON_LENGTH = 10;
const MAX_TEXT_LENGTH = 2_000;

export type DeclarationValidity = {
  /** `YYYY-MM-DD`, or empty for "no stated start". */
  validFrom: string;
  /** `YYYY-MM-DD`, or empty for "no stated expiry". */
  validUntil: string;
};

/**
 * Verify a declared Remote ID module — the reviewer has the certificate in
 * front of them and is recording what it says.
 *
 * **Both dates are optional and an empty one means unbounded**, which is how
 * `broadcastCapableAt` reads a null. A module whose document carries no expiry
 * is verified without one rather than being given an invented date that would
 * silently ground the aircraft on an arbitrary day.
 *
 * A window given the wrong way round is refused rather than silently swapped: a
 * reviewer who typed the dates in the wrong fields wants to be told, not to
 * have the app guess which end they meant.
 */
export async function verifyDeclarationAction(
  declarationId: string,
  validity: DeclarationValidity,
): Promise<ActionResult<{ broadcastCapable: boolean }>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");
  if (!isReviewer(session)) return refuse("not_found");

  const limit = await enforceLimit("review.decide", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const from = validity.validFrom ? riyadhMidnight(validity.validFrom) : null;
  const until = validity.validUntil
    ? riyadhMidnight(validity.validUntil, true)
    : null;

  if (validity.validFrom && !from) return refuse("invalid_validity");
  if (validity.validUntil && !until) return refuse("invalid_validity");
  if (from && until && until.getTime() <= from.getTime()) {
    return refuse("invalid_validity");
  }

  const outcome = await db.transaction((tx) =>
    verifyDeclaration(tx, {
      declarationId,
      actor: actorFrom(session),
      validFrom: from,
      validUntil: until,
    }),
  );
  if (!outcome.ok) return refuse(outcome.reason);

  revalidateReviewSurfaces();
  return { ok: true, data: { broadcastCapable: outcome.broadcastCapable } };
}

/**
 * Refuse a declared module. The reason is required at the same length a
 * registration rejection requires, and for the same reason: it is quoted to the
 * pilot verbatim, and "no" is not a reason somebody can act on.
 *
 * The floor is checked **here as well as** in the panel, because the panel is
 * markup and this is a POST.
 */
export async function rejectDeclarationAction(
  declarationId: string,
  reason: string,
): Promise<ActionResult<{ broadcastCapable: boolean }>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");
  if (!isReviewer(session)) return refuse("not_found");

  const limit = await enforceLimit("review.decide", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const written = reason.trim();
  if (written.length < MIN_REASON_LENGTH) return refuse("reason_required");

  const outcome = await db.transaction((tx) =>
    rejectDeclaration(tx, {
      declarationId,
      actor: actorFrom(session),
      reason: written.slice(0, MAX_TEXT_LENGTH),
    }),
  );
  if (!outcome.ok) return refuse(outcome.reason);

  revalidateReviewSurfaces();
  return { ok: true, data: { broadcastCapable: outcome.broadcastCapable } };
}

export type RevealedPilotIdentity = {
  fullNameAr: string;
  fullNameEn: string;
  mobile: string | null;
  idDocumentType: string;
  /** The **whole** number. */
  idDocumentNumber: string;
};

/**
 * Reveal the identity document behind a **pilot profile**.
 *
 * **Closing thread 45.** F11's `revealIdentityAction` keys on a Remote ID
 * *code* and resolves through `getRemoteIdRecordByCode` — which is the right
 * shape for a field inspector holding a QR sticker, and useless to a reviewer
 * looking at a `pending` registration. A pending aircraft has no Remote ID at
 * all; it is issued at approval. So the reviewer screen had nothing to call,
 * and this is the sibling rather than a widening of the original: the two take
 * different keys, resolve through different readers, and audit against
 * different entities. Collapsing them would mean one function that means two
 * things depending on which argument was null.
 *
 * ```
 * requireReviewer → rateLimit(20/hr) → a written reason, at least 10 chars
 *   → audit_event 'pilot_profile.identity_revealed'  ← BEFORE the return
 *   → the unmasked identity
 * ```
 *
 * **The audit write happens first and in its own transaction.** If it fails the
 * reveal fails and nothing comes back — a reveal that is not logged did not
 * happen, and the value must not leave the database on a path where the trail
 * did not commit. F11 proved this by forcing the write to fail; the same
 * property has to hold here for the same reason.
 *
 * No `remote_id_scan` row is written, deliberately. That table records
 * *resolutions of a code*, and there is no code here — a row in it would be a
 * scan that never happened, and F11's scan history would start counting reveals
 * driven from a page that never resolved anything.
 */
export async function revealPilotIdentityAction(
  userId: string,
  reason: string,
): Promise<ActionResult<RevealedPilotIdentity>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");
  if (!isReviewer(session)) return refuse("not_found");

  const limit = await enforceLimit("identity.reveal", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const written = reason.trim();
  if (
    written.length < MIN_REVEAL_REASON_LENGTH ||
    written.length > MAX_TEXT_LENGTH
  ) {
    return refuse("reveal_reason_required");
  }

  const profile = await getProfileForReveal(session, userId);
  if (!profile) return refuse("not_found");

  const requestHeaders = await headers();
  const ip = clientIpFrom(requestHeaders);

  try {
    await db.transaction(async (tx) => {
      await audit(tx, {
        actor: actorFrom(session),
        entityType: "pilot_profile",
        entityId: profile.id,
        action: "pilot_profile.identity_revealed",
        // The trail carries **no** part of the number, not even the mask —
        // an append-only log that accumulates masks accumulates a corpus.
        after: { userId: profile.userId },
        reason: written,
        ipHash: ip ? hashIp(ip) : null,
        userAgent: requestHeaders.get("user-agent"),
      });
    });
  } catch (caught) {
    // Loud, and empty-handed.
    console.error("[review] pilot identity reveal was not logged:", caught);
    return refuse("reveal_not_logged");
  }

  return {
    ok: true,
    data: {
      fullNameAr: profile.fullNameAr,
      fullNameEn: profile.fullNameEn,
      mobile: profile.mobileE164,
      idDocumentType: profile.idDocumentType,
      idDocumentNumber: profile.idDocumentNumber,
    },
  };
}

/**
 * The queue and the review screen both change when a module is decided — the
 * queue because its counts move, the screen because it is showing the row.
 */
function revalidateReviewSurfaces(): void {
  revalidatePath("/[locale]/admin", "page");
  revalidatePath("/[locale]/admin/drones/[id]", "page");
  revalidatePath("/[locale]/drones/[id]/remote-id", "page");
}

/**
 * The role is captured **at the time of the act**. A reviewer later promoted to
 * admin must not retroactively appear to have acted as one.
 */
function actorFrom(session: Session): Actor {
  return { userId: session.user.id, role: roleOf(session), isSystem: false };
}
