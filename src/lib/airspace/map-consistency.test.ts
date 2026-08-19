import { describe, expect, it } from "vitest";
import type { Geometry, Position } from "@/lib/geo";
import { computeBbox } from "@/lib/geo/bbox";
import { slotInstants } from "@/lib/maps/probe";
import { STANDARD_HOURS } from "@/lib/seed/zone-hours";
import { evaluateAirspace } from "./evaluate";
import { riyadhInstant } from "./time";
import type {
  AircraftContext,
  AirspaceContext,
  AirspaceDecision,
  ReasonCode,
  ZoneRule,
  ZoneWindow,
} from "./types";

/**
 * **The map and the booking flow must give the same answer.**
 *
 * F20's headline claim is that a point the map shows green is accepted by
 * `createBooking`, and a point it shows red is refused *with the same reason
 * code*. That claim is architectural — there is one `evaluateAirspace` and both
 * paths call it — but "we only wrote it once" is not the same as "the two
 * callers pass equivalent arguments", and it is the arguments that drift.
 *
 * So this suite runs the two **query shapes** side by side over one context:
 *
 * - the map's, which is a `point` plus the controls' altitude and slot;
 * - `createBookingAction`'s, which is a `zoneId` plus the same altitude and slot,
 *   because a `booking` row has no coordinate to carry.
 *
 * It also pins the **one place they cannot agree**, which is a property of the
 * data and not a bug in either: a zone query names its zone, so no-fly overlays
 * are out of its reach. That asymmetry is recorded here rather than left to be
 * rediscovered, because the safe direction is the one it happens to take —
 * the map is *stricter*, so it never promises what booking would refuse.
 */

/** 2026-03-15 is a Sunday — weekday 0, the Saudi week's first day. */
const SUNDAY = "2026-03-15";

const SEEDED_HOURS: ZoneWindow[] = STANDARD_HOURS.map((hour) => ({
  weekday: hour.weekday,
  opensMinute: hour.opensMinute,
  closesMinute: hour.closesMinute,
}));

const PERMITTED_AREA: Geometry = {
  type: "Polygon",
  coordinates: [
    [
      [46.5, 24.6],
      [46.7, 24.6],
      [46.7, 24.8],
      [46.5, 24.8],
      [46.5, 24.6],
    ],
  ],
};

/** A small no-fly box sitting **inside** the permitted zone above. */
const NO_FLY_AREA: Geometry = {
  type: "Polygon",
  coordinates: [
    [
      [46.62, 24.72],
      [46.66, 24.72],
      [46.66, 24.76],
      [46.62, 24.76],
      [46.62, 24.72],
    ],
  ],
};

const CLEAR_POINT: Position = [46.55, 24.65];
const OVERLAY_POINT: Position = [46.64, 24.74];

function permittedZone(overrides: Partial<ZoneRule> = {}): ZoneRule {
  return {
    id: "zone-permitted",
    code: "TST-P-01",
    kind: "permitted",
    status: "active",
    nameAr: "منطقة الاختبار",
    nameEn: "Test Zone",
    geometry: PERMITTED_AREA,
    geometryVersion: 3,
    bbox: computeBbox(PERMITTED_AREA),
    ceilingAglM: 120,
    floorAglM: 0,
    capacity: 3,
    slotDurationMinutes: 120,
    minLeadMinutes: 60,
    maxAdvanceDays: 14,
    maxSlotsPerPilotPerDay: 2,
    autoApprove: true,
    nightAllowed: false,
    maxWeightClass: "medium",
    permittedBuildTypes: ["commercial", "self_built", "fpv"],
    requiresBroadcastRid: false,
    hours: SEEDED_HOURS,
    closures: [],
    ...overrides,
  };
}

const NO_FLY_ZONE: ZoneRule = permittedZone({
  id: "zone-no-fly",
  code: "TST-NF-01",
  kind: "no_fly",
  nameEn: "Test No-fly",
  geometry: NO_FLY_AREA,
  bbox: computeBbox(NO_FLY_AREA),
  ceilingAglM: 0,
  hours: [],
});

