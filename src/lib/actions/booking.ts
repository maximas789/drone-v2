"use server";

import { revalidatePath } from "next/cache";
import {
  refuse,
  refuseWith,
  type ActionResult,
  type Reason,
} from "@/lib/actions/result";
import { evaluateAirspace } from "@/lib/airspace/evaluate";
import {
  isFlightPurpose,
  validateCopilots,
  type CopilotInput,
} from "@/lib/validation/booking";
import { buildDayContext } from "@/lib/airspace/query";
import { riyadhDayBounds, riyadhYmd } from "@/lib/airspace/time";
import type {
  AirspaceDecision,
  MatchedZone,
  Reason as AirspaceReason,
  Slot,
} from "@/lib/airspace/types";
import type { Actor } from "@/lib/audit";
import { getSession } from "@/lib/auth-guards";
import { createBookingWithSeat } from "@/lib/booking/create";
import { db } from "@/lib/db";
import {
  deriveSlots,
  findAlternativeSlots,
  slotStates,
} from "@/lib/booking/slots";
import { getBookingById, listSlotUsage } from "@/lib/data/booking";
import { getDroneById, getRemoteIdForDrone } from "@/lib/data/drone";
import { autoApproveEligible } from "@/lib/data/pilot";
import { enforceLimit } from "@/lib/rate-limit";
import { isReviewer, roleOf, type Session } from "@/lib/session";
import {
  approveBooking,
  cancelBookingByAuthority,
  cancelBookingByPilot,
  checkInBooking,
  rejectBooking,
} from "@/lib/workflow/booking";

/**
 * The booking surface. `listSlots` fills the picker; `createBooking` claims a
 * seat.
 *
 * The guard is repeated in each **on purpose**: an action is an ordinary POST
 * to a URL, and whatever layout guarded the page it was rendered on never runs.
 *
 * **F14 completed this file.** F13 shipped only `listSlots` and `createBooking`,
 * because cancelling, checking in and deciding are all status changes and
 * `transitions.ts` held nothing but the four system edges. It now holds every
 * human edge, and `apply.ts` resolves `owner` from the locked row — so the rest
 * of the lifecycle lives here.
 */

const MAX_ALTITUDE_M = 10_000;
const MAX_TEXT_LENGTH = 2_000;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export type SlotListing = {
  zone: MatchedZone & {
    capacity: number;
    slotDurationMinutes: number;
    autoApprove: boolean;
  };
  ymd: string;
  slots: Slot[];
};

/**
 * The day's grid, with each slot's state merged in.
 *
 * Derived, never stored — and the availability behind it is **one** grouped
 * query for the whole day, never one per slot.
 */
export async function listSlotsAction(
  zoneId: string,
  ymd: string,
  droneId?: string | null,
): Promise<ActionResult<SlotListing>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");

  const limit = await enforceLimit("airspace.check", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  if (!YMD.test(ymd)) return refuse("invalid_date");

  const { zone, context } = await buildDayContext(
    session,
    zoneId,
    ymd,
    droneId ?? null,
  );
  if (!zone) return refuse("not_found");

  return {
    ok: true,
    data: {
      zone: {
        id: zone.id,
        code: zone.code,
        nameAr: zone.nameAr,
        nameEn: zone.nameEn,
        kind: zone.kind,
        ceilingAglM: zone.ceilingAglM,
        capacity: zone.capacity,
        slotDurationMinutes: zone.slotDurationMinutes,
        autoApprove: zone.autoApprove,
      },
      ymd,
      slots: slotStates({
        zone,
        slots: deriveSlots(zone, zone.hours, ymd),
        closures: zone.closures,
        availability: context.availability,
        now: new Date(),
        pilotBusySlots: context.pilotBusySlots,
        pilotBookingsOnDay: context.pilotBookingsOnDay,
        maxSlotsPerPilotPerDay: zone.maxSlotsPerPilotPerDay,
      }),
    },
  };
}

export type CreateBookingActionInput = {
  droneId: string;
  zoneId: string;
  /** ISO. Must land exactly on the zone's grid — `slot_not_on_grid` otherwise. */
  slotStart: string;
  purpose?: string | null;
  purposeNote?: string | null;
  plannedAltitudeM?: number | null;
  /**
   * Up to three, and **re-validated here.** The wizard runs the same
   * `validateCopilots` for an early answer; this is not that check moved
   * client-side, it is the check — the action is an ordinary POST and reachable
   * without the form.
   */
  copilots?: readonly CopilotInput[];
};

