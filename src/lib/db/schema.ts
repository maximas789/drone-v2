import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Geometry } from "@/lib/geo";
import { user } from "./auth-schema";
import {
  auditEntityType,
  bookingStatus,
  droneBuildType,
  dronePhotoKind,
  droneReportStatus,
  droneStatus,
  droneWeightClass,
  idDocumentType,
  jobStatus,
  notificationCategory,
  notificationStatus,
  remoteIdDeclKind,
  remoteIdStatus,
  remoteIdViewerLevel,
  zoneKind,
  zoneStatus,
} from "./enums";

/**
 * drizzle-kit only reads the file named in `drizzle.config.ts`, so the enums
 * must be re-exported from here or no `CREATE TYPE` reaches the migration and
 * it fails on the first table that uses one.
 *
 * The same applies to the CLI-generated `auth-schema.ts` below: without this
 * re-export, `user`, `session`, `account` and `verification` would never reach
 * a migration and every foreign key pointing at `user.id` would fail to apply.
 */
export * from "./enums";
export * from "./auth-schema";

/**
 * Better Auth's four tables are **left exactly as its CLI wrote them**, which
 * is the one sanctioned exception to two conventions in this file:
 *
 * - their primary keys are `text`, not `uuid` — which is why every column here
 *   that references a user is `text`;
 * - their timestamps are `timestamp` without a zone, not `timestamptz`. Drizzle
 *   writes them as `toISOString()` and reads them back with an explicit
 *   `+0000`, so the instants round-trip correctly; the column simply does not
 *   carry the zone. Re-running the CLI must not be a diff.
 */

/**
 * The domain schema.
 *
 * Two conventions hold everywhere:
 *
 * 1. **Every table has a random UUID primary key** — except Better Auth's
 *    generated tables, which stay exactly as its CLI writes them (F05).
 * 2. **Every column referencing a user is `text`**, matching Better Auth's
 *    `user.id`. Declaring one `uuid` fails at migrate time. Columns pointing at
 *    *our* tables are `uuid`.
 *
 * Time is `timestamptz` without exception. Civil time is Asia/Riyadh, fixed
 * +180 — see `src/lib/format.ts`.
 */

/** Shorthand for the primary key every table below shares. */
const id = () => uuid().primaryKey().defaultRandom();
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

// --- Reference data -------------------------------------------------------

