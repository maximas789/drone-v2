import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  ne,
  or,
  type SQL,
} from "drizzle-orm";
import { evaluateAirspace } from "@/lib/airspace/evaluate";
import { buildContextForBooking } from "@/lib/airspace/query";
import { db } from "@/lib/db";
import { user } from "@/lib/db/auth-schema";
import {
  auditEvent,
  booking,
  city,
  drone,
  dronePhoto,
  droneReport,
  pilotProfile,
  remoteId,
  remoteIdDeclaration,
  zone,
} from "@/lib/db/schema";
import { SEAT_HOLDING_STATUSES } from "@/lib/data/booking";
import { NO_SHOW_WINDOW_DAYS } from "@/lib/data/pilot";
import { hashIdDocument } from "@/lib/id-hash";
import { normalizeCode } from "@/lib/remote-id/codec";
import {
  SAUDI_ID_LENGTH,
  normalizeIdNumber,
} from "@/lib/validation/saudi-id";
import { isReviewer, type Session } from "@/lib/session";

/**
 * The reviewer's reads — the ones that cross tables.
 *
 * Separate from `data/drone.ts` and `data/pilot.ts` deliberately. Those files
 * answer *"what may this pilot see of their own"*, and every function in them
 * is scoped by `session.user.id`. Everything here is scoped by **role**: a
 * reviewer sees any pilot's aircraft, which is a different question with a
 * different failure mode, and mixing the two in one file makes "is this query
 * scoped?" unanswerable by reading the file.
 *
 * Every function fails **closed** — a non-reviewer gets an empty list or
 * `null`, never a partial row and never a throw. Rule 8 still holds: no page
 * and no action touches `db` directly, and the session is the first argument.
 */

// --- The queue ------------------------------------------------------------

export type DroneQueueRow = {
  id: string;
  nickname: string;
  buildType: string;
  serialNumber: string | null;
  submittedAt: Date | null;
  rejectionCount: number;
  ownerUserId: string;
  pilotNameAr: string | null;
  pilotNameEn: string | null;
  pilotCityNameAr: string | null;
  pilotCityNameEn: string | null;
  pilotCityId: string | null;
  remoteIdCode: string | null;
  photoCount: number;
};

/**
 * Every pending registration, **oldest submission first**.
 *
 * A queue sorted newest-first buries the submissions that have been waiting
 * longest, which is the opposite of what a regulator needs — so the order is
 * not a preference the UI may override.
 *
 * `submittedAt` ascending with `createdAt` as the tie-break: the column is
 * nullable, and a row that somehow reached `pending` without one would
 * otherwise sort unpredictably against its neighbours.
 *
 * **Four queries, not four per row.** The pilot's name, their city, the
 * aircraft's Remote ID and its photo count are each one query over the whole
 * page. The alternative is N+1 round trips on the one screen whose entire job
 * is to be a list — the same reasoning as `listPhotoAndRemoteIdForDrones`.
 *
 * Filtering and free-text search happen in `src/lib/admin/queue.ts` against
 * these rows, not in SQL: the page is bounded by `limit`, and the matching
 * rules are the part worth unit-testing.
 */