export type BookingCreated = {
  bookingId: string;
  seatIndex: number;
  /** True when the zone auto-approves and the pilot is still eligible for it. */
  approved: boolean;
  decision: AirspaceDecision;
};

/**
 * Wider than `ActionResult` by one field, and deliberately so: **a refusal here
 * always carries what would work instead.** `slot_full` with no alternatives is
 * a dead end, and the whole design of this feature is that the loser of a race
 * sees three one-click buttons rather than an error.
 */
export type CreateBookingOutcome =
  | { ok: true; data: BookingCreated }
  | { ok: false; reasons: Reason[]; alternatives?: Slot[] };

/**
 * ```
 * getSession → rateLimit → parse → evaluateAirspace (everything but capacity)
 *            → seat claim + audit, in ONE transaction
 *            → revalidatePath
 *            → { ok: true } | { ok: false, reasons }
 * ```
 *
 * Capacity is the one rule the engine does **not** decide: two pilots
 * evaluating at the same instant both see a free seat, and only the unique
 * index can break the tie. The loser gets `slot_full` and three alternatives —
 * never an exception, never a lost form.
 */
export async function createBookingAction(
  input: CreateBookingActionInput,
): Promise<CreateBookingOutcome> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");

  const limit = await enforceLimit("booking.create", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const slotStart = new Date(input.slotStart);
  if (Number.isNaN(slotStart.getTime())) return refuse("invalid_date");

  const altitude =
    input.plannedAltitudeM === null || input.plannedAltitudeM === undefined
      ? null
      : Number.isFinite(input.plannedAltitudeM) &&
          input.plannedAltitudeM >= 0 &&
          input.plannedAltitudeM <= MAX_ALTITUDE_M
        ? input.plannedAltitudeM
        : null;
  if (input.plannedAltitudeM !== null && input.plannedAltitudeM !== undefined && altitude === null) {
    return refuse("invalid_altitude");
  }

  const ymd = riyadhYmd(slotStart);
  const { zone, context } = await buildDayContext(
    session,
    input.zoneId,
    ymd,
    input.droneId,
  );
  // Not yours, not there, or not published — one answer, so the refusal cannot
  // be used to enumerate zones a reviewer is still drafting.
  if (!zone) return refuse("not_found");
  if (!context.aircraft) return refuse("not_found");

  /**
   * **You may only book your own aircraft.**
   *
   * Every read on the path here — `buildDayContext`, `getRemoteIdForDrone` —
   * resolves through `getDroneById`, which deliberately answers for *any*
   * reviewer so the review queue can load an airframe it does not own. Nothing
   * downstream narrowed that back: `createBookingWithSeat` writes
   * `pilotUserId: session.user.id` beside the caller's `droneId`, so a member
   * of staff could put a booking on somebody else's aircraft — and the owner
   * would see a flight they never planned, while the anonymous scan page for
   * that Remote ID reported it in the air.
   *
   * The four sibling actions that share this read all narrow it the same way
   * (`saveDroneDraftAction`, `deleteDroneAction`, `regenerateQrAction`,
   * `declareModuleAction`); this one did not. `not_found`, like its siblings,
   * so the refusal says nothing about whose aircraft it is.
   */
  const airframe = await getDroneById(session, input.droneId);
  if (!airframe || airframe.ownerUserId !== session.user.id) {
    return refuse("not_found");
  }

  const slotEnd = new Date(
    slotStart.getTime() + zone.slotDurationMinutes * 60_000,
  );
  const now = new Date();

  /**
   * **The same function the map called.** A point the map showed green is
   * accepted here and a point it showed red is refused with the identical code,
   * because there is only one implementation of the question.
   */
  const decision = evaluateAirspace(
    {
      zoneId: zone.id,
      altitudeAglM: altitude,
      slotStart: slotStart.toISOString(),
      slotEnd: slotEnd.toISOString(),
      now: now.toISOString(),
    },
    context,
  );

  if (decision.status === "denied") {
    return { ok: false, reasons: decision.reasons };
  }

  /**
   * `booking.remoteIdId` is `NOT NULL`: the flight binds to the identity an
   * inspector can scan, not merely to the airframe. The engine already refused
   * `no_remote_id`, so reaching here without one is a broken invariant rather
   * than a user error — but it is still answered, not thrown.
   */
  const remoteId = await getRemoteIdForDrone(session, input.droneId);
  if (!remoteId) return { ok: false, reasons: [{ code: "no_remote_id" }] };

  /**
   * `booking.purpose` is a plain `text` column, so this whitelist is the only
   * thing standing between a hand-made POST and an arbitrary string rendered
   * back on the detail page and in the reviewer's queue. An absent purpose is
   * allowed; an invented one is not.
   */
  if (input.purpose != null && input.purpose !== "" && !isFlightPurpose(input.purpose)) {
    return { ok: false, reasons: [{ code: "invalid_purpose" }] };
  }

  const crew = validateCopilots(input.copilots ?? []);
  if (!crew.ok) {
    return { ok: false, reasons: crew.problems.map((code) => ({ code })) };
  }

  /**
   * Two conditions, both required. The **zone** says no human is needed here;
   * the **pilot** has not repeatedly taken a slot and failed to turn up. A zone
   * that trusts everybody plus a pilot who no-shows weekly is how capacity gets
   * burned by nobody flying.
   *
   * `needs_review` from the engine already means `autoApprove: false`, so the
   * decision's own status is the zone half of this test.
   */
  const eligible =
    decision.status === "allowed" &&
    zone.autoApprove &&
    (await autoApproveEligible(session, session.user.id, now));

  const claimed = await createBookingWithSeat({
    pilotUserId: session.user.id,
    droneId: input.droneId,
    remoteIdId: remoteId.id,
    zoneId: zone.id,
    slotStart,
    slotEnd,
    capacity: zone.capacity,
    purpose: input.purpose?.trim().slice(0, MAX_TEXT_LENGTH) || null,
    purposeNote: input.purposeNote?.trim().slice(0, MAX_TEXT_LENGTH) || null,
    plannedAltitudeM: altitude,
    copilots: crew.copilots,
    decisionSnapshot: decision,
    actor: actorFrom(session),
    autoApprove: eligible
      ? { zoneNameAr: zone.nameAr, zoneNameEn: zone.nameEn }
      : undefined,
  });

  if (!claimed.ok) {
    const reasons: AirspaceReason[] = [
      {
        code: claimed.reason,
        zoneId: zone.id,
        zoneNameAr: zone.nameAr,
        zoneNameEn: zone.nameEn,
      },
    ];
    // `duplicate_booking` gets none: the conflict is the pilot's own existing
    // booking, and offering them a different slot answers a question they did
    // not ask. `slot_full` is the one a different time actually fixes.
    return claimed.reason === "slot_full"
      ? {
          ok: false,
          reasons,
          alternatives: await alternativesFor(session, zone, ymd, context, now),
        }
      : { ok: false, reasons };
  }

  revalidatePath("/[locale]/bookings", "page");

  return {
    ok: true,
    data: {
      bookingId: claimed.bookingId,
      seatIndex: claimed.seatIndex,
      approved: claimed.approved,
      decision,
    },
  };
}