export const city = pgTable("city", {
  id: id(),
  code: text().notNull().unique(), // "RUH"
  nameAr: text().notNull(),
  nameEn: text().notNull(),
  centroidLat: doublePrecision().notNull(),
  centroidLng: doublePrecision().notNull(),
  /** True only for Riyadh: the one city with authored airspace in this build. */
  isModelled: boolean().notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// --- Pilots ---------------------------------------------------------------

export const pilotProfile = pgTable(
  "pilot_profile",
  {
    id: id(),
    /** Better Auth `user.id`. Text, never uuid. */
    userId: text()
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),

    fullNameAr: text().notNull(),
    fullNameEn: text().notNull(),

    idDocumentType: idDocumentType().notNull(),
    /** Masked at every render. Never shown whole outside an identity reveal. */
    idDocumentNumber: text().notNull(),
    /**
     * `sha256(ID_HASH_PEPPER + number)`. Uniqueness is enforced on the hash so
     * that "one person, one profile" holds without a plaintext unique index
     * that would leak membership to anyone who could read the index.
     *
     * The pepper is generated once and never rotated — rotating it orphans
     * every hash already stored.
     */
    idDocumentHash: text().notNull().unique(),

    dateOfBirth: date(),
    // Explicit name: the snake_case converter turns `mobileE164` into
    // `mobile_e_164`, splitting the "E164" standard's name in half.
    mobileE164: text("mobile_e164"),
    addressCityId: uuid().references(() => city.id),
    addressLine: text(),
    emergencyContact: text(),

    /** Set when the pilot has supplied everything a booking requires. */
    completedAt: timestamp({ withTimezone: true }),
    /** Identity is verified by a **human reviewer**, never automatically. */
    verifiedAt: timestamp({ withTimezone: true }),
    verifiedByUserId: text().references(() => user.id, {
      onDelete: "set null",
    }),
    rejectedAt: timestamp({ withTimezone: true }),
    rejectionReason: text(),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("pilot_profile_verification_idx").on(t.verifiedAt, t.createdAt)],
);

// --- Drones ---------------------------------------------------------------

export const drone = pgTable(
  "drone",
  {
    id: id(),
    /**
     * **`set null`, and nullable — changed by F28c.** It was `restrict` and
     * `not null`, with this reasoning: *a registration record is not the
     * pilot's personal data to take with them, and deleting an account that
     * still holds registered aircraft must not quietly erase an airframe that
     * may be flying with an Ajniha sticker on it.*
     *
     * **That reasoning was right and is what this change preserves.** What was
     * wrong was the mechanism. `restrict` does not protect the airframe; it
     * only makes account deletion impossible, which is not a policy anybody
     * chose — F27's privacy policy had to disclose it as "there is no
     * self-service deletion".
     *
     * F28 requires two things that cannot both be literal: *drones deleted*,
     * and *the Remote ID retained and still resolving*. `remote_id.drone_id` is
     * `not null` and every fact a scan displays — build type, weight class —
     * lives on this row, so deleting the drone takes the Remote ID with it and
     * leaves a QR sticker resolving to nothing. **A null owner is what satisfies
     * both**: the person is gone, the accountability record is not, and the code
     * on the airframe answers `withdrawn` instead of 404.
     *
     * A null here therefore means exactly one thing — **the owner deleted their
     * account** — and `registrationStatusOf` reads it as `withdrawn`. Nothing
     * else in the app ever writes null: a drone is created with an owner and
     * only account deletion removes one.
     */
    ownerUserId: text().references(() => user.id, { onDelete: "set null" }),

    nickname: text().notNull(),
    manufacturer: text(),
    model: text(),

    /**
     * **NULLABLE, and that nullability is the entire product.**
     *
     * GACA registration requires a manufacturer serial number, which self-built
     * and FPV aircraft do not have — so their operators cannot legally register
     * anywhere. Ajniha replaces the serial with Remote ID.
     *
     * The app-enforced rule is the exact inversion of GACA's: a serial number
     * is required **only** when `buildType === 'commercial'`. Do not add a
     * NOT NULL here. It is not an oversight.
     */
    serialNumber: text(),

    buildType: droneBuildType().notNull(),
    weightGrams: integer().notNull(),
    /** Derived from `weightGrams` on write, stored so it is indexable. */
    weightClass: droneWeightClass().notNull(),
    propulsion: text(),
    hasCamera: boolean().notNull().default(false),

    status: droneStatus().notNull().default("draft"),
    submittedAt: timestamp({ withTimezone: true }),
    decidedAt: timestamp({ withTimezone: true }),
    decidedByUserId: text().references(() => user.id, { onDelete: "set null" }),
    rejectionReason: text(),
    rejectionCount: integer().notNull().default(0),

    registrationIssuedAt: timestamp({ withTimezone: true }),
    /** Three years from issue — GACA's validity period. Swept by F08. */
    registrationExpiresAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    revocationReason: text(),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("drone_owner_status_idx").on(t.ownerUserId, t.status),
    // The reviewer queue: oldest pending first.
    index("drone_status_submitted_idx").on(t.status, t.submittedAt),
    // The expiry sweep.
    index("drone_expires_idx").on(t.registrationExpiresAt),
  ],
);

export const dronePhoto = pgTable(
  "drone_photo",
  {
    id: id(),
    droneId: uuid()
      .notNull()
      .references(() => drone.id, { onDelete: "cascade" }),
    url: text().notNull(),
    /** The shape `deleteFile()` takes (F07) — not derivable from `url`. */
    pathname: text().notNull(),
    kind: dronePhotoKind().notNull().default("overall"),
    sortOrder: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("drone_photo_drone_idx").on(t.droneId, t.sortOrder)],
);

// --- Remote ID ------------------------------------------------------------

export const remoteId = pgTable(
  "remote_id",
  {
    id: id(),
    droneId: uuid()
      .notNull()
      .unique()
      .references(() => drone.id, { onDelete: "cascade" }),

    /**
     * `AJN-4F2K-91XZ`. **Survives renewal** — a QR sticker already on an
     * airframe must keep resolving after the registration is renewed.
     */
    code: text().notNull().unique(),
    status: remoteIdStatus().notNull().default("active"),
    issuedAt: createdAt(),

    networkCapable: boolean().notNull().default(false),
    broadcastCapable: boolean().notNull().default(false),

    /** Rendered QR in blob storage (F19). */
    qrPathname: text(),

    lastResolvedAt: timestamp({ withTimezone: true }),
    resolveCount: integer().notNull().default(0),

    suspendedAt: timestamp({ withTimezone: true }),
    suspensionReason: text(),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("remote_id_status_idx").on(t.status)],
);

/**
 * External and standard Remote ID modules, **with history**.
 *
 * A child table rather than columns on `remote_id`, because the regulator's
 * question is "what was broadcasting on 3 March" — that needs rows carrying
 * validity windows, not fields that the next edit overwrites.
 */
export const remoteIdDeclaration = pgTable(
  "remote_id_declaration",
  {
    id: id(),
    remoteIdId: uuid()
      .notNull()
      .references(() => remoteId.id, { onDelete: "cascade" }),

    kind: remoteIdDeclKind().notNull(),
    manufacturer: text(),
    moduleSerial: text(),
    docReference: text(),
    docPath: text(),

    validFrom: timestamp({ withTimezone: true }),
    validUntil: timestamp({ withTimezone: true }),

    verifiedAt: timestamp({ withTimezone: true }),
    verifiedByUserId: text().references(() => user.id, {
      onDelete: "set null",
    }),
    rejectedAt: timestamp({ withTimezone: true }),
    rejectionReason: text(),
    /** Set when a later declaration replaces this one. Never deleted. */
    supersededAt: timestamp({ withTimezone: true }),

    notesAr: text(),
    notesEn: text(),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("remote_id_decl_remote_idx").on(t.remoteIdId),
    // A module serial is claimable once at a time, but the superseded history
    // stays queryable.
    uniqueIndex("remote_id_decl_active_module_uniq")
      .on(t.kind, t.moduleSerial)
      .where(sql`superseded_at is null and module_serial is not null`),
  ],
);

/**
 * One row per resolution of a Remote ID — the public scan page, the JSON twin,
 * and (F24) the admin lookup.
 *
 * **This table is what makes "an authority can resolve identity" auditable
 * rather than merely possible.** The owner of a drone cannot see who scanned
 * it — that would turn the licence plate into a tracker pointed back at
 * bystanders — but an admin can see every reveal, and a reveal that is not in
 * here did not happen.
 *
 * `remoteIdId` is **nullable on purpose**: an unknown code is still a
 * resolution, and a run of them is precisely the enumeration attempt this table
 * exists to make visible. `scannedCode` records what was asked for either way.
 *
 * IPs are `sha256(RATE_LIMIT_PEPPER + ip)`. A raw address never lands here.
 */
export const remoteIdScan = pgTable(
  "remote_id_scan",
  {
    id: id(),
    /** `set null`: the scan record outlives the registration it looked at. */
    remoteIdId: uuid().references(() => remoteId.id, { onDelete: "set null" }),
    /** Normalised where it normalised; otherwise what was typed, truncated. */
    scannedCode: text().notNull(),

    /** Null for the roadside case — an inspector with no account. */
    viewerUserId: text().references(() => user.id, { onDelete: "set null" }),
    /** The level **at the time**, never recomputed. */
    viewerLevel: remoteIdViewerLevel().notNull(),

    /** `sha256(pepper + ip)`. Never raw — see `src/lib/ip-hash.ts`. */
    ipHash: text(),
    userAgent: text(),

    /**
     * Set by the reveal action, in the same transaction as the
     * `remote_id.identity_revealed` audit event. Two records of one act, on
     * purpose: this one answers "was this code's owner ever exposed", the audit
     * event answers "who did it and why".
     */
    revealedIdentity: boolean().notNull().default(false),

    createdAt: createdAt(),
  },
  (t) => [
    index("remote_id_scan_remote_idx").on(t.remoteIdId, t.createdAt),
    index("remote_id_scan_viewer_idx").on(t.viewerUserId, t.createdAt),
    // "Show me every reveal" — the admin question this table is here for.
    index("remote_id_scan_revealed_idx").on(t.revealedIdentity, t.createdAt),
  ],
);

/**
 * A member of the public reporting a drone they can see.
 *
 * Filed from the anonymous scan page, so **nothing about the owner is needed to
 * write one** — that is the point. The reporter learns nothing they did not
 * already know; the reviewer gets the code, what was described, and where.
 *
 * `remoteIdId` is nullable because F24's *"report unregistered drone"* files
 * the same kind of record with no registration behind it. `reportedCode` is
 * what was scanned or typed, and it survives the row it pointed at.
 */
export const droneReport = pgTable(
  "drone_report",
  {
    id: id(),
    remoteIdId: uuid().references(() => remoteId.id, { onDelete: "set null" }),
    reportedCode: text().notNull(),

    /** Free text, in whatever language the reporter wrote it. Never rendered as trusted markup. */
    description: text().notNull(),
    /** Where the reporter was, if they offered it. WGS84, degrees. */
    locationLat: doublePrecision(),
    locationLng: doublePrecision(),
    locationNote: text(),

    /** Null when the reporter was signed out, which is the common case. */
    reporterUserId: text().references(() => user.id, { onDelete: "set null" }),
    ipHash: text(),
    userAgent: text(),

    /**
     * **Triage — thread 35, closed in F22c.**
     *
     * Until now a report was written, audited and listed, and there was no way
     * to close one: reports accumulated on `/admin` for ever and a reviewer had
     * no way to say "handled". The columns were deliberately not added earlier,
     * because a state nothing writes is a lie about what the app does — so they
     * arrive with the controls that write them.
     *
     * The note is the reviewer's own words and, unlike a rejection reason, it
     * reaches **nobody**: a report is usually filed by a member of the public
     * who left no address, and there is no correspondent to quote it to. It is
     * for the next reviewer and the regulator.
     */
    status: droneReportStatus().notNull().default("open"),
    handledAt: timestamp({ withTimezone: true }),
    handledByUserId: text().references(() => user.id, { onDelete: "set null" }),
    handlingNote: text(),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("drone_report_remote_idx").on(t.remoteIdId, t.createdAt),
    // The reviewer queue: newest first, which F22 pages through.
    index("drone_report_created_idx").on(t.createdAt),
    // Triage: open reports first, oldest first inside that.
    index("drone_report_status_idx").on(t.status, t.createdAt),
  ],
);

// --- Airspace -------------------------------------------------------------

export const zone = pgTable(
  "zone",
  {
    id: id(),
    cityId: uuid()
      .notNull()
      .references(() => city.id),
    code: text().notNull().unique(), // "RUH-P-01"
    kind: zoneKind().notNull(),
    status: zoneStatus().notNull().default("draft"),

    nameAr: text().notNull(),
    nameEn: text().notNull(),
    districtAr: text(),
    districtEn: text(),
    notesAr: text(),
    notesEn: text(),

    /** GeoJSON, WGS84, `[lng, lat]`. Authoritative. */
    geometry: jsonb().$type<Geometry>().notNull(),
    /**
     * Bumped on every geometry edit. A booking's `decisionSnapshot` records the
     * version it was approved against, so "on what basis was this approved"
     * survives the polygon being redrawn.
     */
    geometryVersion: integer().notNull().default(1),
    vertexCount: integer().notNull().default(0),

    // Denormalised bbox — a SQL pre-filter before the ray-cast in TypeScript.
    // doublePrecision, NOT numeric: numeric maps to `string` in Drizzle and
    // would put a parse in the point-in-polygon hot loop.
    minLat: doublePrecision().notNull(),
    maxLat: doublePrecision().notNull(),
    minLng: doublePrecision().notNull(),
    maxLng: doublePrecision().notNull(),

    ceilingAglM: integer(),
    floorAglM: integer().notNull().default(0),

    capacity: integer().notNull().default(1),
    slotDurationMinutes: integer().notNull().default(60),
    minLeadMinutes: integer().notNull().default(60),
    maxAdvanceDays: integer().notNull().default(30),
    maxSlotsPerPilotPerDay: integer().notNull().default(2),
    autoApprove: boolean().notNull().default(false),
    nightAllowed: boolean().notNull().default(false),

    maxWeightClass: droneWeightClass(),
    permittedBuildTypes: droneBuildType().array(),
    requiresBroadcastRid: boolean().notNull().default(false),

    /** Provenance of the rule, where one exists. These zones are authored. */
    authorityRef: text(),
    publishedAt: timestamp({ withTimezone: true }),

    createdByUserId: text().references(() => user.id, { onDelete: "set null" }),
    updatedByUserId: text().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("zone_city_status_idx").on(t.cityId, t.status),
    index("zone_kind_idx").on(t.kind, t.status),
    // The bbox pre-filter the map's viewport query rides on.
    index("zone_bbox_idx").on(t.minLat, t.maxLat, t.minLng, t.maxLng),
  ],
);

/**
 * Opening hours as **rows, not a jsonb blob** — a Friday can have two windows
 * around prayer times, and a blob makes that unqueryable.
 */
export const zoneHour = pgTable(
  "zone_hour",
  {
    id: id(),
    zoneId: uuid()
      .notNull()
      .references(() => zone.id, { onDelete: "cascade" }),
    /** **0 = Sunday.** The Saudi week starts on Sunday. */
    weekday: smallint().notNull(),
    /** Minutes from local midnight. A window never crosses midnight. */
    opensMinute: integer().notNull(),
    closesMinute: integer().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("zone_hour_uniq").on(t.zoneId, t.weekday, t.opensMinute),
    index("zone_hour_zone_idx").on(t.zoneId, t.weekday),
  ],
);

/** The NOTAM analogue: a temporary closure over an existing zone. */
export const zoneClosure = pgTable(
  "zone_closure",
  {
    id: id(),
    zoneId: uuid()
      .notNull()
      .references(() => zone.id, { onDelete: "cascade" }),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    /** Human-authored, so paired columns rather than a code. */
    reasonAr: text().notNull(),
    reasonEn: text().notNull(),
    authorityRef: text(),
    publishedAt: timestamp({ withTimezone: true }),
    createdByUserId: text().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("zone_closure_window_idx").on(t.zoneId, t.startsAt, t.endsAt)],
);

// --- Bookings -------------------------------------------------------------

export const booking = pgTable(
  "booking",
  {
    id: id(),
    /** `restrict`, for the same reason as `drone.ownerUserId`. */
    pilotUserId: text()
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    droneId: uuid()
      .notNull()
      .references(() => drone.id),
    /**
     * The flight binds to the **Remote ID**, not just the airframe. That is
     * what a field inspector scans, and what makes the booking checkable.
     */
    remoteIdId: uuid()
      .notNull()
      .references(() => remoteId.id),
    zoneId: uuid()
      .notNull()
      .references(() => zone.id),

    slotStart: timestamp({ withTimezone: true }).notNull(),
    slotEnd: timestamp({ withTimezone: true }).notNull(),
    /** 0..capacity-1. Turns "is the slot full" into a unique-index question. */
    seatIndex: smallint().notNull(),

    status: bookingStatus().notNull().default("pending"),
    purpose: text(),
    purposeNote: text(),
    plannedAltitudeM: integer(),

    decidedAt: timestamp({ withTimezone: true }),
    decidedByUserId: text().references(() => user.id, { onDelete: "set null" }),
    rejectionReason: text(),
    cancelledAt: timestamp({ withTimezone: true }),
    cancelledByUserId: text().references(() => user.id, {
      onDelete: "set null",
    }),
    cancellationReason: text(),
    checkedInAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),

    /**
     * The `AirspaceDecision` as it stood at approval — ceiling, the zone's
     * `geometryVersion`, every reason evaluated. This is the answer to "on what
     * basis was this approved" after the polygon has since been redrawn.
     */
    decisionSnapshot: jsonb(),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Concurrency is enforced by the database, not by a read-then-write in
    // application code. All three are partial: a cancelled booking frees its
    // seat immediately. See F13.
    uniqueIndex("booking_seat_uniq")
      .on(t.zoneId, t.slotStart, t.seatIndex)
      .where(sql`status in ('pending','approved')`),
    uniqueIndex("booking_drone_slot_uniq")
      .on(t.droneId, t.slotStart)
      .where(sql`status in ('pending','approved')`),
    uniqueIndex("booking_pilot_slot_uniq")
      .on(t.pilotUserId, t.slotStart)
      .where(sql`status in ('pending','approved')`),

    index("booking_pilot_idx").on(t.pilotUserId, t.slotStart),
    index("booking_zone_slot_idx").on(t.zoneId, t.slotStart),
    index("booking_queue_idx").on(t.status, t.createdAt),
  ],
);