export async function listDroneQueue(
  session: Session,
  limit = 100,
): Promise<DroneQueueRow[]> {
  if (!isReviewer(session)) return [];

  const drones = await db.query.drone.findMany({
    where: eq(drone.status, "pending"),
    orderBy: [asc(drone.submittedAt), asc(drone.createdAt)],
    limit,
  });
  if (drones.length === 0) return [];

  const droneIds = drones.map((row) => row.id);
  const ownerIds = [...new Set(drones.map((row) => row.ownerUserId))];

  const [profiles, codes, photoCounts] = await Promise.all([
    db
      .select({
        userId: pilotProfile.userId,
        fullNameAr: pilotProfile.fullNameAr,
        fullNameEn: pilotProfile.fullNameEn,
        cityId: city.id,
        cityNameAr: city.nameAr,
        cityNameEn: city.nameEn,
      })
      .from(pilotProfile)
      .leftJoin(city, eq(city.id, pilotProfile.addressCityId))
      .where(inArray(pilotProfile.userId, ownerIds)),
    db
      .select({ droneId: remoteId.droneId, code: remoteId.code })
      .from(remoteId)
      .where(inArray(remoteId.droneId, droneIds)),
    db
      .select({ droneId: dronePhoto.droneId, value: count() })
      .from(dronePhoto)
      .where(inArray(dronePhoto.droneId, droneIds))
      .groupBy(dronePhoto.droneId),
  ]);

  const byOwner = new Map(profiles.map((row) => [row.userId, row]));
  const byDroneCode = new Map(codes.map((row) => [row.droneId, row.code]));
  const byDroneCount = new Map(
    photoCounts.map((row) => [row.droneId, row.value]),
  );

  return drones.map((row) => {
    const profile = byOwner.get(row.ownerUserId);
    return {
      id: row.id,
      nickname: row.nickname,
      buildType: row.buildType,
      serialNumber: row.serialNumber,
      submittedAt: row.submittedAt,
      rejectionCount: row.rejectionCount,
      ownerUserId: row.ownerUserId,
      pilotNameAr: profile?.fullNameAr ?? null,
      pilotNameEn: profile?.fullNameEn ?? null,
      pilotCityNameAr: profile?.cityNameAr ?? null,
      pilotCityNameEn: profile?.cityNameEn ?? null,
      pilotCityId: profile?.cityId ?? null,
      remoteIdCode: byDroneCode.get(row.id) ?? null,
      photoCount: byDroneCount.get(row.id) ?? 0,
    };
  });
}

// --- One aircraft, everything a reviewer needs ----------------------------

/**
 * The review screen's single read.
 *
 * **Not `getDroneById` plus five more calls.** That reader answers for a pilot
 * *or* a reviewer, and the pilot branch is what `/drones/[id]` uses; this is
 * the staff surface and asks the staff question once, at the top. A drone in
 * any status is returned — a reviewer opening an already-decided submission
 * from a stale queue must see what happened to it, not a 404 that looks like
 * the row was deleted.
 *
 * The pilot's identity comes back **for masking at the point of use**: the raw
 * `idDocumentNumber` is on the profile row this returns, and `MaskedId` is what
 * renders it. The full value reaches a human only through
 * `revealPilotIdentityAction`, which writes the audit event before it answers.
 */
export async function getDroneForReview(session: Session, id: string) {
  if (!isReviewer(session)) return null;

  const row = await db.query.drone.findFirst({ where: eq(drone.id, id) });
  if (!row) return null;

  const [photos, rid, profileRows, account] = await Promise.all([
    db.query.dronePhoto.findMany({
      where: eq(dronePhoto.droneId, id),
      orderBy: [asc(dronePhoto.sortOrder)],
    }),
    db.query.remoteId.findFirst({ where: eq(remoteId.droneId, id) }),
    db
      .select({ profile: pilotProfile, city })
      .from(pilotProfile)
      .leftJoin(city, eq(city.id, pilotProfile.addressCityId))
      .where(eq(pilotProfile.userId, row.ownerUserId))
      .limit(1),
    db.query.user.findFirst({
      where: eq(user.id, row.ownerUserId),
      columns: { id: true, email: true, name: true, createdAt: true },
    }),
  ]);

  /**
   * Declarations hang off the Remote ID, which a first-time `pending` drone
   * does not have yet — Remote ID is issued at approval. A renewal or a
   * resubmission of an already-approved airframe does, and that is the case
   * where a reviewer has modules in front of them to verify.
   */
  const declarations = rid
    ? await db.query.remoteIdDeclaration.findMany({
        where: eq(remoteIdDeclaration.remoteIdId, rid.id),
        orderBy: [desc(remoteIdDeclaration.createdAt)],
      })
    : [];

  const trail = await listAuditForDrone(session, id, rid?.id ?? null);

  return {
    drone: row,
    photos,
    remoteId: rid ?? null,
    declarations,
    profile: profileRows[0]?.profile ?? null,
    city: profileRows[0]?.city ?? null,
    account: account ?? null,
    trail,
  };
}