// --- the rest of the lifecycle -------------------------------------------

const MAX_REASON_LENGTH = 2_000;

/**
 * The pilot cancelling their own slot. Refused inside the last two hours — a
 * cancellation ten minutes before the window is a no-show with better manners,
 * and somebody else could have flown.
 */
export async function cancelBookingAction(
  bookingId: string,
  reason?: string | null,
): Promise<ActionResult<{ status: string }>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");

  const limit = await enforceLimit("booking.create", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  // Not yours, or not there — one answer, so a refusal cannot be used to work
  // out which. Ownership is re-checked against the locked row by `apply.ts`.
  if (!(await getBookingById(session, bookingId))) return refuse("not_found");

  const outcome = await db.transaction((tx) =>
    cancelBookingByPilot(tx, {
      bookingId,
      actor: actorFrom(session),
      reason: reason?.slice(0, MAX_REASON_LENGTH) ?? null,
    }),
  );
  if (!outcome.ok) return refuse(outcome.reason);

  revalidatePath("/[locale]/bookings", "page");
  return { ok: true, data: { status: outcome.to } };
}

/**
 * Check-in. **Sets `checkedInAt` and changes no status** — the closeout job
 * reads that column hours later to decide `completed` versus `no_show`.
 */
export async function checkInBookingAction(
  bookingId: string,
): Promise<ActionResult<{ checkedInAt: string }>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");

  const limit = await enforceLimit("booking.create", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  if (!(await getBookingById(session, bookingId))) return refuse("not_found");

  const outcome = await db.transaction((tx) =>
    checkInBooking(tx, { bookingId, actor: actorFrom(session) }),
  );
  if (!outcome.ok) return refuse(outcome.reason);

  revalidatePath("/[locale]/bookings", "page");
  return { ok: true, data: { checkedInAt: outcome.checkedInAt.toISOString() } };
}