export const bookingCopilot = pgTable(
  "booking_copilot",
  {
    id: id(),
    bookingId: uuid()
      .notNull()
      .references(() => booking.id, { onDelete: "cascade" }),
    fullNameAr: text().notNull(),
    fullNameEn: text().notNull(),
    // Explicit name: the snake_case converter turns `mobileE164` into
    // `mobile_e_164`, splitting the "E164" standard's name in half.
    mobileE164: text("mobile_e164"),
    /** Masked at every render, as on `pilot_profile`. */
    idDocumentNumber: text(),
    /** Set when the co-pilot is themselves a registered Ajniha pilot. */
    userId: text().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("booking_copilot_booking_idx").on(t.bookingId)],
);

// --- The log --------------------------------------------------------------

/**
 * **One log, not two.** This single table backs both the regulator's approval
 * trail and the ops activity log — two overlapping logs drift, and the trail an
 * admin reads must be the trail a regulator audits.
 *
 * Append-only. There is no update path, no delete path, and no UI affordance
 * for either.
 */
export const auditEvent = pgTable(
  "audit_event",
  {
    id: id(),
    /**
     * `on delete set null`: the log outlives the account. A deleted reviewer
     * must not take their approvals with them.
     */
    actorUserId: text().references(() => user.id, { onDelete: "set null" }),
    /** The actor's role **at the time**, not whatever it is now. */
    actorRole: text(),
    actorIsSystem: boolean().notNull().default(false),

    entityType: auditEntityType().notNull(),
    /** Text: may hold a user's text id or one of our uuids. */
    entityId: text().notNull(),
    action: text().notNull(), // "drone.approved"

    before: jsonb(),
    after: jsonb(),
    reason: text(),

    /** `sha256(pepper + ip)`. A raw address is never stored. */
    ipHash: text(),
    userAgent: text(),

    createdAt: createdAt(),
  },
  (t) => [
    index("audit_entity_idx").on(t.entityType, t.entityId, t.createdAt),
    index("audit_actor_idx").on(t.actorUserId, t.createdAt),
    index("audit_action_idx").on(t.action, t.createdAt),
  ],
);

