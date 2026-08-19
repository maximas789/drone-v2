import "server-only";

import { eq } from "drizzle-orm";
import type { Actor } from "@/lib/audit";
import { audit } from "@/lib/audit";
import { evaluateAirspace } from "@/lib/airspace/evaluate";
import { buildContextForBooking } from "@/lib/airspace/query";
import type { AirspaceDecision, Reason } from "@/lib/airspace/types";
import type { DbExecutor } from "@/lib/db";
import { booking, zone } from "@/lib/db/schema";
import { applyTransition, type TransitionOutcome } from "./apply";
import { isOwnSubmission, pilotMayCancel } from "./rules";

/**
 * The booking lifecycle.
 *
 * The one rule worth stating loudly: **approval re-runs `evaluateAirspace`**.
 * A booking is a request about the future, and the future moves — the zone's
 * hours may have changed, a closure may have been published, the registration
 * may have expired since the pilot asked. Approving without re-checking
 * authorises a flight against facts that were true last week.
 */

export type BookingOutcome =
  | { ok: true; from: string; to: string; decision?: AirspaceDecision }
  | {
      ok: false;
      reason:
        | "not_found"
        | "invalid_transition"
        | "already_applied"
        | "reason_required"
        | "cancel_too_late"
        | "no_longer_authorised"
        /** Four eyes: the reviewer is the pilot who requested it. */
        | "own_submission";
      from?: string;
      /** Present on `no_longer_authorised`: what the re-check refused on. */
      reasons?: Reason[];
    };

/**
 * Pending → approved, by a reviewer.
 *
 * The re-check happens **inside the approving transaction**, against a context
 * read through the same executor, so nothing can change between the check and
 * the write. The resulting `AirspaceDecision` — `geometryVersion` and all — is
 * stored on the row as `decisionSnapshot`: the answer to "on what basis was
 * this authorised" after the polygon has since been redrawn.
 */
export async function approveBooking(
  tx: DbExecutor,
  {
    bookingId,
    actor,
    at = new Date(),
  }: { bookingId: string; actor: Actor; at?: Date },
): Promise<BookingOutcome> {
  // Named `zoneRule` rather than `zone`: the schema table of that name is in
  // scope in this module, and a shadow there would be a quiet one.
  const { booking: row, zone: zoneRule, context } = await buildContextForBooking(
    tx,
    bookingId,
  );
  if (!row || !zoneRule) return { ok: false, reason: "not_found" };
  /**
   * **Four eyes, before the airspace re-check.** Ordering matters: a reviewer
   * refused for the right reason should be told *that*, not handed a green
   * airspace answer they still cannot act on.
   */
  if (isOwnSubmission(actor.userId, row.pilotUserId)) {
    return { ok: false, reason: "own_submission", from: "pending" };
  }

  const decision = evaluateAirspace(
    {
      zoneId: zoneRule.id,
      slotStart: row.slotStart.toISOString(),
      slotEnd: row.slotEnd.toISOString(),
      now: at.toISOString(),
    },
    context,
  );

  if (decision.status === "denied") {
    /**
     * **Refused, not forced through.** The reviewer is shown what changed since
     * the request — a closure published yesterday, a registration that lapsed —
     * and can reject with that reason. Approving anyway would put the app's own
     * name on a flight its own rules forbid.
     */
    return {
      ok: false,
      reason: "no_longer_authorised",
      from: "pending",
      reasons: decision.reasons,
    };
  }

  return toOutcome(
    await applyTransition(
      {
        transition: "booking.approved",
        id: bookingId,
        actor,
        patch: {
          decidedAt: at,
          decidedByUserId: actor.userId,
          rejectionReason: null,
          decisionSnapshot: decision,
        },
        notification: {
          userId: row.pilotUserId,
          type: "bookingConfirmed",
          params: { zoneAr: zoneRule.nameAr, zoneEn: zoneRule.nameEn },
          entityType: "booking",
          entityId: bookingId,
          href: `/bookings/${bookingId}`,
        },
      },
      tx,
    ),
    decision,
  );
}

