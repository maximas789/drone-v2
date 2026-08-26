import "server-only";

import { and, eq, gt, gte, inArray, isNotNull, lt, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  auditEvent,
  booking,
  drone,
  emailLog,
  remoteId,
  user,
  zone,
  zoneClosure,
} from "@/lib/db/schema";

/**
 * What the scheduled jobs read.
 *
 * **Why not `src/lib/data/*.ts`.** Rule 8 makes every read there take a session
 * as its first argument, because the session is what decides which rows the
 * caller may see. A cron has no session and must see **every** user's rows —
 * handing these functions a fabricated one would put a fake reader in the one
 * place where the ownership rule is meant to be legible. Named here, deliberately
 * separate, so nothing in `src/lib/data/` grows an unauthenticated door.
 *
 * These are reads only. Every write goes through `src/lib/workflow/`.
 */

/** The statuses a booking holds a seat in. Mirrors `src/lib/data/booking.ts`. */
const LIVE_BOOKING_STATUSES = ["pending", "approved"] as const;

// --- Registration expiry --------------------------------------------------

export type ExpiringDroneRow = {
  droneId: string;
  nickname: string;
  ownerUserId: string;
  ownerEmail: string;
  ownerLocale: "ar" | "en";
  /**
   * Nullable, even in the lists that filter it out: the column is, and the
   * query is not the place to lie about it. The two callers narrow it — one
   * because the row it re-read was selected on the column being set, the other
   * with an explicit guard.
   */
  registrationExpiresAt: Date | null;
  remoteIdCode: string | null;
};

/**
 * Approved drones whose registration has already lapsed.
 *
 * **The instant is compared, not the calendar date** — see
 * `isRegistrationExpired` in `rules.ts` for why a date comparison sweeps a live
 * registration eight hours early.
 */
export async function listExpiredDrones(
  now: Date,
  limit = 500,
): Promise<ExpiringDroneRow[]> {
  return baseDroneQuery()
    .where(
      and(
        eq(drone.status, "approved"),
        isNotNull(drone.registrationExpiresAt),
        lte(drone.registrationExpiresAt, now),
      ),
    )
    .limit(limit) as Promise<ExpiringDroneRow[]>;
}

/**
 * One drone, re-read at the moment it is about to be acted on.
 *
 * The sweep's list is a plan, not a fact: between collecting it and reaching
 * this row the registration may have been renewed or the drone revoked. Acting
 * on the snapshot is how a live registration gets expired.
 */
export async function getExpiredDrone(
  droneId: string,
  now: Date,
): Promise<ExpiringDroneRow | null> {
  const rows = (await baseDroneQuery().where(
    and(
      eq(drone.id, droneId),
      eq(drone.status, "approved"),
      isNotNull(drone.registrationExpiresAt),
      lte(drone.registrationExpiresAt, now),
    ),
  )) as ExpiringDroneRow[];
  return rows[0] ?? null;
}

/**
 * One approved drone that still has an expiry date, re-read before the reminder
 * job acts on it. How many days are left is `daysUntilRiyadhDay`'s decision, not
 * the query's — the arithmetic belongs in `rules.ts` where it can be tested.
 */
export async function getApprovedDroneWithExpiry(
  droneId: string,
): Promise<ExpiringDroneRow | null> {
  const rows = (await baseDroneQuery().where(
    and(
      eq(drone.id, droneId),
      eq(drone.status, "approved"),
      isNotNull(drone.registrationExpiresAt),
    ),
  )) as ExpiringDroneRow[];
  return rows[0] ?? null;
}

/**
 * Approved drones expiring within the widest reminder threshold. Which
 * threshold each one is actually due is `reminderThresholdFor`'s decision, on
 * the Riyadh civil day — this query only narrows the set.
 */
export async function listDronesExpiringWithin(
  now: Date,
  days: number,
  limit = 1000,
): Promise<ExpiringDroneRow[]> {
  const horizon = new Date(now.getTime() + days * 86_400_000);
  return baseDroneQuery()
    .where(
      and(
        eq(drone.status, "approved"),
        isNotNull(drone.registrationExpiresAt),
        gt(drone.registrationExpiresAt, now),
        lte(drone.registrationExpiresAt, horizon),
      ),
    )
    .limit(limit) as Promise<ExpiringDroneRow[]>;
}

