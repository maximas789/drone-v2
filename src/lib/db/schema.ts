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
  droneStatus,
  droneWeightClass,
  idDocumentType,
  notificationCategory,
  notificationStatus,
  remoteIdDeclKind,
  remoteIdStatus,
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
     * `restrict`, not `cascade`. A registration record is not the pilot's
     * personal data to take with them — deleting an account that still holds
     * registered aircraft is refused at the database, and F28 has to offer a
     * real path (transfer, or revoke first) rather than quietly erasing an
     * airframe that may be flying with an Ajniha sticker on it.
     */
    ownerUserId: text()
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),

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
