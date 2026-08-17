import { findAlternativeSlots, isOnGrid } from "@/lib/booking/slots";
import type { Position } from "@/lib/geo";
import {
  areaIntersectsGeometry,
  areaWithinGeometry,
  zoneContainsPoint,
} from "./geometry";
import {
  isNightWindow,
  riyadhDaysBetween,
  riyadhParts,
  riyadhYmd,
  sunTimes,
} from "./time";
import {
  WEIGHT_CLASS_ORDER,
  type AirspaceContext,
  type AirspaceDecision,
  type AirspaceQuery,
  type DeclarationWindow,
  type MatchedZone,
  type Reason,
  type ReasonCode,
  type Slot,
  type ZoneRule,
} from "./types";

/**
 * **The one function that decides whether a flight may happen.**
 *
 * Pure by rule and by ESLint: no `@/lib/db`, no `server-only`, no `next-intl`,
 * no `react`. It runs in the map on every pan and click for instant feedback,
 * and again on the server inside the booking transaction where the answer is
 * authoritative. Same code, same context shape, so **the map can never promise
 * something the server then refuses** — which is the whole architectural point,
 * and the reason a second "is this bookable?" must never be written anywhere
 * else.
 *
 * Precedence:
 *
 * ```
 * no_fly  >  permitted  >  restricted  >  default-deny
 * ```
 */

export function evaluateAirspace(
  query: AirspaceQuery,
  context: AirspaceContext,
): AirspaceDecision {
  const now = new Date(query.now);
  const reasons: Reason[] = [];

  /**
   * **Eligibility does not short-circuit.** The geometry runs even for a pilot
   * whose registration has expired, so the map can still show them *where* they
   * could fly once it is renewed. A screen that says only "your profile is
   * incomplete" over a blank map is a worse product than one that answers both
   * questions at once.
   */
  reasons.push(...eligibilityReasons(query, context));

  const matched = matchZone(query, context);

  if (matched.noFly) {
    // Terminal for geometry: a no-fly zone beats a permitted carve-out inside
    // it, and there is no exception to offer.
    reasons.push(zoneReason("inside_no_fly_zone", matched.noFly));
    return decide(reasons, matched.noFly, null, [], query.now);
  }

  const zone = matched.permitted;
  if (!zone) {
    const restricted = matched.restricted;
    reasons.push(
      restricted
        ? zoneReason("inside_restricted_zone", restricted)
        : { code: "outside_permitted_zone" },
    );
    return decide(reasons, restricted ?? null, null, [], query.now);
  }

  if (zone.status === "suspended") {
    reasons.push(zoneReason("zone_suspended", zone));
  }

  reasons.push(...altitudeReasons(query, zone));
  reasons.push(...aircraftZoneReasons(query, context, zone));

  const timing = timeReasons(query, context, zone, now);
  reasons.push(...timing.reasons);

  return decide(reasons, zone, timing.nextOpenAt, timing.alternatives, query.now);
}

// --- Eligibility ----------------------------------------------------------

function eligibilityReasons(
  query: AirspaceQuery,
  context: AirspaceContext,
): Reason[] {
  const reasons: Reason[] = [];
  const { pilot, aircraft } = context;

  if (pilot) {
    if (!pilot.profileComplete) {
      reasons.push({ code: "pilot_profile_incomplete" });
    } else if (!pilot.identityVerified) {
      /**
       * A **human reviewer** verifies identity, and nothing in this app does it
       * automatically. Separate from "incomplete" because telling somebody who
       * filled in every field correctly that their profile is incomplete sends
       * them back to a form with nothing left to do.
       */
      reasons.push({ code: "identity_unverified" });
    }
  }

  // No aircraft selected is the ordinary case for a map probe: the pilot is
  // asking about the airspace, not about a particular airframe.
  if (!aircraft) return reasons;

  if (aircraft.status === "revoked") {
    reasons.push({ code: "drone_revoked" });
  } else if (aircraft.status === "expired") {
    reasons.push({ code: "drone_registration_expired" });
  } else if (aircraft.status !== "approved") {
    reasons.push({ code: "drone_not_approved" });
  }

  /**
   * The registration must still be valid when the flight **ends**, not when it
   * is booked. A slot that starts an hour before expiry and runs past it is a
   * flight that finishes unregistered.
   */
  const until = query.slotEnd ?? query.slotStart ?? query.now;
  if (
    aircraft.status === "approved" &&
    aircraft.registrationExpiresAt !== null &&
    Date.parse(aircraft.registrationExpiresAt) <= Date.parse(until)
  ) {
    reasons.push({ code: "drone_registration_expired" });
  }

  if (aircraft.remoteIdStatus === null) {
    reasons.push({ code: "no_remote_id" });
  } else if (aircraft.remoteIdStatus !== "active") {
    reasons.push({ code: "remote_id_not_active" });
  }

  return reasons;
}