function baseDroneQuery() {
  return db
    .select({
      droneId: drone.id,
      nickname: drone.nickname,
      ownerUserId: drone.ownerUserId,
      ownerEmail: user.email,
      ownerLocale: sql<"ar" | "en">`coalesce(${user.preferredLocale}, 'ar')`,
      /**
       * The **column**, not `sql<Date>\`…\``. Wrapped in a raw `sql` expression
       * drizzle has no column type to map, postgres.js hands back the timestamp
       * as a string, and the first thing that formats it throws "Invalid time
       * value" — inside `sendEmail`'s try, which swallows it and writes no
       * `email_log` row at all. Found exactly that way.
       */
      registrationExpiresAt: drone.registrationExpiresAt,
      remoteIdCode: remoteId.code,
    })
    .from(drone)
    .innerJoin(user, eq(user.id, drone.ownerUserId))
    .leftJoin(remoteId, eq(remoteId.droneId, drone.id))
    .$dynamic();
}

/**
 * Has this drone already been warned at this threshold?
 *
 * The marker is an audit event, not a column: it is already append-only, it
 * already carries who and when, and a `lastReminderSent` column would have to
 * be reset by hand the moment a registration is renewed.
 */
export async function hasReminderMarker(
  droneId: string,
  threshold: number,
  action: string,
): Promise<boolean> {
  const row = await db.query.auditEvent.findFirst({
    where: and(
      eq(auditEvent.entityType, "drone"),
      eq(auditEvent.entityId, droneId),
      eq(auditEvent.action, action),
      sql`${auditEvent.after}->>'threshold' = ${String(threshold)}`,
    ),
    columns: { id: true },
  });
  return Boolean(row);
}

// --- Booking closeout & reminders -----------------------------------------

export type BookingRow = {
  bookingId: string;
  pilotUserId: string;
  pilotEmail: string;
  pilotLocale: "ar" | "en";
  zoneNameAr: string;
  zoneNameEn: string;
  ceilingAglM: number | null;
  slotStart: Date;
  slotEnd: Date;
  checkedInAt: Date | null;
  remoteIdCode: string | null;
};

/** Approved bookings whose slot has ended. The verdict is `closeoutVerdict`'s. */
export async function listBookingsToCloseOut(
  now: Date,
  limit = 500,
): Promise<BookingRow[]> {
  return baseBookingQuery()
    .where(and(eq(booking.status, "approved"), lt(booking.slotEnd, now)))
    .limit(limit) as Promise<BookingRow[]>;
}

/**
 * One approved booking, re-read before it is closed out or reminded. A pilot
 * may have checked in, or a reviewer cancelled it, since the list was collected.
 */
export async function getApprovedBooking(
  bookingId: string,
): Promise<BookingRow | null> {
  const rows = (await baseBookingQuery().where(
    and(eq(booking.id, bookingId), eq(booking.status, "approved")),
  )) as BookingRow[];
  return rows[0] ?? null;
}

/**
 * One booking that still holds a seat — `pending` or `approved`. What the
 * closure fan-out cancels: an unreviewed request over a closed window is as
 * dead as an approved one.
 */
export async function getLiveBooking(
  bookingId: string,
): Promise<BookingRow | null> {
  const rows = (await baseBookingQuery().where(
    and(
      eq(booking.id, bookingId),
      inArray(booking.status, [...LIVE_BOOKING_STATUSES]),
    ),
  )) as BookingRow[];
  return rows[0] ?? null;
}

/** Approved bookings starting inside the reminder window. */
export async function listBookingsToRemind(
  from: Date,
  to: Date,
  limit = 500,
): Promise<BookingRow[]> {
  return baseBookingQuery()
    .where(
      and(
        eq(booking.status, "approved"),
        gte(booking.slotStart, from),
        lte(booking.slotStart, to),
      ),
    )
    .limit(limit) as Promise<BookingRow[]>;
}

/**
 * Live bookings overlapping a window in a zone. Half-open on both sides: a slot
 * that ends exactly when the closure starts does not overlap it, and treating it
 * as an overlap would cancel a flight that was already on the ground.
 */
export async function listBookingsOverlapping(
  zoneId: string,
  from: Date,
  to: Date,
  limit = 1000,
): Promise<BookingRow[]> {
  return baseBookingQuery()
    .where(
      and(
        eq(booking.zoneId, zoneId),
        inArray(booking.status, [...LIVE_BOOKING_STATUSES]),
        lt(booking.slotStart, to),
        gt(booking.slotEnd, from),
      ),
    )
    .limit(limit) as Promise<BookingRow[]>;
}