/**
 * The auto-approve path, driven by the pilot **in the same transaction as the
 * booking's creation**.
 *
 * It is a real transition rather than an `approved` value handed to the insert,
 * so an automatic approval appears in the trail as a decision with an actor and
 * a timestamp. A status that simply appeared, with nothing recording who
 * decided it, is the thing this whole folder exists to prevent.
 *
 * The re-check that `approveBooking` performs is not repeated here: the
 * evaluation that produced this decision ran moments ago in the same request,
 * and its result is the snapshot being stored.
 */
export async function autoApproveBooking(
  tx: DbExecutor,
  {
    bookingId,
    actor,
    decision,
    zoneNameAr,
    zoneNameEn,
    at = new Date(),
  }: {
    bookingId: string;
    actor: Actor;
    decision: AirspaceDecision;
    zoneNameAr: string;
    zoneNameEn: string;
    at?: Date;
  },
): Promise<BookingOutcome> {
  const row = await tx.query.booking.findFirst({
    where: eq(booking.id, bookingId),
  });
  if (!row) return { ok: false, reason: "not_found" };

  return toOutcome(
    await applyTransition(
      {
        transition: "booking.auto_approved",
        id: bookingId,
        actor,
        patch: { decidedAt: at, decisionSnapshot: decision },
        notification: {
          userId: row.pilotUserId,
          type: "bookingConfirmed",
          params: { zoneAr: zoneNameAr, zoneEn: zoneNameEn },
          entityType: "booking",
          entityId: bookingId,
          href: `/bookings/${bookingId}`,
        },
      },
      tx,
    ),
    decision,
  );
}

/** Pending → rejected. Reason required, and the pilot reads it verbatim. */
export async function rejectBooking(
  tx: DbExecutor,
  {
    bookingId,
    actor,
    reason,
    at = new Date(),
  }: { bookingId: string; actor: Actor; reason: string; at?: Date },
): Promise<BookingOutcome> {
  const row = await tx.query.booking.findFirst({
    where: eq(booking.id, bookingId),
  });
  if (!row) return { ok: false, reason: "not_found" };
  if (isOwnSubmission(actor.userId, row.pilotUserId)) {
    return { ok: false, reason: "own_submission", from: row.status };
  }

  return toOutcome(
    await applyTransition(
      {
        transition: "booking.rejected",
        id: bookingId,
        actor,
        reason,
        patch: {
          decidedAt: at,
          decidedByUserId: actor.userId,
          rejectionReason: reason.trim(),
        },
        notification: {
          userId: row.pilotUserId,
          type: "bookingRejected",
          params: await zoneNamesFor(tx, row.zoneId),
          entityType: "booking",
          entityId: bookingId,
          href: `/bookings/${bookingId}`,
        },
      },
      tx,
    ),
  );
}

/**
 * The pilot cancelling their own slot, **no later than two hours before it
 * starts**.
 *
 * The lead time is what makes the seat worth freeing: a cancellation ten
 * minutes before the window is not a cancellation, it is a no-show with better
 * manners, and somebody else could have flown.
 */
export async function cancelBookingByPilot(
  tx: DbExecutor,
  {
    bookingId,
    actor,
    reason = null,
    at = new Date(),
  }: { bookingId: string; actor: Actor; reason?: string | null; at?: Date },
): Promise<BookingOutcome> {
  const row = await tx.query.booking.findFirst({
    where: eq(booking.id, bookingId),
  });
  if (!row) return { ok: false, reason: "not_found" };

  if (!pilotMayCancel(row.slotStart, at)) {
    return { ok: false, reason: "cancel_too_late", from: row.status };
  }

  return toOutcome(
    await applyTransition(
      {
        transition: "booking.cancelled_by_pilot",
        id: bookingId,
        actor,
        reason,
        patch: {
          cancelledAt: at,
          cancelledByUserId: actor.userId,
          cancellationReason: reason?.trim() ?? null,
        },
        // No notification: the pilot cancelled it themselves and is looking at
        // the result. F22's queue is where a reviewer sees the seat come back.
      },
      tx,
    ),
  );
}

/**
 * A reviewer or admin taking a slot away — **at any time, with a reason**.
 *
 * No lead-time guard, deliberately: an authority cancelling twenty minutes
 * before a flight is the case this exists for.
 */