/**
 * Broadcast capability **at an instant**, computed from the declaration rows.
 *
 * `remote_id.broadcastCapable` is deliberately not consulted: it is a snapshot
 * taken whenever a declaration was last written, and a module whose `validUntil`
 * passes overnight leaves it stale with nothing sweeping it. A booking is a
 * question about a *future* moment, and only the rows can answer that.
 */
export function broadcastCapableAt(
  declarations: readonly DeclarationWindow[],
  instant: Date,
): boolean {
  const at = instant.getTime();
  return declarations.some(
    (declaration) =>
      declaration.verifiedAt !== null &&
      declaration.rejectedAt === null &&
      declaration.supersededAt === null &&
      (declaration.validFrom === null ||
        Date.parse(declaration.validFrom) <= at) &&
      (declaration.validUntil === null ||
        Date.parse(declaration.validUntil) > at),
  );
}

// --- Geometry -------------------------------------------------------------

type ZoneMatch = {
  noFly: ZoneRule | null;
  permitted: ZoneRule | null;
  restricted: ZoneRule | null;
};

/**
 * Containment, in precedence order.
 *
 * For a **point**, containment is containment. For a drawn **area** the rule is
 * asymmetric on purpose: it must fit *entirely* inside one permitted zone, and
 * merely *touching* a no-fly zone denies. Half an area over a restricted
 * boundary is not half a permission.
 */
function matchZone(query: AirspaceQuery, context: AirspaceContext): ZoneMatch {
  const match: ZoneMatch = { noFly: null, permitted: null, restricted: null };

  // Stable ordering, so two evaluations of the same overlap name the same zone.
  const zones = [...context.zones].sort((a, b) => a.code.localeCompare(b.code));

  /**
   * A zone query names its zone. Containment cannot be tested — there is no
   * coordinate — so the overlays are out of reach and the published zone is
   * taken at its word. The booking action sends a `point` whenever it has one
   * for exactly this reason.
   */
  if (!query.point && !query.area && query.zoneId) {
    const named = zones.find((zone) => zone.id === query.zoneId);
    if (!named || named.status === "draft" || named.status === "archived") {
      return match;
    }
    if (named.kind === "no_fly") return { ...match, noFly: named };
    if (named.kind === "permitted") return { ...match, permitted: named };
    return { ...match, restricted: named };
  }

  for (const zone of zones) {
    if (zone.status === "draft" || zone.status === "archived") continue;

    const hit = query.area
      ? zone.kind === "permitted"
        ? areaWithinGeometry(query.area, zone.geometry)
        : areaIntersectsGeometry(query.area, zone.geometry)
      : query.point
        ? zoneContainsPoint(zone, query.point)
        : false;

    if (!hit) continue;

    if (zone.kind === "no_fly") {
      match.noFly ??= zone;
    } else if (zone.kind === "permitted") {
      match.permitted ??= zone;
    } else {
      match.restricted ??= zone;
    }
  }

  return match;
}

// --- Zone rules -----------------------------------------------------------

function altitudeReasons(query: AirspaceQuery, zone: ZoneRule): Reason[] {
  const requested = query.altitudeAglM;
  if (requested === null || requested === undefined) return [];

  if (zone.ceilingAglM !== null && requested > zone.ceilingAglM) {
    return [
      {
        ...zoneReason("above_ceiling", zone),
        params: { requested, ceiling: zone.ceilingAglM },
        fixParams: { ceiling: zone.ceilingAglM },
      },
    ];
  }
  if (requested < zone.floorAglM) {
    return [
      {
        ...zoneReason("below_floor", zone),
        params: { requested, floor: zone.floorAglM },
        fixParams: { floor: zone.floorAglM },
      },
    ];
  }
  return [];
}

