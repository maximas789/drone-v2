import type { BoundingBox, Geometry, Position } from "@/lib/geo";

/**
 * The vocabulary of the authorization engine. **Pure** — no database rows, no
 * Drizzle types, no `Date` objects.
 *
 * **Every instant in this file is an ISO string, never a `Date`.** The map
 * fetches its context as JSON and evaluates locally; the server evaluates the
 * same context inside the booking transaction. A `Date` survives one of those
 * two round trips and not the other, and the whole point of this module is that
 * the two cannot disagree. Conversion happens at the edges — `query.ts` on the
 * way in, `src/lib/format.ts` on the way out.
 */

export type ZoneKindValue = "permitted" | "restricted" | "no_fly";
export type ZoneStatusValue = "draft" | "active" | "suspended" | "archived";
export type BuildTypeValue = "commercial" | "self_built" | "fpv";
export type WeightClassValue = "micro" | "light" | "medium" | "heavy";
export type DroneStatusValue =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "revoked";
export type RemoteIdStatusValue = "active" | "suspended" | "retired";

/**
 * Heavier is a superset of lighter: a zone capped at `medium` accepts `micro`,
 * `light` and `medium`. Ordered here so the comparison is an index, not a chain
 * of `if`s that the next class added silently falls through.
 */
export const WEIGHT_CLASS_ORDER: readonly WeightClassValue[] = [
  "micro",
  "light",
  "medium",
  "heavy",
];

/** One opening window. **Weekday 0 = Sunday**, the Saudi week. */
export type ZoneWindow = {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Minutes from Riyadh-local midnight. A window never crosses midnight. */
  opensMinute: number;
  closesMinute: number;
};

/** A published closure — the NOTAM analogue. Human-authored, so paired text. */
export type ZoneClosureWindow = {
  startsAt: string;
  endsAt: string;
  reasonAr: string;
  reasonEn: string;
};

/**
 * Everything the engine needs to know about one zone, flattened out of the
 * `zone` row and its two child tables.
 *
 * `geometryVersion` travels with it because a decision records the version it
 * was made against — a polygon redrawn next year must not retroactively change
 * why a flight was authorised.
 */
export type ZoneRule = {
  id: string;
  code: string;
  kind: ZoneKindValue;
  status: ZoneStatusValue;
  nameAr: string;
  nameEn: string;

  geometry: Geometry;
  geometryVersion: number;
  bbox: BoundingBox;

  ceilingAglM: number | null;
  floorAglM: number;

  capacity: number;
  slotDurationMinutes: number;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  maxSlotsPerPilotPerDay: number;
  autoApprove: boolean;
  nightAllowed: boolean;

  maxWeightClass: WeightClassValue | null;
  /** `null` means "no restriction stated", not "none permitted". */
  permittedBuildTypes: readonly BuildTypeValue[] | null;
  requiresBroadcastRid: boolean;

  hours: readonly ZoneWindow[];
  closures: readonly ZoneClosureWindow[];
};

/**
 * A Remote ID declaration reduced to the four facts that decide capability.
 *
 * **The rows travel, not the `remote_id.broadcastCapable` boolean.** That flag
 * is a snapshot taken at write time: a declaration whose `validUntil` passes
 * overnight leaves it stale until the next write, and nothing sweeps it. A
 * booking is evaluated for a *future* instant, so the engine checks each
 * declaration's own window against the slot rather than trusting a boolean
 * computed at some earlier "now".
 */
export type DeclarationWindow = {
  verifiedAt: string | null;
  rejectedAt: string | null;
  supersededAt: string | null;
  validFrom: string | null;
  validUntil: string | null;
};

export type AircraftContext = {
  droneId: string;
  status: DroneStatusValue;
  buildType: BuildTypeValue;
  weightClass: WeightClassValue;
  registrationExpiresAt: string | null;
  remoteIdStatus: RemoteIdStatusValue | null;
  declarations: readonly DeclarationWindow[];
};

/**
 * `identityVerified` is set by a **human reviewer** and by nothing else. There
 * is no automatic path to it anywhere in this codebase.
 */
export type PilotContext = {
  profileComplete: boolean;
  identityVerified: boolean;
};

/** Seats already held in one slot. Keyed by the slot's ISO start. */
export type SlotUsage = {
  slotStart: string;
  taken: number;
};

/**
 * Everything the engine is allowed to know. Assembled by `query.ts` on the
 * server, or fetched as JSON by the map — the same shape either way.
 */
