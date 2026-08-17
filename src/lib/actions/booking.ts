"use server";

import { revalidatePath } from "next/cache";
import {
  refuse,
  refuseWith,
  type ActionResult,
  type Reason,
} from "@/lib/actions/result";
import { evaluateAirspace } from "@/lib/airspace/evaluate";
import { buildDayContext } from "@/lib/airspace/query";
import { riyadhDayBounds, riyadhYmd } from "@/lib/airspace/time";
import type {
  AirspaceDecision,
  MatchedZone,
  Reason as AirspaceReason,
  Slot,
} from "@/lib/airspace/types";
import { getSession } from "@/lib/auth-guards";
import { createBookingWithSeat } from "@/lib/booking/create";
import {
  deriveSlots,
  findAlternativeSlots,
  slotStates,
} from "@/lib/booking/slots";
import { listSlotUsage } from "@/lib/data/booking";
import { getRemoteIdForDrone } from "@/lib/data/drone";
import { enforceLimit } from "@/lib/rate-limit";
import { roleOf } from "@/lib/session";

/**
 * The booking surface. `listSlots` fills the picker; `createBooking` claims a
 * seat.
 *
 * The guard is repeated in each **on purpose**: an action is an ordinary POST
 * to a URL, and whatever layout guarded the page it was rendered on never runs.
 *
 * **`cancelBooking` and `checkInBooking` are not here.** Both are status
 * changes, and rule 11 puts every status change behind `applyTransition` — but
 * `transitions.ts` holds only the four *system* edges, and `apply.ts` maps only
 * the `"system"` actor. Adding the human edges and the role branch is F14's
 * central deliverable, and half-building it here is exactly the drift that
 * would give the app two state machines. Cancelling still frees a seat the
 * moment the status changes, because the unique index is partial — that is a
 * property of the schema, not of the missing action.
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
};

export type BookingCreated = {
  bookingId: string;
  seatIndex: number;
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
    decisionSnapshot: decision,
    actor: {
      userId: session.user.id,
      role: roleOf(session),
      isSystem: false,
    },
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
      decision,
    },
  };
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