function aircraftZoneReasons(
  query: AirspaceQuery,
  context: AirspaceContext,
  zone: ZoneRule,
): Reason[] {
  const aircraft = context.aircraft;
  if (!aircraft) return [];

  const reasons: Reason[] = [];

  if (
    zone.permittedBuildTypes !== null &&
    !zone.permittedBuildTypes.includes(aircraft.buildType)
  ) {
    reasons.push(zoneReason("build_type_not_permitted", zone));
  }

  if (zone.maxWeightClass !== null) {
    const allowed = WEIGHT_CLASS_ORDER.indexOf(zone.maxWeightClass);
    const actual = WEIGHT_CLASS_ORDER.indexOf(aircraft.weightClass);
    if (actual > allowed) {
      reasons.push(zoneReason("weight_class_not_permitted", zone));
    }
  }

  if (zone.requiresBroadcastRid) {
    // The instant that matters is the flight's, not this request's.
    const at = new Date(query.slotStart ?? query.now);
    if (!broadcastCapableAt(aircraft.declarations, at)) {
      reasons.push(zoneReason("broadcast_rid_required", zone));
    }
  }

  return reasons;
}

// --- Time -----------------------------------------------------------------

type TimeOutcome = {
  reasons: Reason[];
  nextOpenAt: string | null;
  alternatives: Slot[];
};

function timeReasons(
  query: AirspaceQuery,
  context: AirspaceContext,
  zone: ZoneRule,
  now: Date,
): TimeOutcome {
  if (!query.slotStart) {
    return { reasons: [], nextOpenAt: null, alternatives: [] };
  }

  const reasons: Reason[] = [];
  const start = new Date(query.slotStart);
  const end = query.slotEnd
    ? new Date(query.slotEnd)
    : new Date(start.getTime() + zone.slotDurationMinutes * 60_000);

  if (start.getTime() <= now.getTime()) {
    reasons.push({ code: "slot_in_past" });
  } else if (
    start.getTime() - now.getTime() <
    zone.minLeadMinutes * 60_000
  ) {
    const hours = zone.minLeadMinutes / 60;
    reasons.push({
      ...zoneReason("booking_lead_time", zone),
      params: { hours },
      fixParams: { hours },
    });
  }

  if (riyadhDaysBetween(now, start) > zone.maxAdvanceDays) {
    reasons.push({
      ...zoneReason("booking_too_far_ahead", zone),
      params: { days: zone.maxAdvanceDays },
      fixParams: { days: zone.maxAdvanceDays },
    });
  }

  /**
   * Two different refusals, and the difference is worth keeping. *Outside
   * operating hours* is a fact about the zone and the answer is a time — which
   * is why `zone_closed_now` is the one reason that carries `nextOpenAt`.
   * *Not on the grid* is a fact about the request: the window is open, but
   * 06:07 is not a slot anchor. Only a hand-made POST reaches the second, and
   * telling it the zone is closed would be a lie.
   */
  const parts = riyadhParts(start);
  const endMinutes =
    parts.minutesOfDay + (end.getTime() - start.getTime()) / 60_000;
  const insideOpeningWindow = zone.hours.some(
    (window) =>
      window.weekday === parts.weekday &&
      parts.minutesOfDay >= window.opensMinute &&
      endMinutes <= window.closesMinute,
  );

  if (!insideOpeningWindow) {
    reasons.push(zoneReason("zone_closed_now", zone));
  } else if (!isOnGrid(zone, zone.hours, query.slotStart)) {
    reasons.push(zoneReason("slot_not_on_grid", zone));
  }

  const closure = zone.closures.find(
    (window) =>
      Date.parse(window.startsAt) < end.getTime() &&
      Date.parse(window.endsAt) > start.getTime(),
  );
  if (closure) {
    reasons.push({
      ...zoneReason("zone_closed_window", zone),
      params: { reasonAr: closure.reasonAr, reasonEn: closure.reasonEn },
    });
  }

  if (!zone.nightAllowed) {
    const [lng, lat] = zoneCentre(zone);
    if (isNightWindow(start, end, lat, lng)) {
      const { sunrise, sunset } = sunTimes(riyadhYmd(start), lat, lng);
      reasons.push({
        ...zoneReason("night_operation_not_permitted", zone),
        params: {
          sunrise: sunrise.toISOString(),
          sunset: sunset.toISOString(),
        },
      });
    }
  }

  if (context.pilotBusySlots?.includes(query.slotStart)) {
    reasons.push({ code: "duplicate_booking" });
  }

  if (
    context.pilotBookingsOnDay !== undefined &&
    context.pilotBookingsOnDay >= zone.maxSlotsPerPilotPerDay
  ) {
    reasons.push({
      code: "max_slots_per_day",
      params: { max: zone.maxSlotsPerPilotPerDay },
    });
  }

  const usage = context.availability?.find(
    (row) => row.slotStart === query.slotStart,
  );
  if (usage && usage.taken >= zone.capacity) {
    reasons.push(zoneReason("slot_full", zone));
  }

  const nextOpenAt = reasons.some((reason) => TIME_CODES.has(reason.code))
    ? nextOpening(zone, context, now, start)
    : null;

  return {
    reasons: withNextOpenFix(reasons, nextOpenAt),
    nextOpenAt,
    alternatives: nextOpenAt
      ? findAlternativeSlots({
          zone,
          hours: zone.hours,
          closures: zone.closures,
          availability: context.availability,
          now,
          fromYmd: riyadhYmd(start),
          maxDays: zone.maxAdvanceDays,
          after: new Date(now.getTime() + zone.minLeadMinutes * 60_000),
          pilotBusySlots: context.pilotBusySlots,
          pilotBookingsOnDay: context.pilotBookingsOnDay,
          maxSlotsPerPilotPerDay: zone.maxSlotsPerPilotPerDay,
        })
      : [],
  };
}