// --- Notifications and email ---------------------------------------------

export const notification = pgTable(
  "notification",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /**
     * An i18n key plus its params — **never rendered text**. A pilot who
     * switches to English must see their old notifications in English.
     */
    type: text().notNull(),
    params: jsonb(),

    entityType: auditEntityType(),
    entityId: text(),
    /** Locale-less. The renderer prefixes `/[locale]`. */
    href: text(),

    status: notificationStatus().notNull().default("unread"),
    readAt: timestamp({ withTimezone: true }),
    emailLogId: uuid(),

    createdAt: createdAt(),
  },
  (t) => [index("notification_user_idx").on(t.userId, t.status, t.createdAt)],
);

export const notificationPreference = pgTable(
  "notification_preference",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Only categories that actually exist. No aspirational rows. */
    category: notificationCategory().notNull(),
    emailEnabled: boolean().notNull().default(true),
    inAppEnabled: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("notification_pref_uniq").on(t.userId, t.category)],
);

export const emailLog = pgTable(
  "email_log",
  {
    id: id(),
    /** The log of what was sent outlives the account it was sent to. */
    userId: text().references(() => user.id, { onDelete: "set null" }),
    toAddress: text().notNull(),
    subject: text().notNull(),
    template: text().notNull(),
    /** Which language the email was actually sent in. */
    locale: text().notNull(),
    entityId: text(),
    providerMessageId: text(),
    status: text().notNull().default("queued"),
    error: text(),
    sentAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("email_log_user_idx").on(t.userId, t.createdAt),
    index("email_log_status_idx").on(t.status, t.createdAt),
  ],
);