/**
 * Live bookings in one zone whose slot has not yet ended — what a **suspension**
 * cancels.
 *
 * Unbounded in time rather than windowed, unlike the closure query: a closure
 * has a start and an end, a suspension does not. Everything still ahead goes.
 */
export async function listFutureBookingsInZone(
  zoneId: string,
  now: Date,
  limit = 1000,
): Promise<BookingRow[]> {
  return baseBookingQuery()
    .where(
      and(
        eq(booking.zoneId, zoneId),
        inArray(booking.status, [...LIVE_BOOKING_STATUSES]),
        gt(booking.slotEnd, now),
      ),
    )
    .limit(limit) as Promise<BookingRow[]>;
}

/** Live bookings for one drone whose slot has not yet ended. */
export async function listFutureBookingsForDrone(
  droneId: string,
  now: Date,
  limit = 500,
): Promise<BookingRow[]> {
  return baseBookingQuery()
    .where(
      and(
        eq(booking.droneId, droneId),
        inArray(booking.status, [...LIVE_BOOKING_STATUSES]),
        gt(booking.slotEnd, now),
      ),
    )
    .limit(limit) as Promise<BookingRow[]>;
}

function baseBookingQuery() {
  return db
    .select({
      bookingId: booking.id,
      pilotUserId: booking.pilotUserId,
      pilotEmail: user.email,
      pilotLocale: sql<"ar" | "en">`coalesce(${user.preferredLocale}, 'ar')`,
      zoneNameAr: zone.nameAr,
      zoneNameEn: zone.nameEn,
      ceilingAglM: zone.ceilingAglM,
      slotStart: booking.slotStart,
      slotEnd: booking.slotEnd,
      checkedInAt: booking.checkedInAt,
      remoteIdCode: remoteId.code,
    })
    .from(booking)
    .innerJoin(user, eq(user.id, booking.pilotUserId))
    .innerJoin(zone, eq(zone.id, booking.zoneId))
    .leftJoin(remoteId, eq(remoteId.droneId, booking.droneId))
    .$dynamic();
}

/** Whether a booking already carries a marker for this action. */
export async function hasBookingMarker(
  bookingId: string,
  action: string,
): Promise<boolean> {
  const row = await db.query.auditEvent.findFirst({
    where: and(
      eq(auditEvent.entityType, "booking"),
      eq(auditEvent.entityId, bookingId),
      eq(auditEvent.action, action),
    ),
    columns: { id: true },
  });
  return Boolean(row);
}

// --- Closure --------------------------------------------------------------

export async function getPublishedClosure(closureId: string) {
  return db.query.zoneClosure.findFirst({
    where: and(
      eq(zoneClosure.id, closureId),
      isNotNull(zoneClosure.publishedAt),
    ),
  });
}

/**
 * The zone, only while it is **still suspended**. Re-read inside the fan-out
 * for the same reason the closure job re-reads its closure: if an admin lifted
 * the suspension between the event being sent and the step running, cancelling
 * flights under it would be an over-reach nothing asked for.
 */
export async function getSuspendedZone(zoneId: string) {
  return db.query.zone.findFirst({
    where: and(eq(zone.id, zoneId), eq(zone.status, "suspended")),
    columns: { id: true, nameAr: true, nameEn: true, status: true },
  });
}

export async function getDroneForRevocation(droneId: string) {
  return db.query.drone.findFirst({
    where: eq(drone.id, droneId),
    columns: { id: true, nickname: true, ownerUserId: true, status: true },
  });
}

export async function getApprovedDroneForQr(droneId: string) {
  return db
    .select({
      droneId: drone.id,
      nickname: drone.nickname,
      status: drone.status,
      ownerUserId: drone.ownerUserId,
      ownerEmail: user.email,
      ownerLocale: sql<"ar" | "en">`coalesce(${user.preferredLocale}, 'ar')`,
      registrationExpiresAt: drone.registrationExpiresAt,
      remoteIdId: remoteId.id,
      remoteIdCode: remoteId.code,
      qrPathname: remoteId.qrPathname,
    })
    .from(drone)
    .innerJoin(user, eq(user.id, drone.ownerUserId))
    .leftJoin(remoteId, eq(remoteId.droneId, drone.id))
    .where(eq(drone.id, droneId))
    .then((rows) => rows[0] ?? null);
}

/**
 * A rejected registration, with the owner it has to be explained to.
 *
 * `rejectionReason` comes back raw and is quoted to the pilot **verbatim** —
 * F06's criterion for this template, and the reason the column exists.
 */