/**
 * This aircraft's trail, **including its Remote ID's**.
 *
 * Issuance, suspension and every declaration decision are audited against the
 * `remote_id` entity, not the `drone` — so a trail filtered to the drone alone
 * would show a reviewer the approval and silently omit the Remote ID that
 * approval issued. Two entity ids, one chronological list.
 */
/**
 * Exported since F24: `/admin/lookup` shows the same trail beside a resolved
 * registration, and a lookup that read only the `drone` id would silently omit
 * the Remote ID's own history — the issue, the suspensions and every identity
 * reveal, which are exactly the rows a field officer is asking about.
 */
export async function listAuditForDrone(
  session: Session,
  droneId: string,
  remoteIdId: string | null,
) {
  if (!isReviewer(session)) return [];
  const ids = remoteIdId ? [droneId, remoteIdId] : [droneId];
  return db
    .select({
      id: auditEvent.id,
      action: auditEvent.action,
      entityType: auditEvent.entityType,
      reason: auditEvent.reason,
      actorRole: auditEvent.actorRole,
      actorIsSystem: auditEvent.actorIsSystem,
      actorUserId: auditEvent.actorUserId,
      createdAt: auditEvent.createdAt,
    })
    .from(auditEvent)
    .where(inArray(auditEvent.entityId, ids))
    .orderBy(desc(auditEvent.createdAt))
    .limit(100);
}

// --- Who the pilot is -----------------------------------------------------

export type PilotHistory = {
  dronesTotal: number;
  dronesApproved: number;
  bookingsTotal: number;
  /** No-shows inside `NO_SHOW_WINDOW_DAYS`, the same window auto-approve uses. */
  noShows: number;
  /** Prior rejections of *other* aircraft, newest first, with their reasons. */
  rejections: Array<{
    droneId: string;
    nickname: string;
    reason: string | null;
    decidedAt: Date | null;
  }>;
};

/**
 * The pilot behind the submission.
 *
 * A reviewer deciding one registration is deciding about a person, and "has
 * this person been refused before, and what for" is the question that changes
 * the decision. Prior rejections carry their **reasons** — a count alone would
 * make a pilot rejected twice for blurry photographs look like a pilot rejected
 * twice for misdeclaring a weight.
 *
 * **`excludeDroneId` is the aircraft on screen.** Its own rejection is shown in
 * its own panel already; repeating it here would make one refusal look like two.
 *
 * The no-show window is `NO_SHOW_WINDOW_DAYS`, imported rather than restated,
 * so this panel and `autoApproveEligible` can never disagree about how long a
 * no-show counts for. Counted over the rolling window rather than stored, for
 * the reason `countRecentNoShows` gives: a stored flag needs a job to clear it,
 * and a job that failed would leave somebody penalised for ever.
 */
export async function getPilotHistory(
  session: Session,
  userId: string,
  excludeDroneId?: string,
  now: Date = new Date(),
): Promise<PilotHistory | null> {
  if (!isReviewer(session)) return null;

  const since = new Date(
    now.getTime() - NO_SHOW_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const rejectionWhere = excludeDroneId
    ? and(
        eq(drone.ownerUserId, userId),
        eq(drone.status, "rejected"),
        ne(drone.id, excludeDroneId),
      )
    : and(eq(drone.ownerUserId, userId), eq(drone.status, "rejected"));

  const [dronesTotal, dronesApproved, bookingsTotal, noShows, rejections] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(drone)
        .where(eq(drone.ownerUserId, userId)),
      db
        .select({ value: count() })
        .from(drone)
        .where(and(eq(drone.ownerUserId, userId), eq(drone.status, "approved"))),
      db
        .select({ value: count() })
        .from(booking)
        .where(eq(booking.pilotUserId, userId)),
      db
        .select({ value: count() })
        .from(booking)
        .where(
          and(
            eq(booking.pilotUserId, userId),
            eq(booking.status, "no_show"),
            gte(booking.slotStart, since),
          ),
        ),
      db
        .select({
          droneId: drone.id,
          nickname: drone.nickname,
          reason: drone.rejectionReason,
          decidedAt: drone.decidedAt,
        })
        .from(drone)
        .where(rejectionWhere)
        .orderBy(desc(drone.decidedAt))
        .limit(10),
    ]);

  return {
    dronesTotal: dronesTotal[0]?.value ?? 0,
    dronesApproved: dronesApproved[0]?.value ?? 0,
    bookingsTotal: bookingsTotal[0]?.value ?? 0,
    noShows: noShows[0]?.value ?? 0,
    rejections,
  };
}