/** The refusals a different *time* would fix. Anything else, and offering one would be noise. */
const TIME_CODES = new Set<ReasonCode>([
  "zone_closed_now",
  "zone_closed_window",
  "night_operation_not_permitted",
  "slot_full",
  "slot_not_on_grid",
  "slot_in_past",
  "booking_lead_time",
  "duplicate_booking",
  "max_slots_per_day",
]);

/**
 * The next instant this zone opens: the first grid slot, on any day forward,
 * that is neither closed nor already past. It is returned as an ISO instant and
 * formatted at render — the engine has no locale and must never acquire one.
 */
function nextOpening(
  zone: ZoneRule,
  context: AirspaceContext,
  now: Date,
  from: Date,
): string | null {
  const [next] = findAlternativeSlots({
    zone,
    hours: zone.hours,
    closures: zone.closures,
    availability: context.availability,
    now,
    count: 1,
    fromYmd: riyadhYmd(from < now ? now : from),
    maxDays: zone.maxAdvanceDays,
    after: new Date(now.getTime() + zone.minLeadMinutes * 60_000),
  });
  return next?.slotStart ?? null;
}

/** `airspace.fixes.zone_closed_now` names the next opening; nothing else does. */
function withNextOpenFix(reasons: Reason[], nextOpenAt: string | null): Reason[] {
  if (!nextOpenAt) return reasons;
  return reasons.map((reason) =>
    reason.code === "zone_closed_now"
      ? { ...reason, fixParams: { ...reason.fixParams, nextOpen: nextOpenAt } }
      : reason,
  );
}

// --- Assembly -------------------------------------------------------------

function zoneCentre(zone: ZoneRule): Position {
  return [
    (zone.bbox.minLng + zone.bbox.maxLng) / 2,
    (zone.bbox.minLat + zone.bbox.maxLat) / 2,
  ];
}

function zoneReason(code: ReasonCode, zone: ZoneRule): Reason {
  return {
    code,
    zoneId: zone.id,
    zoneNameAr: zone.nameAr,
    zoneNameEn: zone.nameEn,
  };
}

function matchedZoneOf(zone: ZoneRule | null): MatchedZone | null {
  if (!zone) return null;
  return {
    id: zone.id,
    code: zone.code,
    nameAr: zone.nameAr,
    nameEn: zone.nameEn,
    kind: zone.kind,
    ceilingAglM: zone.ceilingAglM,
  };
}

function decide(
  reasons: Reason[],
  zone: ZoneRule | null,
  nextOpenAt: string | null,
  alternatives: Slot[],
  evaluatedAt: string,
): AirspaceDecision {
  /**
   * Three states, never two. `needs_review` is what a zone with
   * `autoApprove: false` returns when nothing else refused — "you may request
   * this, a human decides" is a different answer from both yes and no, and the
   * map has to render it as one.
   */
  const status =
    reasons.length > 0
      ? "denied"
      : zone && zone.kind === "permitted" && !zone.autoApprove
        ? "needs_review"
        : "allowed";

  return {
    status,
    zone: matchedZoneOf(zone),
    reasons,
    nextOpenAt,
    alternativeSlots: alternatives,
    evaluatedAt,
    geometryVersion: zone?.geometryVersion ?? 0,
  };
}
