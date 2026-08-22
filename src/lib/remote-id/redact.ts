import type { droneBuildType, droneWeightClass } from "@/lib/db/enums";

/**
 * The masking function. **Pure** — no database, no session, no request — and
 * **every surface goes through it**: the HTML scan page, the JSON twin, and
 * F24's admin lookup.
 *
 * No route assembles its own response shape. A route that hand-picks fields is
 * one refactor away from putting a national ID in an anonymous response, and
 * this is the single function that has to be right.
 *
 * The return type is a **discriminated union per level**, not one shape with
 * optional fields. That is the second line of defence: on the anonymous branch
 * `ownerNameAr` does not exist, so rendering it is a compile error rather than
 * a runtime `undefined` that happens to look fine in the browser.
 */

export type ViewerLevel = "anonymous" | "pilot" | "owner" | "reviewer" | "admin";

export type BuildType = (typeof droneBuildType.enumValues)[number];
export type WeightClass = (typeof droneWeightClass.enumValues)[number];

/**
 * What a bystander is told about the registration, as one code.
 *
 * Deliberately **not** the raw `drone.status` — `draft` and `rejected` are the
 * pilot's business, and a field inspector needs one of five answers, translated
 * at render like every other enumerable value in this app.
 */
export type RegistrationStatus =
  | "active"
  | "expired"
  | "suspended"
  | "revoked"
  /**
   * **The owner deleted their account.** F28c: `drone.owner_user_id` is set
   * null on account deletion, and that is the only thing that ever writes a
   * null there — so the registration record and the Remote ID survive with
   * nobody behind them, and a sticker already on an airframe keeps resolving
   * instead of 404ing.
   */
  | "withdrawn"
  | "unregistered";

export type ActiveFlight = {
  zoneNameAr: string;
  zoneNameEn: string;
  slotStart: Date;
  slotEnd: Date;
};

export type DeclarationSummary = {
  kind: string;
  manufacturer: string | null;
  moduleSerial: string | null;
  docReference: string | null;
  verifiedAt: Date | null;
  validUntil: Date | null;
};

export type BookingSummary = {
  id: string;
  zoneNameAr: string;
  zoneNameEn: string;
  slotStart: Date;
  slotEnd: Date;
  status: string;
};

export type ScanSummary = {
  id: string;
  viewerLevel: ViewerLevel;
  revealedIdentity: boolean;
  createdAt: Date;
};

/**
 * Everything the database knows, before any masking. Only `resolve.ts` builds
 * one, and only this file is allowed to decide what leaves it.
 */
export type FullRemoteIdRecord = {
  remoteIdId: string;
  code: string;
  /** `remote_id.status` — active, suspended, retired. */
  remoteIdStatus: string;
  /** `drone.status` — approved, expired, revoked, … */
  droneStatus: string;
  issuedAt: Date;
  validUntil: Date | null;
  networkCapable: boolean;
  broadcastCapable: boolean;

  buildType: BuildType;
  weightClass: WeightClass;
  weightGrams: number;
  hasCamera: boolean;

  droneId: string;
  /** Null once the owner has deleted their account — see `withdrawn`. */
  ownerUserId: string | null;
  nickname: string;
  manufacturer: string | null;
  model: string | null;
  /** Null for a self-built or FPV airframe. That nullability is the product. */
  serialNumber: string | null;

  /** City of registration, from the owner's profile. */
  cityNameAr: string | null;
  cityNameEn: string | null;

  ownerNameAr: string | null;
  ownerNameEn: string | null;
  ownerMobile: string | null;
  ownerIdDocumentType: string | null;
  ownerIdDocumentNumber: string | null;

  /** Set when a booking is approved and the slot contains "now". */
  activeFlight: ActiveFlight | null;

  photoUrls: string[];
  declarations: DeclarationSummary[];
  /** Owner-scoped or complete, decided by the caller's query, not here. */
  bookings: BookingSummary[];
  /** Only ever populated for a reviewer or admin. */
  scans: ScanSummary[];
};

/**
 * The licence plate. Everything a bystander gets, and nothing else.
 *
 * It proves the aircraft is accountable without identifying a person: the code,
 * a status, valid-until, build type, weight class, city, and whether a flight is
 * authorised right now.
 */
export type PublicFields = {
  code: string;
  registrationStatus: RegistrationStatus;
  validUntil: Date | null;
  buildType: BuildType;
  weightClass: WeightClass;
  cityNameAr: string | null;
  cityNameEn: string | null;
  /**
   * **Yes or no, never where.** Knowing an aircraft overhead is authorised is
   * exactly what a bystander needs to decide whether to report it. *Which* zone
   * reveals where the operator is standing — the control-station position the
   * FAA model restricts to authorities — so the zone lives one level up.
   */
  flightInProgress: boolean;
  networkCapable: boolean;
  broadcastCapable: boolean;
};

export type IdentifiedFields = {
  droneId: string;
  nickname: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  weightGrams: number;
  hasCamera: boolean;
  ownerNameAr: string | null;
  ownerNameEn: string | null;
  ownerMobile: string | null;
  ownerIdDocumentType: string | null;
  /** `•••••1234`. The whole number is never in a rendered payload. */
  ownerIdDocumentMasked: string | null;
  activeFlight: ActiveFlight | null;
  photoUrls: string[];
  declarations: DeclarationSummary[];
  bookings: BookingSummary[];
};

/** The licence plate, and nothing more. What a bystander and a stranger get. */
export type PublicRemoteId = {
  level: "anonymous" | "pilot";
  canReveal: false;
} & PublicFields;

export type OwnerRemoteId = { level: "owner"; canReveal: false } & PublicFields &
  IdentifiedFields;