// --- The pilot's identity, revealed --------------------------------------

/**
 * The profile behind a user id, for the reveal action.
 *
 * Reviewers only, and it returns the row **including** the raw document number
 * — the only caller is `revealPilotIdentityAction`, which has already written
 * the audit event by the time it reads this. Nothing renders the result of this
 * function directly.
 */
export async function getProfileForReveal(session: Session, userId: string) {
  if (!isReviewer(session)) return null;
  return db.query.pilotProfile.findFirst({
    where: eq(pilotProfile.userId, userId),
  });
}

// --- The bookings tab -----------------------------------------------------

export type BookingQueueRow = {
  id: string;
  pilotUserId: string;
  slotStart: Date;
  slotEnd: Date;
  createdAt: Date;
  zoneId: string;
  zoneNameAr: string;
  zoneNameEn: string;
  droneId: string;
  droneNickname: string | null;
  remoteIdCode: string | null;
  pilotNameAr: string | null;
  pilotNameEn: string | null;
};

/**
 * Every pending booking, **soonest slot first**.
 *
 * The drone queue is ordered by how long a submission has *waited*; this one is
 * ordered by how soon the flight is. A request made three weeks ago for a slot
 * next month is not the row a reviewer should meet above one made this morning
 * for a slot this afternoon — and a booking queue sorted by age would put it
 * there. Ordering is `slotStart` ascending with `createdAt` as the tie-break,
 * so two requests for the same slot still come out oldest-first between
 * themselves.
 *
 * **A slot already in the past is still in the list.** Nothing sweeps an
 * undecided request when its window closes, and hiding those rows would hide
 * the queue's own failure to answer in time. `urgencyBucketOf` gives them their
 * own bucket and the badge says so.
 *
 * Four queries for the page, not four per row — `listDroneQueue`'s reasoning,
 * and the same shape.
 */
export async function listBookingQueue(
  session: Session,
  limit = 100,
): Promise<BookingQueueRow[]> {
  if (!isReviewer(session)) return [];

  const rows = await db.query.booking.findMany({
    where: eq(booking.status, "pending"),
    orderBy: [asc(booking.slotStart), asc(booking.createdAt)],
    limit,
  });
  if (rows.length === 0) return [];

  const zoneIds = [...new Set(rows.map((row) => row.zoneId))];
  const droneIds = [...new Set(rows.map((row) => row.droneId))];
  const remoteIdIds = [...new Set(rows.map((row) => row.remoteIdId))];
  const pilotIds = [...new Set(rows.map((row) => row.pilotUserId))];

  const [zones, drones, codes, profiles] = await Promise.all([
    db.query.zone.findMany({
      where: inArray(zone.id, zoneIds),
      columns: { id: true, nameAr: true, nameEn: true },
    }),
    db.query.drone.findMany({
      where: inArray(drone.id, droneIds),
      columns: { id: true, nickname: true },
    }),
    db.query.remoteId.findMany({
      where: inArray(remoteId.id, remoteIdIds),
      columns: { id: true, code: true },
    }),
    db
      .select({
        userId: pilotProfile.userId,
        fullNameAr: pilotProfile.fullNameAr,
        fullNameEn: pilotProfile.fullNameEn,
      })
      .from(pilotProfile)
      .where(inArray(pilotProfile.userId, pilotIds)),
  ]);

  const zoneById = new Map(zones.map((row) => [row.id, row]));
  const droneById = new Map(drones.map((row) => [row.id, row]));
  const codeById = new Map(codes.map((row) => [row.id, row.code]));
  const profileByUser = new Map(profiles.map((row) => [row.userId, row]));

  return rows.map((row) => {
    const zoneRow = zoneById.get(row.zoneId);
    const profile = profileByUser.get(row.pilotUserId);
    return {
      id: row.id,
      pilotUserId: row.pilotUserId,
      slotStart: row.slotStart,
      slotEnd: row.slotEnd,
      createdAt: row.createdAt,
      zoneId: row.zoneId,
      zoneNameAr: zoneRow?.nameAr ?? "",
      zoneNameEn: zoneRow?.nameEn ?? "",
      droneId: row.droneId,
      droneNickname: droneById.get(row.droneId)?.nickname ?? null,
      remoteIdCode: codeById.get(row.remoteIdId) ?? null,
      pilotNameAr: profile?.fullNameAr ?? null,
      pilotNameEn: profile?.fullNameEn ?? null,
    };
  });
}

