import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { audit, type Actor } from "@/lib/audit";
import { db, type DbExecutor } from "@/lib/db";
import { booking } from "@/lib/db/schema";
import { SEAT_HOLDING_STATUSES } from "@/lib/data/booking";
import { uniqueViolationConstraint } from "@/lib/remote-id/issue";
import { autoApproveBooking } from "@/lib/workflow/booking";
import type { AirspaceDecision } from "@/lib/airspace/types";

/**
 * The last-seat race, decided by the **database**.
 *
 * A seat index plus a partial unique index — no `select … for update`, no
 * `serializable`. Two pilots pressing the button in the same second produce one
 * booking and one graceful refusal, and neither of them sees a 500.
 *
 * ```sql
 * create unique index booking_seat_uniq
 *   on booking (zone_id, slot_start, seat_index)
 *   where status in ('pending','approved');
 * ```
 *
 * **Rejected alternatives, one line each.** `select … for update` on the zone
 * row serialises every booking for that zone across all its slots and deadlocks
 * against an admin editing the zone's hours. `serializable` needs this same
 * retry loop *plus* a `40001` handler, and taxes unrelated writes.
 *
 * The index is partial for a reason worth stating: a cancelled booking stops
 * matching the predicate, so its seat is free the instant it is cancelled, with
 * nothing to sweep and no window where the seat is held by a booking that no
 * longer exists.
 */

export type CreateBookingInput = {
  pilotUserId: string;
  droneId: string;
  /**
   * The flight binds to the Remote ID, not merely to the airframe — it is what
   * an inspector scans. `booking.remoteIdId` is `NOT NULL`, so a drone with no
   * Remote ID row cannot be booked at all. That coupling is intended.
   */
  remoteIdId: string;
  zoneId: string;
  slotStart: Date;
  slotEnd: Date;
  capacity: number;
  purpose?: string | null;
  purposeNote?: string | null;
  plannedAltitudeM?: number | null;
  /** The decision as it stood, including the zone's `geometryVersion`. */
  decisionSnapshot: AirspaceDecision;
  actor: Actor;
  /**
   * Set when the zone auto-approves **and** this pilot is still eligible for
   * the fast path. The approval then happens in **this** transaction, as a real
   * transition with an actor and an audit event — never as an `approved` value
   * slipped into the insert, which would put a status in the database that
   * nothing in the trail accounts for.
   */
  autoApprove?: { zoneNameAr: string; zoneNameEn: string };
  /**
   * The seat picker, injectable **only so the retry ceiling can be executed**.
   * Every caller in the app uses the default; a probe hands in one that keeps
   * returning a taken seat, which is the only way to reach the `capacity + 1`
   * exit without staging a race that never quite lands. Same reasoning as
   * F10's injectable `generate` on `issueRemoteId` — a retry loop nobody has
   * run is a retry loop that does not work.
   */
  pickSeat?: (
    tx: DbExecutor,
    input: CreateBookingInput,
  ) => Promise<number | null>;
};

export type CreateBookingResult =
  | { ok: true; bookingId: string; seatIndex: number; approved: boolean }
  /** Every seat is held. The caller answers with alternatives, never an error. */
  | { ok: false; reason: "slot_full" }
  /**
   * This pilot, or this airframe, already holds this instant. **Not a retry** —
   * the conflict is not going to clear, and looping on it would spin until the
   * request timed out.
   */
  | { ok: false; reason: "duplicate_booking" };

const SEAT_CONSTRAINT = "booking_seat_uniq";
const DRONE_SLOT_CONSTRAINT = "booking_drone_slot_uniq";
const PILOT_SLOT_CONSTRAINT = "booking_pilot_slot_uniq";

/**
 * Claims a seat and writes the booking with its audit event, in **one**
 * transaction — so a booking that loses the race leaves no orphan trail behind
 * it, and a trail that fails to write takes the booking with it.
 *
 * No notification: the pilot is looking at the answer on screen, and a row
 * telling somebody what they have just done is the kind of noise that trains
 * people to ignore the messages that matter. F14's decision is the news.
 */
export async function createBookingWithSeat(
  input: CreateBookingInput,
  executor?: DbExecutor,
): Promise<CreateBookingResult> {
  if (executor) return claim(executor, input);
  return db.transaction((tx) => claim(tx, input));
}