export type StaffRemoteId = {
  level: "reviewer" | "admin";
  /** The Reveal control, and the only branch that carries it. */
  canReveal: true;
  scans: ScanSummary[];
} & PublicFields &
  IdentifiedFields;

export type IdentifiedRemoteId = OwnerRemoteId | StaffRemoteId;

export type RedactedRemoteId = PublicRemoteId | IdentifiedRemoteId;

/**
 * The narrowing a renderer needs, as a type predicate.
 *
 * Written as a function rather than left inline because TypeScript will not
 * narrow a union *away* on the negative side of `level === "anonymous" ||
 * level === "pilot"` — the public member's discriminant is itself a union, so
 * excluding one literal leaves the member in place. Getting that wrong is not a
 * cosmetic problem here: it is the difference between the compiler enforcing
 * the masking table and merely appearing to.
 */
export function isIdentified(
  view: RedactedRemoteId,
): view is IdentifiedRemoteId {
  return view.level === "owner" || view.canReveal;
}

/**
 * Five bullets regardless of length, then the last four digits.
 *
 * Fixed-width so the mask does not leak how long the number is — a Saudi
 * national ID and an Iqama are both 10 digits, but a GCC id need not be, and a
 * mask that varies is a mask that classifies people.
 */
export function maskIdDocument(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\s/g, "");
  return `•••••${digits.slice(-4)}`;
}

/**
 * What a bystander is told, derived from the two statuses together.
 *
 * A suspended Remote ID wins over anything the drone row says: suspension is
 * the answer to "should this thing be in the air", and it is the one a field
 * inspector is acting on.
 *
 * **An approved registration past its expiry reads `expired`** even before the
 * nightly sweep has moved the row. The clock, not the cron, is what makes a
 * registration lapse, and a page that says "active" until 03:00 the next
 * morning would be wrong for the hours that matter.
 */
export function registrationStatusOf(
  record: Pick<
    FullRemoteIdRecord,
    "remoteIdStatus" | "droneStatus" | "validUntil" | "ownerUserId"
  >,
  now: Date = new Date(),
): RegistrationStatus {
  /**
   * **Revoked outranks withdrawn**, and the order is the answer to a field
   * inspector's question rather than a preference. Both mean "not authorised";
   * `revoked` additionally means *an authority grounded this aircraft*, which
   * is the more actionable of the two. Only when nobody revoked it does the
   * absent owner become the headline.
   */
  if (record.droneStatus === "revoked") return "revoked";
  if (record.ownerUserId === null) return "withdrawn";
  if (record.remoteIdStatus === "suspended") return "suspended";
  if (record.droneStatus === "expired") return "expired";
  if (record.droneStatus !== "approved") return "unregistered";
  if (record.validUntil && record.validUntil <= now) return "expired";
  return "active";
}

/**
 * `redactRemoteId(record, level)`.
 *
 * **Redaction removes fields; it never nulls them in place.** A `null` in a
 * response is indistinguishable from "this drone has no manufacturer", and it
 * would let a caller learn the shape of what is being withheld. The anonymous
 * branch simply has no such key.
 *
 * `level` is computed server-side from the session and the record — see
 * `viewerLevelFor` in `resolve.ts`. It is never read from a parameter, a header
 * or a query string.
 */
export function redactRemoteId(
  record: FullRemoteIdRecord,
  level: ViewerLevel,
  now: Date = new Date(),
): RedactedRemoteId {
  const shared: PublicFields = {
    code: record.code,
    registrationStatus: registrationStatusOf(record, now),
    validUntil: record.validUntil,
    buildType: record.buildType,
    weightClass: record.weightClass,
    cityNameAr: record.cityNameAr,
    cityNameEn: record.cityNameEn,
    flightInProgress: record.activeFlight !== null,
    networkCapable: record.networkCapable,
    broadcastCapable: record.broadcastCapable,
  };

  if (level === "anonymous" || level === "pilot") {
    return { level, canReveal: false, ...shared };
  }

  const identified: IdentifiedFields = {
    droneId: record.droneId,
    nickname: record.nickname,
    manufacturer: record.manufacturer,
    model: record.model,
    serialNumber: record.serialNumber,
    weightGrams: record.weightGrams,
    hasCamera: record.hasCamera,
    ownerNameAr: record.ownerNameAr,
    ownerNameEn: record.ownerNameEn,
    ownerMobile: record.ownerMobile,
    ownerIdDocumentType: record.ownerIdDocumentType,
    /**
     * **Masked on both branches, reviewer included.** A reviewer sees the whole
     * number only through `revealIdentity`, which writes the audit event before
     * it returns the value — so the unmasked number never arrives as a side
     * effect of opening a page.
     */
    ownerIdDocumentMasked: maskIdDocument(record.ownerIdDocumentNumber),
    activeFlight: record.activeFlight,
    photoUrls: record.photoUrls,
    declarations: record.declarations,
    bookings: record.bookings,
  };

  if (level === "owner") {
    return { level, canReveal: false, ...shared, ...identified };
  }

  return {
    level,
    canReveal: true,
    scans: record.scans,
    ...shared,
    ...identified,
  };
}

/**
 * The JSON twin's body, for `/api/rid/[code]`.
 *
 * Dates become ISO strings and nothing else changes — the field **set** is
 * identical to the page's, which is the property F11 asserts. Building the JSON
 * from its own query is exactly the divergence this whole file exists to
 * prevent.
 */
export function toJsonBody(view: RedactedRemoteId): Record<string, unknown> {
  return JSON.parse(JSON.stringify(view)) as Record<string, unknown>;
}