/**
 * The two tab counts.
 *
 * **Counted in SQL, not by taking `.length` of a queue page.** Both lists are
 * bounded by a `limit`, so a hundred-and-first pending row would leave the tab
 * saying 100 — a number a regulator would read as the truth. One query each.
 */
export async function countPendingReviews(
  session: Session,
): Promise<{ drones: number; bookings: number }> {
  if (!isReviewer(session)) return { drones: 0, bookings: 0 };

  const [drones, bookings] = await Promise.all([
    db.select({ value: count() }).from(drone).where(eq(drone.status, "pending")),
    db
      .select({ value: count() })
      .from(booking)
      .where(eq(booking.status, "pending")),
  ]);

  return {
    drones: drones[0]?.value ?? 0,
    bookings: bookings[0]?.value ?? 0,
  };
}

// --- One booking, everything a reviewer needs -----------------------------

/**
 * Who else holds a seat in the same slot, in the same zone.
 *
 * A reviewer approving a flight is putting an aircraft into airspace that
 * already has others in it, and "who else will be there" is not answerable from
 * the booking row. Cancelled and rejected rows are excluded — they hold no seat
 * — and so is the booking being reviewed, which is on the screen already.
 *
 * The other pilots' **names are deliberately not here**. This is a reviewer
 * asking about occupancy, not about people: the Remote ID and the seat are what
 * an air picture is made of, and an identity on the screen that nothing needed
 * is an identity that should not have been read.
 */
export async function listSlotOccupancy(
  session: Session,
  args: { zoneId: string; slotStart: Date; excludeBookingId: string },
) {
  if (!isReviewer(session)) return [];

  const rows = await db
    .select({
      id: booking.id,
      seatIndex: booking.seatIndex,
      status: booking.status,
      remoteIdId: booking.remoteIdId,
    })
    .from(booking)
    .where(
      and(
        eq(booking.zoneId, args.zoneId),
        eq(booking.slotStart, args.slotStart),
        inArray(booking.status, [...SEAT_HOLDING_STATUSES]),
        ne(booking.id, args.excludeBookingId),
      ),
    )
    .orderBy(asc(booking.seatIndex));
  if (rows.length === 0) return [];

  const codes = await db.query.remoteId.findMany({
    where: inArray(
      remoteId.id,
      rows.map((row) => row.remoteIdId),
    ),
    columns: { id: true, code: true },
  });
  const codeById = new Map(codes.map((row) => [row.id, row.code]));

  return rows.map((row) => ({
    id: row.id,
    seatIndex: row.seatIndex,
    status: row.status,
    remoteIdCode: codeById.get(row.remoteIdId) ?? null,
  }));
}

/**
 * The booking review screen's read — **including the airspace decision, re-run
 * now.**
 *
 * The re-run is the point of the screen. `booking.decisionSnapshot` records
 * what was true when the pilot asked; a closure published since, or a
 * registration that has lapsed since, changes the answer, and a reviewer
 * reading the stored snapshot would be approving against facts that have
 * expired. So the same `buildContextForBooking` + `evaluateAirspace` pair that
 * `approveBooking` runs *inside its transaction* runs here for display, over
 * `db` rather than a `tx`.
 *
 * **This is a preview, never the authority.** Nothing decides on the strength
 * of what it returns: `approveBooking` re-runs the pair against the locked row
 * and refuses on its own answer. Two evaluations a few seconds apart can
 * disagree — that is exactly the case the transactional one exists for, and the
 * reviewer is then shown the refusal rather than the stale green tick this
 * screen drew.
 *
 * `now` is passed in so the page's clock and the decision's clock are one
 * instant, for `AgeBadge`'s reason.
 */