export async function cancelBookingByAuthority(
  tx: DbExecutor,
  {
    bookingId,
    actor,
    reason,
    at = new Date(),
  }: { bookingId: string; actor: Actor; reason: string; at?: Date },
): Promise<BookingOutcome> {
  const row = await tx.query.booking.findFirst({
    where: eq(booking.id, bookingId),
  });
  if (!row) return { ok: false, reason: "not_found" };
  /**
   * Four eyes here too, and for a reason that is not obvious. An authority
   * cancellation has **no** lead-time limit — that is the whole point of it —
   * so a reviewer cancelling their own flight twenty minutes before the slot
   * would be walking round `pilotMayCancel`'s two-hour cutoff using a power
   * granted for somebody else's emergency. Their own booking is cancelled with
   * the pilot control, under the pilot rule, like anyone else's.
   */
  if (isOwnSubmission(actor.userId, row.pilotUserId)) {
    return { ok: false, reason: "own_submission", from: row.status };
  }

  return toOutcome(
    await applyTransition(
      {
        transition: "booking.cancelled_by_authority",
        id: bookingId,
        actor,
        reason,
        patch: {
          cancelledAt: at,
          cancelledByUserId: actor.userId,
          cancellationReason: reason.trim(),
        },
        notification: {
          userId: row.pilotUserId,
          type: "bookingCancelled",
          params: await zoneNamesFor(tx, row.zoneId),
          entityType: "booking",
          entityId: bookingId,
          href: `/bookings/${bookingId}`,
        },
      },
      tx,
    ),
  );
}

/**
 * Check-in. **Sets `checkedInAt` and changes no status.**
 *
 * That is the whole design: `booking-closeout` (F08) reads this column to
 * decide `completed` versus `no_show`, hours later. Making check-in a status
 * change would mean the closeout job had nothing left to decide, and a pilot
 * who checked in but never flew would be recorded as having completed a flight.
 *
 * It is here rather than in a data module because it is part of the booking's
 * lifecycle and it writes an audit event — but it is not a transition, and it
 * deliberately does not pretend to be one.
 */
export async function checkInBooking(
  tx: DbExecutor,
  {
    bookingId,
    actor,
    at = new Date(),
  }: { bookingId: string; actor: Actor; at?: Date },
): Promise<
  | { ok: true; checkedInAt: Date }
  | { ok: false; reason: "not_found" | "invalid_transition" | "already_applied" }
> {
  const row = await tx.query.booking.findFirst({
    where: eq(booking.id, bookingId),
  });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.pilotUserId !== actor.userId) {
    return { ok: false, reason: "invalid_transition" };
  }
  // Only an approved flight can be checked in to.
  if (row.status !== "approved") {
    return { ok: false, reason: "invalid_transition" };
  }
  if (row.checkedInAt) return { ok: false, reason: "already_applied" };

  await tx
    .update(booking)
    .set({ checkedInAt: at, updatedAt: new Date() })
    .where(eq(booking.id, bookingId));

  await audit(tx, {
    actor,
    entityType: "booking",
    entityId: bookingId,
    action: "booking.checked_in",
    after: { checkedInAt: at.toISOString() },
  });

  return { ok: true, checkedInAt: at };
}

/**
 * Both name variants, because a notification stores `type` + `params` and never
 * rendered text — a pilot who switches language must see their old
 * notifications in the new one. `notify.ts` requires both; F15's renderer picks.
 */
async function zoneNamesFor(
  tx: DbExecutor,
  zoneId: string,
): Promise<{ zoneAr: string; zoneEn: string }> {
  const row = await tx.query.zone.findFirst({
    where: eq(zone.id, zoneId),
    columns: { nameAr: true, nameEn: true },
  });
  return { zoneAr: row?.nameAr ?? "", zoneEn: row?.nameEn ?? "" };
}

function toOutcome(
  outcome: TransitionOutcome,
  decision?: AirspaceDecision,
): BookingOutcome {
  return outcome.ok
    ? { ok: true, from: outcome.from, to: outcome.to, decision }
    : { ok: false, reason: outcome.reason, from: outcome.from };
}