// --- Background jobs ------------------------------------------------------

/**
 * Inngest run state, mirrored into **our** database (F08).
 *
 * Inngest's own dashboard already shows every step of every run. This table
 * exists because the operator should not have to leave the app to answer "did
 * the expiry sweep run last night, and did it fail?" — F29's system page reads
 * from here, and a hosting dashboard that keeps 30 days of history is not a
 * substitute for a record the app owns.
 *
 * Writes come from a single Inngest middleware (`src/lib/inngest/jobs-table.ts`)
 * rather than from the job bodies, so a function cannot forget to report
 * itself, and a mirroring failure can never fail the run that it describes.
 */
export const job = pgTable(
  "job",
  {
    id: id(),
    /** Inngest's run id. The natural key — one row per run, upserted. */
    runId: text().notNull().unique(),
    /** Inngest's function id, e.g. `ajniha-registration-expiry-sweep`. */
    functionId: text().notNull(),
    status: jobStatus().notNull().default("running"),
    /** Zero-indexed, as Inngest counts them. Bumped on every retry. */
    attempt: integer().notNull().default(0),

    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp({ withTimezone: true }),
    /** Stored, not derived: F29 sorts and filters on it. */
    durationMs: integer(),

    /** The **full** message. F29 shows it verbatim — never "an error occurred". */
    error: text(),
    /** Whatever the function returned: counts, ids swept, nothing. */
    output: jsonb(),

    /** The event name that triggered it, or null for a cron. */
    triggerEvent: text(),
    /**
     * Set when this run exists because an operator pressed **Re-run**. A re-run
     * is a new run with a new id — this column is what ties it back rather than
     * pretending the old run restarted.
     */
    rerunOfRunId: text(),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // "Did this function run last night?" — the system page's default query.
    index("job_function_started_idx").on(t.functionId, t.startedAt),
    index("job_status_started_idx").on(t.status, t.startedAt),
  ],
);