export type AirspaceContext = {
  /**
   * Candidate zones, already bbox pre-filtered in SQL. Over-selection is fine
   * and expected: containment is decided here.
   */
  zones: readonly ZoneRule[];
  aircraft?: AircraftContext | null;
  pilot?: PilotContext | null;
  /** Seats taken, for the day being looked at. One grouped query, never one per slot. */
  availability?: readonly SlotUsage[];
  /** ISO slot starts this pilot already holds, in any zone. */
  pilotBusySlots?: readonly string[];
  /** How many seat-holding bookings the pilot already has on the slot's Riyadh day. */
  pilotBookingsOnDay?: number;
};

export type AirspaceQuery = {
  /** `[lng, lat]`. A reversed pair is a type error, not a flight over water. */
  point?: Position;
  /**
   * Evaluate against a **named zone** rather than by containment.
   *
   * The booking form picks a zone, a date and a slot — it does not pick a
   * coordinate, and `booking` has no lat/lng column to put one in. A zone query
   * therefore answers "may this aircraft fly in this zone at this time", and the
   * no-fly overlays that a *point* query resolves cannot apply: there is no
   * point to test them against.
   *
   * **`point` wins when both are given.** The map always has a point; the
   * booking form never does.
   */
  zoneId?: string;
  /**
   * A drawn area. **Stricter than a point**: the whole area must sit inside one
   * permitted zone, and any intersection at all with a no-fly zone denies.
   */
  area?: Geometry;
  altitudeAglM?: number | null;
  slotStart?: string | null;
  slotEnd?: string | null;
  /** ISO. Passed in rather than read, so the same query replays identically. */
  now: string;
};

/**
 * The full set of refusal codes. Stable, machine-readable, bilingual only at
 * render — `airspace.reasons.<code>` and `airspace.fixes.<code>` in both
 * catalogues, which `reasons.test.ts` asserts and `i18n:check` keeps in sync.
 */
export const REASON_CODES = [
  "outside_permitted_zone",
  "inside_restricted_zone",
  "inside_no_fly_zone",
  "above_ceiling",
  "below_floor",
  "zone_suspended",
  "zone_closed_now",
  "zone_closed_window",
  "night_operation_not_permitted",
  "slot_full",
  "slot_not_on_grid",
  "slot_in_past",
  "booking_lead_time",
  "booking_too_far_ahead",
  "duplicate_booking",
  "max_slots_per_day",
  "drone_not_approved",
  "drone_registration_expired",
  "drone_revoked",
  "no_remote_id",
  "remote_id_not_active",
  "broadcast_rid_required",
  "build_type_not_permitted",
  "weight_class_not_permitted",
  "pilot_profile_incomplete",
  /**
   * Beyond F12's list. `requirePilotProfile` lets an unverified pilot use the
   * app and see where they stand; only booking needs a human to have checked
   * their identity, and that refusal is raised here rather than at the door.
   * Merging it into `pilot_profile_incomplete` would tell someone who has
   * filled in everything correctly that their profile is incomplete.
   */
  "identity_unverified",
  "rate_limited",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

/**
 * A refusal, and what would fix it.
 *
 * `params` renders `airspace.reasons.<code>`; `fixParams` renders
 * `airspace.fixes.<code>`. They are separate because the fix often needs a
 * value the refusal does not — `zone_closed_now` says nothing about a time,
 * and its fix names the next opening.
 *
 * **Numbers stay numbers here.** Formatting needs a locale, which a pure engine
 * does not have; `formatReasonParams` in `src/components/airspace/` puts every
 * one through `src/lib/format.ts` before it reaches ICU, which would otherwise
 * render Arabic-Indic digits under `ar`.
 */
export type Reason = {
  code: ReasonCode;
  params?: Record<string, string | number>;
  fixParams?: Record<string, string | number>;
  zoneId?: string;
  zoneNameAr?: string;
  zoneNameEn?: string;
};

export type MatchedZone = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  kind: ZoneKindValue;
  ceilingAglM: number | null;
};

export type SlotState = "available" | "full" | "closed" | "past" | "blocked";

export type Slot = {
  slotStart: string;
  slotEnd: string;
  state: SlotState;
  capacity: number;
  taken: number;
  remaining: number;
};

/**
 * `needs_review` is a third state, not a shade of one of the other two: the
 * query passes every rule but lands in a zone whose `autoApprove` is false. The
 * map must render it distinctly from both green and red, because "you may book
 * this, a human will decide" is a different promise from either.
 */
export type DecisionStatus = "allowed" | "denied" | "needs_review";

export type AirspaceDecision = {
  status: DecisionStatus;
  zone: MatchedZone | null;
  reasons: Reason[];
  /** ISO instant the zone next opens, when a time rule is what refused. */
  nextOpenAt: string | null;
  alternativeSlots: Slot[];
  evaluatedAt: string;
  /**
   * The matched zone's version, or `0` when no zone matched — captured into
   * `booking.decisionSnapshot` at approval so a later redraw cannot rewrite the
   * record of why a flight was authorised.
   */
  geometryVersion: number;
};