const AIRCRAFT: AircraftContext = {
  droneId: "drone-1",
  status: "approved",
  buildType: "self_built",
  weightClass: "light",
  registrationExpiresAt: "2029-01-01T00:00:00.000Z",
  remoteIdStatus: "active",
  declarations: [],
};

/**
 * The whole point of the exercise: the two callers get the **same context**.
 * If this function ever grew a parameter that changed between them, the suite
 * would be proving nothing.
 */
function context(zones: readonly ZoneRule[]): AirspaceContext {
  return {
    zones,
    aircraft: AIRCRAFT,
    pilot: { profileComplete: true, identityVerified: true },
  };
}

/** Well before the Sunday morning window, so `now` never falls inside a slot. */
const NOW = riyadhInstant(SUNDAY, 0).toISOString();

/**
 * The map's query: a tapped point, the altitude slider, and the day/time selects
 * turned into instants by the **same** `slotInstants` the controls use.
 */
function fromMap(
  zones: readonly ZoneRule[],
  point: Position,
  altitudeAglM: number,
  minuteOfDay: number,
): AirspaceDecision {
  const slot = slotInstants(SUNDAY, minuteOfDay, 120);
  return evaluateAirspace(
    { point, altitudeAglM, slotStart: slot.slotStart, slotEnd: slot.slotEnd, now: NOW },
    context(zones),
  );
}

/**
 * `createBookingAction`'s query: the zone by id, and the slot end derived from
 * the zone's own `slotDurationMinutes` — which is what that action does.
 */
function fromBooking(
  zones: readonly ZoneRule[],
  zoneId: string,
  altitudeAglM: number,
  minuteOfDay: number,
): AirspaceDecision {
  const slot = slotInstants(SUNDAY, minuteOfDay, 120);
  return evaluateAirspace(
    { zoneId, altitudeAglM, slotStart: slot.slotStart, slotEnd: slot.slotEnd, now: NOW },
    context(zones),
  );
}

const codes = (decision: AirspaceDecision): ReasonCode[] =>
  decision.reasons.map((reason) => reason.code).sort();

/**
 * 15:00 — the first anchor of the seeded **afternoon** window, and chosen over
 * the 06:00 morning anchor for a reason worth recording: on 15 March, sunrise in
 * Riyadh is 06:04, so a 06:00 slot begins four minutes before dawn and every
 * case would carry `night_operation_not_permitted` as well as whatever it was
 * meant to test. The engine is right; the fixture was wrong.
 */
const OPEN_ANCHOR = 15 * 60;