// --- Rate limiting --------------------------------------------------------

/**
 * Fixed-window counters for the app's own rate limiting (F09). Better Auth
 * keeps its own separate table for `/api/auth/*`; this one covers server
 * actions, which are ordinary POSTs and completely invisible to it.
 *
 * **No Redis**, deliberately: this works on serverless Neon with no second
 * service to run, pay for or forget to provision.
 *
 * `key` already encodes the window length (`booking.create:user:abc#60`), so
 * two rules on the same action cannot collide on the same `window_start` —
 * which they otherwise would at every midnight, where a 60-second window and a
 * 24-hour window begin on the same instant.
 *
 * **No raw IP address ever lands here.** Anonymous limits key on
 * `sha256(RATE_LIMIT_PEPPER + ip)`; see `src/lib/ip-hash.ts`.
 */
export const rateLimitBucket = pgTable(
  "rate_limit_bucket",
  {
    id: id(),
    key: text().notNull(),
    windowStart: timestamp({ withTimezone: true }).notNull(),
    /**
     * `windowStart + window`. Stored rather than derived so the nightly sweep
     * is one indexed delete and does not have to know what window produced
     * each row — and so `retryAfterSeconds` is a subtraction, not a lookup.
     */
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    count: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    // The conflict target of the atomic increment. Without it the
    // `on conflict` has nothing to match and every hit inserts a new row.
    uniqueIndex("rate_limit_bucket_uniq").on(t.key, t.windowStart),
    index("rate_limit_bucket_expiry_idx").on(t.expiresAt),
  ],
);