export async function getBookingForReview(
  session: Session,
  id: string,
  now: Date = new Date(),
) {
  if (!isReviewer(session)) return null;

  const { booking: row, zone: rule, context } = await buildContextForBooking(
    db,
    id,
  );
  if (!row) return null;

  const [full] = await db
    .select()
    .from(booking)
    .where(eq(booking.id, id))
    .limit(1);
  if (!full) return null;

  const [zoneRow, droneRow, ridRow, profileRows, account, occupancy, trail] =
    await Promise.all([
      db.query.zone.findFirst({ where: eq(zone.id, full.zoneId) }),
      db.query.drone.findFirst({ where: eq(drone.id, full.droneId) }),
      db.query.remoteId.findFirst({ where: eq(remoteId.id, full.remoteIdId) }),
      db
        .select({ profile: pilotProfile, city })
        .from(pilotProfile)
        .leftJoin(city, eq(city.id, pilotProfile.addressCityId))
        .where(eq(pilotProfile.userId, full.pilotUserId))
        .limit(1),
      db.query.user.findFirst({
        where: eq(user.id, full.pilotUserId),
        columns: { id: true, email: true, name: true, createdAt: true },
      }),
      listSlotOccupancy(session, {
        zoneId: full.zoneId,
        slotStart: full.slotStart,
        excludeBookingId: id,
      }),
      listAuditForBooking(session, id),
    ]);

  /**
   * No zone rule means there is no evaluation to show — the row references a
   * zone `buildContextForBooking` could not build a rule from. The page says so
   * rather than rendering an `allowed` produced from an empty context, which
   * would be the one lie this screen must never tell.
   */
  const decision = rule
    ? evaluateAirspace(
        {
          zoneId: rule.id,
          slotStart: full.slotStart.toISOString(),
          slotEnd: full.slotEnd.toISOString(),
          now: now.toISOString(),
        },
        context,
      )
    : null;

  return {
    booking: full,
    zone: zoneRow ?? null,
    drone: droneRow ?? null,
    remoteId: ridRow ?? null,
    profile: profileRows[0]?.profile ?? null,
    city: profileRows[0]?.city ?? null,
    account: account ?? null,
    occupancy,
    trail,
    decision,
  };
}

/**
 * This booking's trail. One entity id, unlike the drone's two — nothing hangs
 * off a booking that is audited under its own entity.
 */
async function listAuditForBooking(session: Session, bookingId: string) {
  if (!isReviewer(session)) return [];
  return db
    .select({
      id: auditEvent.id,
      action: auditEvent.action,
      entityType: auditEvent.entityType,
      reason: auditEvent.reason,
      actorRole: auditEvent.actorRole,
      actorIsSystem: auditEvent.actorIsSystem,
      actorUserId: auditEvent.actorUserId,
      createdAt: auditEvent.createdAt,
    })
    .from(auditEvent)
    .where(eq(auditEvent.entityId, bookingId))
    .orderBy(desc(auditEvent.createdAt))
    .limit(100);
}

// --- The pilots directory -------------------------------------------------

