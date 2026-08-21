import "server-only";

import { and, count, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  auditEvent,
  booking,
  drone,
  remoteIdScan,
  zone,
} from "@/lib/db/schema";
import { isReviewer, type Session } from "@/lib/session";
import { bucketKeys, densify } from "./buckets";
import {
  BUILD_TYPES,
  RESOLVERS,
  type BuildType,
  type Resolver,
} from "./palette";
import { bucketFor, rangeStart, type Bucket, type RangeKey } from "./range";

/**
 * Every number on `/admin/analytics`, and the only place they come from.
 *
 * **Nothing here is precomputed, cached across requests, or mocked.** Each
 * function is an aggregate query with a date predicate, against the indexes
 * F03 declared. A dashboard that is allowed to be a little stale is a dashboard
 * nobody can act on, and a dashboard with a fixture in it is worse than none at
 * all on a screen whose whole claim is "this is what is actually happening".
 *
 * **Ownership, rule 8.** Every export takes the session first and refuses a
 * non-reviewer by returning the *empty* shape rather than throwing. The page's
 * `requireReviewer()` is the guard; this is the second lock, and it yields an
 * empty chart rather than a stack trace if a caller is ever added that forgets
 * the first one.
 */

// --- Time bucketing in SQL ------------------------------------------------

/**
 * The `YYYY-MM-DD` key of the Riyadh civil bucket a timestamp falls in —
 * **string-identical to what `bucketKey()` produces in TypeScript**, which is
 * what lets the dense key list join the sparse counts.
 *
 * `AT TIME ZONE 'Asia/Riyadh'` first, always: truncating a `timestamptz` to a
 * month in UTC files everything between midnight and 03:00 on the first of the
 * month under the *previous* month.
 *
 * **The week case is not a plain `date_trunc('week', ...)`.** Postgres weeks
 * are ISO and start on **Monday**; this project's start on **Sunday**. Shifting
 * a day forward, truncating, and shifting a day back moves the boundary without
 * needing a different function. Getting it wrong moves every Sunday's rows into
 * the previous column, which looks like data rather than like a bug.
 */
function bucketExpr(column: unknown, bucket: Bucket) {
  const local = sql`(${column} AT TIME ZONE 'Asia/Riyadh')`;
  if (bucket === "day") return sql<string>`to_char(${local}, 'YYYY-MM-DD')`;
  if (bucket === "month") {
    return sql<string>`to_char(date_trunc('month', ${local}), 'YYYY-MM-DD')`;
  }
  return sql<string>`to_char(date_trunc('week', ${local} + interval '1 day') - interval '1 day', 'YYYY-MM-DD')`;
}

/**
 * The resolved window a chart draws: where it starts, where it ends, and at
 * what grain.
 */
export type Window = {
  readonly key: RangeKey;
  readonly since: Date | null;
  readonly bucket: Bucket;
  readonly now: Date;
};

export function windowFor(key: RangeKey, now: Date = new Date()): Window {
  return { key, since: rangeStart(key, now), bucket: bucketFor(key), now };
}

/**
 * The dense key list for a window. For a fixed range the left edge is the
 * range; for "all" it is the earliest key the data itself has, so the axis
 * starts where the platform's history starts rather than at an arbitrary date.
 */
function keysFor(window: Window, earliest: string | null): readonly string[] {
  const from =
    window.since ??
    (earliest === null
      ? window.now
      : new Date(`${earliest}T00:00:00.000+03:00`));
  return bucketKeys(from, window.now, window.bucket);
}

// --- Header tiles ---------------------------------------------------------

export type Tiles = {
  readonly pendingDrones: number;
  readonly pendingBookings: number;
  /** Null when nothing has been decided in the window — not zero. */
  readonly medianTurnaroundHours: number | null;
  readonly turnaroundSampleSize: number;
  readonly activeRegistrations: number;
  readonly expiringWithin30Days: number;
  readonly authorisedToday: number;
};

const EMPTY_TILES: Tiles = {
  pendingDrones: 0,
  pendingBookings: 0,
  medianTurnaroundHours: null,
  turnaroundSampleSize: 0,
  activeRegistrations: 0,
  expiringWithin30Days: 0,
  authorisedToday: 0,
};

/** The 30-day window the median turnaround tile is fixed to. */
export const TURNAROUND_WINDOW_DAYS = 30;

