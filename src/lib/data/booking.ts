import "server-only";

import { and, asc, count, desc, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { booking, bookingCopilot, remoteId, zone } from "@/lib/db/schema";
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

/**
 * **Availability for a whole day view, in one query.** Never one per slot.
 *
 * ```sql
 * select slot_start, count(*) from booking
 * where zone_id = $1 and slot_start >= $2 and slot_start < $3
 *   and status in ('pending','approved')
 * group by slot_start;
 * ```
 *
 * A slot with no row is free — absence is the common case, and materialising a
 * row for it is what the whole "slots are derived, not stored" decision avoids.
 */
export async function listSlotUsage(
  _session: Session | null,
  zoneId: string,
  from: Date,
  to: Date,
): Promise<{ slotStart: string; taken: number }[]> {
  const rows = await db
    .select({ slotStart: booking.slotStart, taken: count() })
    .from(booking)
    .where(
      and(
        eq(booking.zoneId, zoneId),
        gte(booking.slotStart, from),
        lt(booking.slotStart, to),
        inArray(booking.status, [...SEAT_HOLDING_STATUSES]),
      ),
    )
    .groupBy(booking.slotStart);

  // ISO strings, because that is what the pure engine and the map both speak.
  return rows.map((row) => ({
    slotStart: row.slotStart.toISOString(),
    taken: row.taken,
  }));
}

/**
 * The instants this pilot already holds a seat at, **in any zone**. What turns
 * into `duplicate_booking` — a pilot cannot be in two places at once, and the
 * `booking_pilot_slot_uniq` index says so at the database as well.
 */
export async function listMyBookedSlotStarts(
  session: Session,
  from: Date,
  to: Date,
): Promise<string[]> {
  const rows = await db
    .select({ slotStart: booking.slotStart })
    .from(booking)
    .where(
      and(
        eq(booking.pilotUserId, session.user.id),
        gte(booking.slotStart, from),
        lt(booking.slotStart, to),
        inArray(booking.status, [...SEAT_HOLDING_STATUSES]),
      ),
    );
  return rows.map((row) => row.slotStart.toISOString());
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

/**
 * Zone names and Remote ID codes for a set of the caller's bookings, keyed by
 * booking id.
 *
 * **Two queries, not two per row.** The list and the dashboard both render
 * every booking a pilot holds; a per-row lookup would be N+1 round trips on the
 * screens whose whole job is to be a list.
 *
 * **Scoped by re-reading the caller's own bookings**, not by trusting the ids
 * passed in — an id list is caller-supplied, and taking it at face value would
 * make this a lookup for anybody's flights. Same defence as
 * `listPhotoAndRemoteIdForDrones`.
 */
export async function listZoneAndRemoteIdForBookings(
  session: Session,
  bookingIds: string[],
): Promise<
  Record<
    string,
    { zoneNameAr: string; zoneNameEn: string; remoteIdCode: string | null }
  >
> {
  if (bookingIds.length === 0) return {};

  const mine = await db.query.booking.findMany({
    where: and(
      eq(booking.pilotUserId, session.user.id),
      inArray(booking.id, bookingIds),
    ),
    columns: { id: true, zoneId: true, remoteIdId: true },
  });
  if (mine.length === 0) return {};

  const [zones, codes] = await Promise.all([
    db.query.zone.findMany({
      where: inArray(
        zone.id,
        mine.map((row) => row.zoneId),
      ),
      columns: { id: true, nameAr: true, nameEn: true },
    }),
    db.query.remoteId.findMany({
      where: inArray(
        remoteId.id,
        mine.map((row) => row.remoteIdId),
      ),
      columns: { id: true, code: true },
    }),
  ]);

  const zoneById = new Map(zones.map((row) => [row.id, row]));
  const codeById = new Map(codes.map((row) => [row.id, row.code]));

  const out: Record<
    string,
    { zoneNameAr: string; zoneNameEn: string; remoteIdCode: string | null }
  > = {};
  for (const row of mine) {
    const zoneRow = zoneById.get(row.zoneId);
    out[row.id] = {
      zoneNameAr: zoneRow?.nameAr ?? "",
      zoneNameEn: zoneRow?.nameEn ?? "",
      remoteIdCode: codeById.get(row.remoteIdId) ?? null,
    };
  }
  return out;
}