export async function getRejectedDroneForEmail(droneId: string) {
  return db
    .select({
      droneId: drone.id,
      nickname: drone.nickname,
      status: drone.status,
      ownerUserId: drone.ownerUserId,
      ownerEmail: user.email,
      ownerLocale: sql<"ar" | "en">`coalesce(${user.preferredLocale}, 'ar')`,
      rejectionReason: drone.rejectionReason,
    })
    .from(drone)
    .innerJoin(user, eq(user.id, drone.ownerUserId))
    .where(eq(drone.id, droneId))
    .then((rows) => rows[0] ?? null);
}

/** An approved booking, with the pilot to confirm it to. */
export async function getApprovedBookingForEmail(bookingId: string) {
  return db
    .select({
      bookingId: booking.id,
      status: booking.status,
      pilotUserId: booking.pilotUserId,
      pilotEmail: user.email,
      pilotLocale: sql<"ar" | "en">`coalesce(${user.preferredLocale}, 'ar')`,
      zoneNameAr: zone.nameAr,
      zoneNameEn: zone.nameEn,
      ceilingAglM: zone.ceilingAglM,
      slotStart: booking.slotStart,
      slotEnd: booking.slotEnd,
    })
    .from(booking)
    .innerJoin(user, eq(user.id, booking.pilotUserId))
    .innerJoin(zone, eq(zone.id, booking.zoneId))
    .where(eq(booking.id, bookingId))
    .then((rows) => rows[0] ?? null);
}

/**
 * A refused booking, with the pilot it has to be explained to.
 *
 * Not `getLiveBooking`: that one filters to the statuses a live booking can
 * hold, and `rejected` is deliberately not among them.
 */
export async function getRejectedBookingForEmail(bookingId: string) {
  return db
    .select({
      bookingId: booking.id,
      status: booking.status,
      pilotUserId: booking.pilotUserId,
      pilotEmail: user.email,
      pilotLocale: sql<"ar" | "en">`coalesce(${user.preferredLocale}, 'ar')`,
      zoneNameAr: zone.nameAr,
      zoneNameEn: zone.nameEn,
      slotStart: booking.slotStart,
      slotEnd: booking.slotEnd,
      rejectionReason: booking.rejectionReason,
    })
    .from(booking)
    .innerJoin(user, eq(user.id, booking.pilotUserId))
    .innerJoin(zone, eq(zone.id, booking.zoneId))
    .where(eq(booking.id, bookingId))
    .then((rows) => rows[0] ?? null);
}

// --- Review queue digest --------------------------------------------------

export async function countPendingForReview(): Promise<{
  pendingDrones: number;
  pendingBookings: number;
}> {
  const [drones, bookings] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(drone)
      .where(eq(drone.status, "pending")),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(booking)
      .where(eq(booking.status, "pending")),
  ]);
  return {
    pendingDrones: drones[0]?.n ?? 0,
    pendingBookings: bookings[0]?.n ?? 0,
  };
}

export type ReviewerRow = {
  userId: string;
  email: string;
  locale: "ar" | "en";
};

/** Reviewers and admins. Both work the queue; only admins also assign roles. */
export async function listReviewers(): Promise<ReviewerRow[]> {
  return db
    .select({
      userId: user.id,
      email: user.email,
      locale: sql<"ar" | "en">`coalesce(${user.preferredLocale}, 'ar')`,
    })
    .from(user)
    .where(inArray(user.role, ["reviewer", "admin"]));
}

/**
 * When a digest was last actually **sent**, read off `email_log`.
 *
 * Not off the `job` table and not off an audit event. A run that finds an empty
 * queue sends nothing and must not suppress the run half an hour later that
 * finds three pending items — so the question is "was a digest sent", and
 * `email_log` is the row that only exists when one was. `skipped` counts: with
 * no provider key the message still went out, to the terminal.
 *
 * `audit_event` could not answer it anyway — its `entityType` has no `system`
 * member, and inventing one for a mail-send marker would put a non-entity in the
 * regulator's trail.
 */
export async function lastDigestSentAt(): Promise<Date | null> {
  const row = await db.query.emailLog.findFirst({
    where: and(
      eq(emailLog.template, "review-queue-digest"),
      inArray(emailLog.status, ["queued", "skipped", "sent"]),
    ),
    orderBy: (t, { desc }) => desc(t.createdAt),
    columns: { createdAt: true },
  });
  return row?.createdAt ?? null;
}
