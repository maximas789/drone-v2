import "server-only";

import { and, asc, count, desc, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { booking, bookingCopilot } from "@/lib/db/schema";
import { isReviewer, type Session } from "@/lib/session";

/** The statuses that hold a seat. Must match the partial unique indexes. */
export const SEAT_HOLDING_STATUSES = ["pending", "approved"] as const;

export async function listMyUpcomingBookings(session: Session, now = new Date()) {
  return db.query.booking.findMany({
    where: and(
      eq(booking.pilotUserId, session.user.id),
      gte(booking.slotEnd, now),
    ),
    orderBy: [asc(booking.slotStart)],
  });
}

export async function listMyPastBookings(session: Session, now = new Date()) {
  return db.query.booking.findMany({
    where: and(
      eq(booking.pilotUserId, session.user.id),
      lt(booking.slotEnd, now),
    ),
    orderBy: [desc(booking.slotStart)],
  });
}

export async function getBookingById(session: Session, id: string) {
  const row = await db.query.booking.findFirst({ where: eq(booking.id, id) });
  if (!row) return null;
  if (row.pilotUserId !== session.user.id && !isReviewer(session)) return null;
  return row;
}

export async function getBookingCopilots(session: Session, bookingId: string) {
  const owned = await getBookingById(session, bookingId);
  if (!owned) return [];
  return db.query.bookingCopilot.findMany({
    where: eq(bookingCopilot.bookingId, bookingId),
  });
}

/**
 * Seats already taken in a slot. Read by the booking UI to show remaining
 * capacity — but it is **not** what enforces capacity. That is the
 * `booking_seat_uniq` partial index, because a read-then-write here would race
 * two pilots into the same seat. See F13.
 */
export async function listTakenSeats(
  _session: Session | null,
  zoneId: string,
  slotStart: Date,
) {
  const rows = await db
    .select({ seatIndex: booking.seatIndex })
    .from(booking)
    .where(
      and(
        eq(booking.zoneId, zoneId),
        eq(booking.slotStart, slotStart),
        inArray(booking.status, [...SEAT_HOLDING_STATUSES]),
      ),
    );
  return rows.map((row) => row.seatIndex);
}

/** Enforces `zone.maxSlotsPerPilotPerDay`. Riyadh civil day, passed in. */
export async function countMyBookingsInWindow(
  session: Session,
  from: Date,
  to: Date,
) {
  const [row] = await db
    .select({ value: count() })
    .from(booking)
    .where(
      and(
        eq(booking.pilotUserId, session.user.id),
        gte(booking.slotStart, from),
        lte(booking.slotStart, to),
        inArray(booking.status, [...SEAT_HOLDING_STATUSES]),
      ),
    );
  return row?.value ?? 0;
}

export async function listPendingBookings(session: Session, limit = 50) {
  if (!isReviewer(session)) return [];
  return db.query.booking.findMany({
    where: eq(booking.status, "pending"),
    orderBy: [asc(booking.createdAt)],
    limit,
  });
}