/**
 * A reviewer approving a request — which **re-runs `evaluateAirspace`** inside
 * the approving transaction. A booking whose zone closed after the request was
 * made is refused with the reasons that changed, not waved through.
 */
export async function approveBookingAction(
  bookingId: string,
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
    approveBooking(tx, { bookingId, actor: actorFrom(session) }),
  );

  if (!outcome.ok) {
    // The airspace answer is worth more than the refusal code alone: it says
    // *what changed* since the pilot asked.
    return outcome.reason === "no_longer_authorised" && outcome.reasons
      ? { ok: false, reasons: outcome.reasons }
      : refuse(outcome.reason);
  }

  revalidateReviewSurfaces();
  return { ok: true, data: { status: outcome.to } };
}

/** A reviewer refusing one. Reason required, at least 20 characters. */
export async function rejectBookingAction(
  bookingId: string,
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
    rejectBooking(tx, {
      bookingId,
      actor: actorFrom(session),
      reason: reason.slice(0, MAX_REASON_LENGTH),
    }),
  );
  if (!outcome.ok) return refuse(outcome.reason);

  revalidateReviewSurfaces();
  return { ok: true, data: { status: outcome.to } };
}

/** An authority taking a slot away, at any time, with a reason. */
export async function cancelBookingByAuthorityAction(
  bookingId: string,
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
    cancelBookingByAuthority(tx, {
      bookingId,
      actor: actorFrom(session),
      reason: reason.slice(0, MAX_REASON_LENGTH),
    }),
  );
  if (!outcome.ok) return refuse(outcome.reason);

  revalidateReviewSurfaces();
  return { ok: true, data: { status: outcome.to } };
}

/**
 * Every surface a reviewer's decision changes: the queue (its counts move), the
 * bookings tab, the detail page they are standing on, and the pilot's own list.
 *
 * All four, for all three decisions. Before F22b only `/admin` was revalidated,
 * which was right when `/admin` was the only reviewer surface and wrong the
 * moment the booking screen existed — a reviewer who rejected a request and
 * pressed back would have met the row still sitting in a cached queue.
 */
function revalidateReviewSurfaces(): void {
  revalidatePath("/[locale]/admin", "page");
  revalidatePath("/[locale]/admin/bookings", "page");
  revalidatePath("/[locale]/admin/bookings/[id]", "page");
  revalidatePath("/[locale]/bookings", "page");
}

/**
 * The role is captured **at the time of the act**. A reviewer later promoted to
 * admin must not retroactively appear to have acted as one.
 */
function actorFrom(session: Session): Actor {
  return { userId: session.user.id, role: roleOf(session), isSystem: false };
}

/**
 * The three nearest free slots, for the pilot who just lost the last seat.
 *
 * Availability is re-read across the zone's whole advance window rather than
 * the single day the picker was showing — an alternative offered on a day
 * nobody counted would be a guess, and the point of this list is that every
 * button on it works.
 */
async function alternativesFor(
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  zone: Awaited<ReturnType<typeof buildDayContext>>["zone"],
  ymd: string,
  context: Awaited<ReturnType<typeof buildDayContext>>["context"],
  now: Date,
): Promise<Slot[]> {
  if (!zone) return [];
  const { start } = riyadhDayBounds(ymd);
  const horizon = new Date(
    start.getTime() + zone.maxAdvanceDays * 24 * 60 * 60_000,
  );

  const availability = await listSlotUsage(session, zone.id, start, horizon);

  return findAlternativeSlots({
    zone,
    hours: zone.hours,
    closures: zone.closures,
    availability,
    now,
    fromYmd: ymd,
    maxDays: zone.maxAdvanceDays,
    after: new Date(now.getTime() + zone.minLeadMinutes * 60_000),
    pilotBusySlots: context.pilotBusySlots,
    pilotBookingsOnDay: context.pilotBookingsOnDay,
    maxSlotsPerPilotPerDay: zone.maxSlotsPerPilotPerDay,
  });
}