/**
 * The six tiles. **They do not follow the date range, deliberately.**
 *
 * Five of them are *current state* — what is waiting, what is valid, what
 * expires soon — and a current state has no date range: "pending registrations
 * in the last 7 days" is a different and much less useful number than "pending
 * registrations". The sixth, median turnaround, is fixed at 30 days because F25
 * specifies it that way and because a median over 7 days at this platform's
 * volume would be one or two decisions wearing the authority of an average. The
 * page says both of these out loud, next to the range control, so a reader who
 * switches the range and sees the tiles hold still knows it was meant.
 */
export async function getTiles(
  session: Session,
  now = new Date(),
): Promise<Tiles> {
  if (!isReviewer(session)) return EMPTY_TILES;

  const in30Days = new Date(now.getTime() + 30 * 86_400_000);
  const thirtyDaysAgo = new Date(
    now.getTime() - TURNAROUND_WINDOW_DAYS * 86_400_000,
  );

  const [
    pendingDrones,
    pendingBookings,
    turnaround,
    activeRegistrations,
    expiring,
    authorisedToday,
  ] = await Promise.all([
    db.select({ n: count() }).from(drone).where(eq(drone.status, "pending")),

    db
      .select({ n: count() })
      .from(booking)
      .where(eq(booking.status, "pending")),

    /**
     * **`decided_at >= submitted_at` is not belt and braces — it is the whole
     * correctness of this number.** `submitted_at` is rewritten when a pilot
     * resubmits a rejected registration, while `decided_at` still holds the
     * *previous* decision, so a resubmitted aircraft carries a negative
     * interval. This database has one right now, at −0.6 hours. Without the
     * predicate it drags the median down and puts a bar to the left of zero on
     * the histogram, and nothing about either would look wrong.
     */
    db
      .select({
        median: sql<
          string | null
        >`percentile_cont(0.5) within group (order by extract(epoch from (${drone.decidedAt} - ${drone.submittedAt})))`,
        n: count(),
      })
      .from(drone)
      .where(
        and(
          isNotNull(drone.submittedAt),
          isNotNull(drone.decidedAt),
          sql`${drone.decidedAt} >= ${drone.submittedAt}`,
          gte(drone.decidedAt, thirtyDaysAgo),
        ),
      ),

    db
      .select({ n: count() })
      .from(drone)
      .where(
        and(
          eq(drone.status, "approved"),
          sql`(${drone.registrationExpiresAt} is null or ${drone.registrationExpiresAt} > now())`,
        ),
      ),

    db
      .select({ n: count() })
      .from(drone)
      .where(
        and(
          eq(drone.status, "approved"),
          isNotNull(drone.registrationExpiresAt),
          gte(drone.registrationExpiresAt, now),
          lte(drone.registrationExpiresAt, in30Days),
        ),
      ),

    /**
     * "Authorised today" counts `completed` alongside `approved`: a flight that
     * has already happened was still authorised today, and dropping it would
     * make the tile fall through the afternoon.
     */
    db
      .select({ n: count() })
      .from(booking)
      .where(
        and(
          sql`${booking.status} in ('approved', 'completed')`,
          sql`(${booking.slotStart} AT TIME ZONE 'Asia/Riyadh')::date = (now() AT TIME ZONE 'Asia/Riyadh')::date`,
        ),
      ),
  ]);

  const medianSeconds = turnaround[0]?.median;

  return {
    pendingDrones: pendingDrones[0]?.n ?? 0,
    pendingBookings: pendingBookings[0]?.n ?? 0,
    /**
     * `percentile_cont` comes back from postgres.js as a **string**, and as
     * `null` when the filtered set is empty. A null median is "nothing was
     * decided", not "decided instantly", so it stays null all the way to the
     * tile, which renders a dash.
     */
    medianTurnaroundHours:
      medianSeconds === null || medianSeconds === undefined
        ? null
        : Number(medianSeconds) / 3600,
    turnaroundSampleSize: turnaround[0]?.n ?? 0,
    activeRegistrations: activeRegistrations[0]?.n ?? 0,
    expiringWithin30Days: expiring[0]?.n ?? 0,
    authorisedToday: authorisedToday[0]?.n ?? 0,
  };
}

// --- 1 · Registrations over time, by build type ---------------------------

export type BuildTypeRow = {
  readonly key: string;
  readonly value: Readonly<Record<BuildType, number>>;
};

function emptyBuildTypes(): Record<BuildType, number> {
  return { commercial: 0, self_built: 0, fpv: 0 };
}