export type PilotRow = {
  userId: string;
  profileId: string;
  fullNameAr: string;
  fullNameEn: string;
  mobileE164: string | null;
  cityNameAr: string | null;
  cityNameEn: string | null;
  verifiedAt: Date | null;
  rejectedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

/** How a search term was understood. Shown back, so nobody guesses. */
export type PilotSearchKind = "recent" | "document" | "remote_id" | "text";

export type PilotSearchResult = {
  kind: PilotSearchKind;
  rows: PilotRow[];
};

/**
 * The pilots directory — **four different questions behind one box.**
 *
 * A reviewer holding a document number, a Remote ID off a QR sticker, or half a
 * name is asking three different questions, and making them pick a mode first
 * is making them classify their own evidence. The term is classified here
 * instead, and the *kind* comes back with the rows so the screen can say how it
 * was read — a search that silently fell through to a name match on a mistyped
 * ID would otherwise look like "this person does not exist".
 *
 * **A document number is matched on its hash, never on its digits.** The column
 * is `sha256(ID_HASH_PEPPER + number)` with a unique index; hashing the term
 * and comparing gives an exact match without an `ilike` over identity documents
 * — which would be a substring search across a national register, and is the
 * one query this file must never be able to run. It also means the *partial*
 * document search does not exist, and cannot be added by accident.
 *
 * Text search covers **both** name columns and the mobile number. Arabic names
 * are matched with `ilike` on the raw column: Postgres lower-cases per the
 * database collation and Arabic has no case, so this is a substring match, and
 * that is what a reviewer typing three letters of a family name wants.
 */
export async function searchPilots(
  session: Session,
  term: string,
  limit = 50,
): Promise<PilotSearchResult> {
  if (!isReviewer(session)) return { kind: "recent", rows: [] };

  const query = term.trim();

  if (query === "") {
    return { kind: "recent", rows: await pilotRowsWhere(undefined, limit) };
  }

  // A whole document number, and only a whole one — see the note above.
  const normalisedId = normalizeIdNumber(query);
  if (normalisedId.length === SAUDI_ID_LENGTH) {
    return {
      kind: "document",
      rows: await pilotRowsWhere(
        eq(pilotProfile.idDocumentHash, hashIdDocument(normalisedId)),
        limit,
      ),
    };
  }

  // A Remote ID resolves through the aircraft to whoever owns it.
  const code = normalizeCode(query);
  if (code) {
    const owners = await db
      .select({ ownerUserId: drone.ownerUserId })
      .from(remoteId)
      .innerJoin(drone, eq(drone.id, remoteId.droneId))
      .where(eq(remoteId.code, code))
      .limit(limit);
    if (owners.length === 0) return { kind: "remote_id", rows: [] };
    return {
      kind: "remote_id",
      rows: await pilotRowsWhere(
        inArray(
          pilotProfile.userId,
          owners.map((row) => row.ownerUserId),
        ),
        limit,
      ),
    };
  }

  const like = `%${query}%`;
  return {
    kind: "text",
    rows: await pilotRowsWhere(
      or(
        ilike(pilotProfile.fullNameAr, like),
        ilike(pilotProfile.fullNameEn, like),
        ilike(pilotProfile.mobileE164, like),
      ),
      limit,
    ),
  };
}

/** One projection, four callers — so every route into the list returns the same columns. */
async function pilotRowsWhere(
  where: SQL | undefined,
  limit: number,
): Promise<PilotRow[]> {
  const rows = await db
    .select({
      userId: pilotProfile.userId,
      profileId: pilotProfile.id,
      fullNameAr: pilotProfile.fullNameAr,
      fullNameEn: pilotProfile.fullNameEn,
      mobileE164: pilotProfile.mobileE164,
      cityNameAr: city.nameAr,
      cityNameEn: city.nameEn,
      verifiedAt: pilotProfile.verifiedAt,
      rejectedAt: pilotProfile.rejectedAt,
      completedAt: pilotProfile.completedAt,
      createdAt: pilotProfile.createdAt,
    })
    .from(pilotProfile)
    .leftJoin(city, eq(city.id, pilotProfile.addressCityId))
    .where(where)
    /**
     * **Unverified first, then oldest.** The directory is a directory, but the
     * work in it is the identities nobody has checked yet — sorting by name
     * would bury a pilot who has been waiting a fortnight behind everyone whose
     * name begins with alif.
     */
    .orderBy(asc(pilotProfile.verifiedAt), asc(pilotProfile.createdAt))
    .limit(limit);

  return rows;
}

/**
 * One pilot, everything a reviewer needs to decide about **the person** rather
 * than about one of their submissions.
 *
 * The raw `idDocumentNumber` comes back on the profile row, as it does from
 * `getDroneForReview`, and `MaskedId` is what renders it — the whole number
 * reaches a human only through `revealPilotIdentityAction`, which writes its
 * audit event before it answers.
 *
 * The trail is keyed on the **profile id**, which is what `identity.ts` and the
 * reveal both audit against.
 */
export async function getPilotForReview(
  session: Session,
  userId: string,
  now: Date = new Date(),
) {
  if (!isReviewer(session)) return null;

  const profileRows = await db
    .select({ profile: pilotProfile, city })
    .from(pilotProfile)
    .leftJoin(city, eq(city.id, pilotProfile.addressCityId))
    .where(eq(pilotProfile.userId, userId))
    .limit(1);
  const profile = profileRows[0]?.profile ?? null;
  if (!profile) return null;

  const [account, drones, bookings, history, trail] = await Promise.all([
    db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { id: true, email: true, name: true, createdAt: true },
    }),
    db.query.drone.findMany({
      where: eq(drone.ownerUserId, userId),
      orderBy: [desc(drone.createdAt)],
      limit: 50,
    }),
    db.query.booking.findMany({
      where: eq(booking.pilotUserId, userId),
      orderBy: [desc(booking.slotStart)],
      limit: 20,
    }),
    getPilotHistory(session, userId, undefined, now),
    db
      .select({
        id: auditEvent.id,
        action: auditEvent.action,
        entityType: auditEvent.entityType,
        reason: auditEvent.reason,
        actorRole: auditEvent.actorRole,
        actorIsSystem: auditEvent.actorIsSystem,
        actorUserId: auditEvent.actorUserId,
        createdAt: auditEvent.createdAt,
      })
      .from(auditEvent)
      .where(eq(auditEvent.entityId, profile.id))
      .orderBy(desc(auditEvent.createdAt))
      .limit(100),
  ]);

  const codes = drones.length
    ? await db
        .select({ droneId: remoteId.droneId, code: remoteId.code })
        .from(remoteId)
        .where(
          inArray(
            remoteId.droneId,
            drones.map((row) => row.id),
          ),
        )
    : [];
  const codeByDrone = new Map(codes.map((row) => [row.droneId, row.code]));

  const zones = bookings.length
    ? await db.query.zone.findMany({
        where: inArray(
          zone.id,
          bookings.map((row) => row.zoneId),
        ),
        columns: { id: true, nameAr: true, nameEn: true },
      })
    : [];
  const zoneById = new Map(zones.map((row) => [row.id, row]));

  return {
    profile,
    city: profileRows[0]?.city ?? null,
    account: account ?? null,
    drones: drones.map((row) => ({
      id: row.id,
      nickname: row.nickname,
      status: row.status,
      buildType: row.buildType,
      registrationExpiresAt: row.registrationExpiresAt,
      remoteIdCode: codeByDrone.get(row.id) ?? null,
    })),
    bookings: bookings.map((row) => ({
      id: row.id,
      status: row.status,
      slotStart: row.slotStart,
      slotEnd: row.slotEnd,
      zoneNameAr: zoneById.get(row.zoneId)?.nameAr ?? "",
      zoneNameEn: zoneById.get(row.zoneId)?.nameEn ?? "",
    })),
    history,
    trail,
  };
}