async function claim(
  tx: DbExecutor,
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  /**
   * Bounded at `capacity + 1`. Each attempt either takes a seat or learns that
   * one more is gone, so `capacity` losses is the worst a correct run can do —
   * the extra attempt is the one that then finds the slot genuinely full. An
   * unbounded loop here would be a spin under contention.
   */
  const maxAttempts = input.capacity + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const seatIndex = await (input.pickSeat ?? lowestFreeSeat)(tx, input);
    if (seatIndex === null) return { ok: false, reason: "slot_full" };

    let bookingId: string;
    try {
      // A savepoint, not a bare insert: a unique violation aborts the whole
      // Postgres transaction, so a plain retry would answer "current
      // transaction is aborted" rather than claiming the next seat.
      const [row] = await tx.transaction(async (savepoint) =>
        savepoint
          .insert(booking)
          .values({
            pilotUserId: input.pilotUserId,
            droneId: input.droneId,
            remoteIdId: input.remoteIdId,
            zoneId: input.zoneId,
            slotStart: input.slotStart,
            slotEnd: input.slotEnd,
            seatIndex,
            purpose: input.purpose ?? null,
            purposeNote: input.purposeNote ?? null,
            plannedAltitudeM: input.plannedAltitudeM ?? null,
            decisionSnapshot: input.decisionSnapshot,
          })
          .returning({ id: booking.id }),
      );
      if (!row) throw new Error("booking insert returned no row");
      bookingId = row.id;
    } catch (caught) {
      // Drizzle wraps the driver's error: `DrizzleQueryError.code` is undefined
      // and the `PostgresError` is its `cause`. Walking the chain is what makes
      // this match at all — see F10's session entry.
      const constraint = uniqueViolationConstraint(caught);

      if (
        constraint === DRONE_SLOT_CONSTRAINT ||
        constraint === PILOT_SLOT_CONSTRAINT
      ) {
        return { ok: false, reason: "duplicate_booking" };
      }
      if (constraint === SEAT_CONSTRAINT) continue;
      throw caught;
    }

    await audit(tx, {
      actor: input.actor,
      entityType: "booking",
      entityId: bookingId,
      action: "booking.requested",
      after: {
        zoneId: input.zoneId,
        droneId: input.droneId,
        remoteIdId: input.remoteIdId,
        slotStart: input.slotStart.toISOString(),
        slotEnd: input.slotEnd.toISOString(),
        seatIndex,
        // The basis for the decision, geometry version included, so "why was
        // this authorised" survives the polygon being redrawn later.
        decision: {
          status: input.decisionSnapshot.status,
          geometryVersion: input.decisionSnapshot.geometryVersion,
        },
      },
    });

    /**
     * Auto-approval rides inside the same transaction as the claim. If it
     * fails, the booking fails with it — a seat held by a booking whose
     * approval rolled back is a seat nobody can see and nobody can use.
     */
    let approved = false;
    if (input.autoApprove) {
      const decided = await autoApproveBooking(tx, {
        bookingId,
        actor: input.actor,
        decision: input.decisionSnapshot,
        zoneNameAr: input.autoApprove.zoneNameAr,
        zoneNameEn: input.autoApprove.zoneNameEn,
      });
      approved = decided.ok;
    }

    return { ok: true, bookingId, seatIndex, approved };
  }

  /**
   * `capacity + 1` consecutive seat conflicts. Reachable only under heavy
   * contention, and the honest answer is the same one the loser of the last
   * seat gets — never an exception, and never another lap.
   */
  return { ok: false, reason: "slot_full" };
}

/**
 * The lowest free integer in `0 … capacity-1`.
 *
 * Lowest rather than "count of existing bookings": cancelling seat 0 of three
 * must free *that* index for reuse, and counting would hand out 2 twice.
 */
async function lowestFreeSeat(
  tx: DbExecutor,
  input: CreateBookingInput,
): Promise<number | null> {
  const rows = await tx
    .select({ seatIndex: booking.seatIndex })
    .from(booking)
    .where(
      and(
        eq(booking.zoneId, input.zoneId),
        eq(booking.slotStart, input.slotStart),
        inArray(booking.status, [...SEAT_HOLDING_STATUSES]),
      ),
    );

  const taken = new Set(rows.map((row) => row.seatIndex));
  for (let seat = 0; seat < input.capacity; seat++) {
    if (!taken.has(seat)) return seat;
  }
  return null;
}