/**
 * **The headline.** Registrations actually issued, split by build type, so the
 * self-built and FPV share is visible as a share rather than asserted in prose.
 *
 * Keyed on `registration_issued_at`, not `created_at` or `submitted_at`. A
 * registration exists when it is *issued*; a draft nobody submitted is not a
 * registration, and counting submissions would let a rejected application
 * inflate the number this product is making its case with.
 */
export async function getRegistrationsByBuildType(
  session: Session,
  window: Window,
): Promise<readonly BuildTypeRow[]> {
  if (!isReviewer(session)) return [];

  const bucket = bucketExpr(drone.registrationIssuedAt, window.bucket);
  const rows = await db
    .select({ key: bucket, buildType: drone.buildType, n: count() })
    .from(drone)
    .where(
      and(
        isNotNull(drone.registrationIssuedAt),
        window.since ? gte(drone.registrationIssuedAt, window.since) : undefined,
      ),
    )
    .groupBy(bucket, drone.buildType)
    .orderBy(bucket);

  const byKey = new Map<string, Record<BuildType, number>>();
  for (const row of rows) {
    const entry = byKey.get(row.key) ?? emptyBuildTypes();
    entry[row.buildType as BuildType] = row.n;
    byKey.set(row.key, entry);
  }

  return densify(
    keysFor(window, rows[0]?.key ?? null),
    [...byKey].map(([key, value]) => ({ key, value })),
    emptyBuildTypes,
  );
}

/** The share the pitch turns on, over the whole window. */
export function serialLessShare(rows: readonly BuildTypeRow[]): {
  serialLess: number;
  total: number;
} {
  let serialLess = 0;
  let total = 0;
  for (const row of rows) {
    for (const type of BUILD_TYPES) {
      total += row.value[type];
      if (type !== "commercial") serialLess += row.value[type];
    }
  }
  return { serialLess, total };
}

// --- 2 · Approval outcomes ------------------------------------------------

export type OutcomeRow = {
  readonly key: string;
  readonly value: { readonly approved: number; readonly rejected: number };
};

function emptyOutcomes() {
  return { approved: 0, rejected: 0 };
}

/**
 * Approved against rejected, per bucket — **read off the audit trail, not off
 * `drone.status`.**
 *
 * A drone approved in March and revoked in August has `status = 'revoked'`
 * today; counting current status would erase March's approval and file it as
 * something that never happened. `audit_event` records the decision *as it was
 * made*, which is exactly what an outcomes chart is asking about, and it is
 * also the table a regulator would audit. It is the same argument `actorRole`
 * makes on the audit browser: the record is of the moment, not of now.
 */
export async function getApprovalOutcomes(
  session: Session,
  window: Window,
): Promise<readonly OutcomeRow[]> {
  if (!isReviewer(session)) return [];

  const bucket = bucketExpr(auditEvent.createdAt, window.bucket);
  const rows = await db
    .select({ key: bucket, action: auditEvent.action, n: count() })
    .from(auditEvent)
    .where(
      and(
        sql`${auditEvent.action} in ('drone.approved', 'drone.rejected')`,
        window.since ? gte(auditEvent.createdAt, window.since) : undefined,
      ),
    )
    .groupBy(bucket, auditEvent.action)
    .orderBy(bucket);

  const byKey = new Map<string, { approved: number; rejected: number }>();
  for (const row of rows) {
    const entry = byKey.get(row.key) ?? emptyOutcomes();
    if (row.action === "drone.approved") entry.approved = row.n;
    else entry.rejected = row.n;
    byKey.set(row.key, entry);
  }

  return densify(
    keysFor(window, rows[0]?.key ?? null),
    [...byKey].map(([key, value]) => ({ key, value })),
    emptyOutcomes,
  );
}

// --- 3 · Review turnaround distribution -----------------------------------

/**
 * The histogram's bucket edges, in hours, open-ended at the top.
 *
 * The tail is the point. A median of four hours with one aircraft that waited
 * six months is a different platform from one where everything lands inside a
 * day, and only the long bar says so — which is exactly why F25 asks for a
 * distribution beside the median rather than the median alone.
 */
export const TURNAROUND_BOUNDS: readonly number[] = [0, 4, 24, 72, 168, 720];

export type HistogramBucket = {
  readonly from: number;
  readonly to: number | null;
  readonly n: number;
};

function emptyHistogram(): { from: number; to: number | null; n: number }[] {
  return TURNAROUND_BOUNDS.map((from, i) => ({
    from,
    to: TURNAROUND_BOUNDS[i + 1] ?? null,
    n: 0,
  }));
}