// --- Filed reports --------------------------------------------------------

/**
 * The report queue — **open first, oldest first inside that** (thread 35).
 *
 * The same ordering principle as the drone queue: a report filed a fortnight
 * ago that nobody has closed is the one a reviewer should meet first. Handled
 * reports stay in the list below the open ones rather than disappearing,
 * because "what did we do about that sighting" is a question asked after the
 * fact, and a queue that empties itself answers it with silence.
 */
export async function listReports(session: Session, limit = 50) {
  if (!isReviewer(session)) return [];

  const rows = await db
    .select({
      id: droneReport.id,
      reportedCode: droneReport.reportedCode,
      description: droneReport.description,
      locationNote: droneReport.locationNote,
      status: droneReport.status,
      handledAt: droneReport.handledAt,
      handledByUserId: droneReport.handledByUserId,
      handlingNote: droneReport.handlingNote,
      createdAt: droneReport.createdAt,
      remoteIdId: droneReport.remoteIdId,
      remoteIdCode: remoteId.code,
      droneId: remoteId.droneId,
    })
    .from(droneReport)
    .leftJoin(remoteId, eq(remoteId.id, droneReport.remoteIdId))
    // `open` sorts before `actioned` and `dismissed` by the enum's own order,
    // which is the order they are declared in — the queue's shape is the
    // enum's shape, not a `case` expression that could drift from it.
    .orderBy(asc(droneReport.status), asc(droneReport.createdAt))
    .limit(limit);

  return rows;
}