describe("the map and createBooking agree", () => {
  it("green on the map is accepted by the booking query", () => {
    const zones = [permittedZone()];
    const map = fromMap(zones, CLEAR_POINT, 100, OPEN_ANCHOR);
    const booking = fromBooking(zones, "zone-permitted", 100, OPEN_ANCHOR);

    expect(map.status).toBe("allowed");
    expect(booking.status).toBe("allowed");
    expect(codes(booking)).toEqual(codes(map));
  });

  it("amber on the map is amber at booking — needs_review survives the round trip", () => {
    const zones = [permittedZone({ autoApprove: false })];
    const map = fromMap(zones, CLEAR_POINT, 100, OPEN_ANCHOR);
    const booking = fromBooking(zones, "zone-permitted", 100, OPEN_ANCHOR);

    expect(map.status).toBe("needs_review");
    expect(booking.status).toBe("needs_review");
  });

  /**
   * The reason code, not merely the colour. A pilot who is told "above the
   * ceiling" on the map and then "not permitted" at booking has been told two
   * different things about one flight.
   */
  it.each<[string, Partial<ZoneRule>, number, number, ReasonCode]>([
    ["above the ceiling", {}, 400, OPEN_ANCHOR, "above_ceiling"],
    ["outside opening hours", {}, 100, 3 * 60, "zone_closed_now"],
    ["off the slot grid", {}, 100, 15 * 60 + 30, "slot_not_on_grid"],
    [
      "too heavy for the zone",
      { maxWeightClass: "micro" },
      100,
      OPEN_ANCHOR,
      "weight_class_not_permitted",
    ],
    [
      "the wrong build type",
      { permittedBuildTypes: ["commercial"] },
      100,
      OPEN_ANCHOR,
      "build_type_not_permitted",
    ],
    ["a suspended zone", { status: "suspended" }, 100, OPEN_ANCHOR, "zone_suspended"],
  ])(
    "red on the map is red at booking, with the same code: %s",
    (_label, overrides, altitude, minute, expected) => {
      const zones = [permittedZone(overrides)];
      const map = fromMap(zones, CLEAR_POINT, altitude, minute);
      const booking = fromBooking(zones, "zone-permitted", altitude, minute);

      expect(map.status).toBe("denied");
      expect(booking.status).toBe("denied");
      expect(codes(map)).toContain(expected);
      expect(codes(booking)).toEqual(codes(map));
    },
  );

  it("carries the same zone and the same geometryVersion into the snapshot", () => {
    const zones = [permittedZone()];
    const map = fromMap(zones, CLEAR_POINT, 100, OPEN_ANCHOR);
    const booking = fromBooking(zones, "zone-permitted", 100, OPEN_ANCHOR);

    expect(booking.zone?.id).toBe(map.zone?.id);
    expect(booking.geometryVersion).toBe(map.geometryVersion);
  });

  /**
   * **The asymmetry, pinned.**
   *
   * A `booking` row has no coordinate, so `createBookingAction` asks about a
   * *zone* — and a zone query cannot test containment, so the no-fly overlay
   * inside this permitted zone is invisible to it. The map, which always has a
   * point, sees it and refuses.
   *
   * The direction matters and is the safe one: **the map is stricter**, so it
   * never shows green where booking would refuse. The inverse — booking
   * accepting a flight the map called no-fly — is real, and it is why F23's zone
   * editor must not be allowed to publish a permitted zone overlapping a no-fly
   * one, and why a booking form built on this map should carry the point
   * forward rather than only the zone.
   */
  it("differs only where a zone query has no point to test: the no-fly overlay", () => {
    const zones = [permittedZone(), NO_FLY_ZONE];

    const map = fromMap(zones, OVERLAY_POINT, 100, OPEN_ANCHOR);
    expect(map.status).toBe("denied");
    expect(codes(map)).toContain("inside_no_fly_zone");

    const booking = fromBooking(zones, "zone-permitted", 100, OPEN_ANCHOR);
    expect(booking.status).toBe("allowed");
  });

  it("but a point in the same zone away from the overlay still agrees", () => {
    const zones = [permittedZone(), NO_FLY_ZONE];
    const map = fromMap(zones, CLEAR_POINT, 100, OPEN_ANCHOR);
    const booking = fromBooking(zones, "zone-permitted", 100, OPEN_ANCHOR);

    expect(map.status).toBe("allowed");
    expect(codes(booking)).toEqual(codes(map));
  });

  /**
   * The map's local pass runs without `availability`, `pilotBusySlots` or
   * `pilotBookingsOnDay` — facts about other people's bookings that no browser
   * should hold. Every reason those three produce is a *refusal*, so their
   * absence can only make the local answer more permissive, never less. That is
   * the invariant the panel's "confirming" state rests on, so it is asserted
   * rather than assumed.
   */
  it("is only ever more permissive without the booking-load context, never less", () => {
    const zones = [permittedZone()];
    const withoutLoad = fromMap(zones, CLEAR_POINT, 100, OPEN_ANCHOR);

    const slot = slotInstants(SUNDAY, OPEN_ANCHOR, 120);
    const withLoad = evaluateAirspace(
      {
        point: CLEAR_POINT,
        altitudeAglM: 100,
        slotStart: slot.slotStart,
        slotEnd: slot.slotEnd,
        now: NOW,
      },
      {
        ...context(zones),
        availability: [{ slotStart: slot.slotStart, taken: 3 }],
        pilotBusySlots: [slot.slotStart],
        pilotBookingsOnDay: 2,
      },
    );

    expect(withoutLoad.status).toBe("allowed");
    expect(withLoad.status).toBe("denied");
    // Every reason the fuller context adds is an addition, never a removal.
    for (const code of codes(withoutLoad)) {
      expect(codes(withLoad)).toContain(code);
    }
    expect(codes(withLoad)).toEqual(
      expect.arrayContaining(["duplicate_booking", "max_slots_per_day", "slot_full"]),
    );
  });
});