export async function getTurnaroundHistogram(
  session: Session,
  window: Window,
): Promise<readonly HistogramBucket[]> {
  if (!isReviewer(session)) return emptyHistogram();

  const rows = await db
    .select({
      hours: sql<string>`extract(epoch from (${drone.decidedAt} - ${drone.submittedAt})) / 3600`,
    })
    .from(drone)
    .where(
      and(
        isNotNull(drone.submittedAt),
        isNotNull(drone.decidedAt),
        // See the note on the median tile: a resubmission leaves `decided_at`
        // behind `submitted_at`, and the interval goes negative.
        sql`${drone.decidedAt} >= ${drone.submittedAt}`,
        window.since ? gte(drone.decidedAt, window.since) : undefined,
      ),
    );

  const counts = emptyHistogram();
  for (const row of rows) {
    const hours = Number(row.hours);
    let index = counts.length - 1;
    for (let i = 0; i < counts.length; i += 1) {
      const to = counts[i]?.to;
      if (to !== null && to !== undefined && hours < to) {
        index = i;
        break;
      }
    }
    const bucket = counts[index];
    if (bucket) bucket.n += 1;
  }
  return counts;
}

// --- 4 · Bookings by zone -------------------------------------------------

export type ZoneBarRow = {
  readonly zoneId: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly n: number;
};

/**
 * Capped at eight rows. A ninth bar is not a ninth colour — these are one
 * series and every bar wears the same ink — but it is a ninth long Arabic zone
 * name, and the chart stops being readable well before the data stops being
 * interesting. The CSV export carries every zone, which is what the cap is
 * allowed to lean on.
 */
export const ZONE_BAR_LIMIT = 8;

export async function getBookingsByZone(
  session: Session,
  window: Window,
  limit = ZONE_BAR_LIMIT,
): Promise<readonly ZoneBarRow[]> {
  if (!isReviewer(session)) return [];

  return db
    .select({
      zoneId: zone.id,
      nameAr: zone.nameAr,
      nameEn: zone.nameEn,
      n: count(booking.id),
    })
    .from(booking)
    .innerJoin(zone, eq(zone.id, booking.zoneId))
    .where(window.since ? gte(booking.slotStart, window.since) : undefined)
    .groupBy(zone.id, zone.nameAr, zone.nameEn)
    .orderBy(sql`count(${booking.id}) desc`)
    .limit(limit);
}

// --- 5 · Zone utilisation, weekday × hour ---------------------------------

export type UtilisationCell = {
  readonly weekday: number;
  readonly hour: number;
  readonly n: number;
};

/**
 * When people actually fly, as a 7 × 24 grid in Riyadh civil time.
 *
 * `extract(dow ...)` is **already Sunday = 0**, which is this project's week
 * start, so unlike `date_trunc('week', ...)` it needs no adjustment — worth
 * saying out loud, because the two conventions sit a few lines apart in this
 * file and only one of them is wrong out of the box.
 *
 * A `pending` booking is excluded: it is a request, not a flight, and a
 * utilisation grid that counted requests would show demand nobody was
 * permitted to meet.
 */
export async function getUtilisation(
  session: Session,
  window: Window,
): Promise<readonly UtilisationCell[]> {
  if (!isReviewer(session)) return [];

  const local = sql`(${booking.slotStart} AT TIME ZONE 'Asia/Riyadh')`;
  const weekday = sql<number>`extract(dow from ${local})::int`;
  const hour = sql<number>`extract(hour from ${local})::int`;

  return db
    .select({ weekday, hour, n: count() })
    .from(booking)
    .where(
      and(
        sql`${booking.status} in ('approved', 'completed', 'no_show')`,
        window.since ? gte(booking.slotStart, window.since) : undefined,
      ),
    )
    .groupBy(weekday, hour);
}

// --- 6 · No-show rate over time -------------------------------------------

export type NoShowRow = {
  readonly key: string;
  readonly value: { readonly noShow: number; readonly attended: number };
};

function emptyNoShow() {
  return { noShow: 0, attended: 0 };
}

/**
 * The share of *concluded* flights that nobody turned up for.
 *
 * The denominator is `completed + no_show` and nothing else. Including
 * `cancelled` would count a pilot who did the right thing and cancelled in
 * advance as a compliance failure; including `approved` would count every
 * flight that has not happened yet as attended and drag the current bucket to
 * zero every time the page is opened. Only a booking whose outcome is known
 * belongs in a rate about outcomes.
 */