/**
 * Who else has this record open — F22's **soft lock**.
 *
 * **It is named for what it is.** F22 calls it a soft lock; it locks nothing
 * and refuses nothing, and naming the table `review_lock` would invite a future
 * reader to believe a decision checks it. What actually stops two reviewers
 * overwriting each other is `applyTransition`'s `select … for update` and the
 * `already_applied` it answers — this table only lets the second reviewer see
 * the first one *before* they both start typing.
 *
 * One row per (record, reviewer) rather than one per record: two people reading
 * the same submission is the situation worth showing, and a single-holder row
 * would have to decide which of them "has" it — a question with no true answer
 * and a stolen lock as the usual outcome.
 *
 * Rows expire by time, not by a goodbye: a closed laptop sends no unlock, so
 * anything relying on one would leave records permanently "in review". The
 * page refreshes its own row while it is open and the sweep deletes the rest.
 */
export const reviewPresence = pgTable(
  "review_presence",
  {
    id: id(),
    entityType: auditEntityType().notNull(),
    entityId: uuid().notNull(),
    /** Better Auth `user.id`. Text, never uuid. */
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Extended by every heartbeat; the row is ignored once it passes. */
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // The conflict target of the heartbeat's upsert.
    uniqueIndex("review_presence_uniq").on(t.entityType, t.entityId, t.userId),
    index("review_presence_expiry_idx").on(t.expiresAt),
  ],
);