export async function getNoShowRate(
  session: Session,
  window: Window,
): Promise<readonly NoShowRow[]> {
  if (!isReviewer(session)) return [];

  const bucket = bucketExpr(booking.slotStart, window.bucket);
  const rows = await db
    .select({ key: bucket, status: booking.status, n: count() })
    .from(booking)
    .where(
      and(
        sql`${booking.status} in ('completed', 'no_show')`,
        window.since ? gte(booking.slotStart, window.since) : undefined,
      ),
    )
    .groupBy(bucket, booking.status)
    .orderBy(bucket);

  const byKey = new Map<string, { noShow: number; attended: number }>();
  for (const row of rows) {
    const entry = byKey.get(row.key) ?? emptyNoShow();
    if (row.status === "no_show") entry.noShow = row.n;
    else entry.attended = row.n;
    byKey.set(row.key, entry);
  }

  return densify(
    keysFor(window, rows[0]?.key ?? null),
    [...byKey].map(([key, value]) => ({ key, value })),
    emptyNoShow,
  );
}

// --- 7 · Remote ID resolutions --------------------------------------------

export type ResolutionRow = {
  readonly key: string;
  readonly value: Readonly<Record<Resolver, number>>;
};

function emptyResolutions(): Record<Resolver, number> {
  return { public: 0, staff: 0 };
}

/**
 * Who is scanning. See `palette.ts` for why this is public-against-staff rather
 * than the spec's literal "anonymous / reviewer": all five viewer levels land
 * in exactly one of the two series, so the chart's total is the table's total.
 */
export async function getResolutions(
  session: Session,
  window: Window,
): Promise<readonly ResolutionRow[]> {
  if (!isReviewer(session)) return [];

  const bucket = bucketExpr(remoteIdScan.createdAt, window.bucket);
  const side = sql<Resolver>`case when ${remoteIdScan.viewerLevel} in ('reviewer', 'admin') then 'staff' else 'public' end`;

  const rows = await db
    .select({ key: bucket, side, n: count() })
    .from(remoteIdScan)
    .where(window.since ? gte(remoteIdScan.createdAt, window.since) : undefined)
    .groupBy(bucket, side)
    .orderBy(bucket);

  const byKey = new Map<string, Record<Resolver, number>>();
  for (const row of rows) {
    const entry = byKey.get(row.key) ?? emptyResolutions();
    entry[row.side as Resolver] = row.n;
    byKey.set(row.key, entry);
  }

  return densify(
    keysFor(window, rows[0]?.key ?? null),
    [...byKey].map(([key, value]) => ({ key, value })),
    emptyResolutions,
  );
}

// --- Everything at once ---------------------------------------------------

/** What the page renders and what the CSV export writes — one round of queries. */
export type AnalyticsData = {
  readonly window: Window;
  readonly tiles: Tiles;
  readonly registrations: readonly BuildTypeRow[];
  readonly outcomes: readonly OutcomeRow[];
  readonly turnaround: readonly HistogramBucket[];
  readonly zones: readonly ZoneBarRow[];
  readonly utilisation: readonly UtilisationCell[];
  readonly noShow: readonly NoShowRow[];
  readonly resolutions: readonly ResolutionRow[];
};

/**
 * Eight queries in one `Promise.all`, not eight awaited in turn.
 *
 * They share nothing and none depends on another's result, so serialising them
 * would multiply one page render by eight round trips to Postgres for no reason
 * — and the CSV export runs the identical call, so what is exported is
 * guaranteed to be what was on screen rather than a second, subtly different
 * set of queries written later.
 */
export async function getAnalytics(
  session: Session,
  key: RangeKey,
  now = new Date(),
): Promise<AnalyticsData> {
  const window = windowFor(key, now);
  const [
    tiles,
    registrations,
    outcomes,
    turnaround,
    zones,
    utilisation,
    noShow,
    resolutions,
  ] = await Promise.all([
    getTiles(session, now),
    getRegistrationsByBuildType(session, window),
    getApprovalOutcomes(session, window),
    getTurnaroundHistogram(session, window),
    getBookingsByZone(session, window),
    getUtilisation(session, window),
    getNoShowRate(session, window),
    getResolutions(session, window),
  ]);

  return {
    window,
    tiles,
    registrations,
    outcomes,
    turnaround,
    zones,
    utilisation,
    noShow,
    resolutions,
  };
}

export { BUILD_TYPES, RESOLVERS };
