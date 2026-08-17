import { describe, expect, it } from "vitest";
import type { Geometry } from "@/lib/geo";
import { computeBbox } from "@/lib/geo/bbox";
import { STANDARD_HOURS } from "@/lib/seed/zone-hours";
import { broadcastCapableAt, evaluateAirspace } from "./evaluate";
import { riyadhInstant } from "./time";
import type {
  AircraftContext,
  AirspaceContext,
  AirspaceQuery,
  DeclarationWindow,
  ReasonCode,
  ZoneRule,
  ZoneWindow,
} from "./types";

/** 2026-03-15 is a Sunday — weekday 0. */
const SUNDAY = "2026-03-15";
const at = (hour: number, minute = 0) =>
  riyadhInstant(SUNDAY, hour * 60 + minute).toISOString();

const SEEDED_HOURS: ZoneWindow[] = STANDARD_HOURS.map((hour) => ({
  weekday: hour.weekday,
  opensMinute: hour.opensMinute,
  closesMinute: hour.closesMinute,
}));

const SQUARE: Geometry = {
  type: "Polygon",
  coordinates: [
    [
      [46.5, 24.6],
      [46.6, 24.6],
      [46.6, 24.7],
      [46.5, 24.7],
      [46.5, 24.6],
    ],
  ],
};

const INSIDE: [number, number] = [46.55, 24.65];
const OUTSIDE: [number, number] = [47.9, 24.65];

function zoneRule(overrides: Partial<ZoneRule> = {}): ZoneRule {
  return {
    id: "zone-1",
    code: "TST-P-01",
    kind: "permitted",
    status: "active",
    nameAr: "منطقة الاختبار",
    nameEn: "Test Zone",
    geometry: SQUARE,
    geometryVersion: 7,
    bbox: computeBbox(SQUARE),
    ceilingAglM: 120,
    floorAglM: 0,
    capacity: 3,
    slotDurationMinutes: 60,
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

function aircraft(overrides: Partial<AircraftContext> = {}): AircraftContext {
  return {
    droneId: "drone-1",
    status: "approved",
    buildType: "fpv",
    weightClass: "light",
    registrationExpiresAt: "2029-01-01T00:00:00.000Z",
    remoteIdStatus: "active",
    declarations: [],
    ...overrides,
  };
}

/** A query for the 08:00 slot on the Sunday, decided at 06:00 the same day. */
function query(overrides: Partial<AirspaceQuery> = {}): AirspaceQuery {
  return {
    point: INSIDE,
    altitudeAglM: 100,
    slotStart: at(8),
    slotEnd: at(9),
    now: at(6),
    ...overrides,
  };
}

function context(overrides: Partial<AirspaceContext> = {}): AirspaceContext {
  return {
    zones: [zoneRule()],
    pilot: { profileComplete: true, identityVerified: true },
    aircraft: aircraft(),
    availability: [],
    pilotBusySlots: [],
    pilotBookingsOnDay: 0,
    ...overrides,
  };
}

const codes = (decision: { reasons: { code: ReasonCode }[] }) =>
  decision.reasons.map((reason) => reason.code);

describe("a clean booking", () => {
  it("is allowed, and carries the zone's geometry version", () => {
    const decision = evaluateAirspace(query(), context());
    expect(decision.status).toBe("allowed");
    expect(decision.reasons).toEqual([]);
    expect(decision.zone?.code).toBe("TST-P-01");
    expect(decision.geometryVersion).toBe(7);
    expect(decision.evaluatedAt).toBe(at(6));
  });

  it("needs review in a zone that does not auto-approve", () => {
    /**
     * Three states, not two. "You may request this, a human decides" is a
     * different answer from both yes and no, and the map has to say so.
     */
    const decision = evaluateAirspace(
      query(),
      context({ zones: [zoneRule({ autoApprove: false })] }),
    );
    expect(decision.status).toBe("needs_review");
    expect(decision.reasons).toEqual([]);
  });
});

describe("altitude", () => {
  it("refuses above the ceiling and names it in the fix", () => {
    const decision = evaluateAirspace(
      query({ altitudeAglM: 150 }),
      context(),
    );
    expect(codes(decision)).toContain("above_ceiling");
    const reason = decision.reasons.find(
      (candidate) => candidate.code === "above_ceiling",
    );
    expect(reason?.params).toEqual({ requested: 150, ceiling: 120 });
    expect(reason?.fixParams).toEqual({ ceiling: 120 });
    expect(reason?.zoneNameAr).toBe("منطقة الاختبار");
  });

  it("refuses below the floor", () => {
    const decision = evaluateAirspace(
      query({ altitudeAglM: 5 }),
      context({ zones: [zoneRule({ floorAglM: 20 })] }),
    );
    expect(codes(decision)).toContain("below_floor");
  });

  it("says nothing about altitude when none was given", () => {
    const decision = evaluateAirspace(query({ altitudeAglM: null }), context());
    expect(decision.status).toBe("allowed");
  });
});

describe("hours and closures", () => {
  it("refuses a slot outside operating hours, with a next opening", () => {
    /**
     * 13:00 sits in the closed middle of the day, between the morning and
     * afternoon windows.
     *
     * `nextOpenAt` is the **soonest slot that would work from now**, not the
     * next window after the time that was asked for. Deciding at 06:00, that is
     * 07:00 this morning rather than 15:00 this afternoon — the pilot wanted to
     * fly today and the earlier answer is the more useful one. It is also the
     * same floor `alternativeSlots` uses, so the sentence and the buttons under
     * it can never disagree.
     */
    const decision = evaluateAirspace(
      query({ slotStart: at(13), slotEnd: at(14) }),
      context(),
    );
    expect(codes(decision)).toContain("zone_closed_now");
    expect(decision.nextOpenAt).toBe(at(7));

    const reason = decision.reasons.find(
      (candidate) => candidate.code === "zone_closed_now",
    );
    expect(reason?.fixParams?.nextOpen).toBe(at(7));
  });

  it("moves to the afternoon window once the morning one has gone", () => {
    const decision = evaluateAirspace(
      query({ slotStart: at(13), slotEnd: at(14), now: at(12) }),
      context(),
    );
    expect(decision.nextOpenAt).toBe(at(15));
  });

  it("moves to the next day once every window has gone", () => {
    const decision = evaluateAirspace(
      query({ slotStart: at(21), slotEnd: at(22), now: at(20) }),
      context(),
    );
    expect(decision.nextOpenAt).toBe(
      riyadhInstant("2026-03-16", 6 * 60).toISOString(),
    );
  });

  it("separates a time that is not on the grid from a closed zone", () => {
    const decision = evaluateAirspace(
      query({ slotStart: at(8, 7), slotEnd: at(9, 7) }),
      context(),
    );
    expect(codes(decision)).toContain("slot_not_on_grid");
    expect(codes(decision)).not.toContain("zone_closed_now");
  });

  it("refuses a slot inside a published closure, and carries the bilingual reason", () => {
    const decision = evaluateAirspace(
      query(),
      context({
        zones: [
          zoneRule({
            closures: [
              {
                startsAt: at(7),
                endsAt: at(10),
                reasonAr: "مهرجان الجنادرية",
                reasonEn: "Janadriyah festival",
              },
            ],
          }),
        ],
      }),
    );
    expect(codes(decision)).toContain("zone_closed_window");
    const reason = decision.reasons.find(
      (candidate) => candidate.code === "zone_closed_window",
    );
    expect(reason?.params).toEqual({
      reasonAr: "مهرجان الجنادرية",
      reasonEn: "Janadriyah festival",
    });
    // The next opening skips the whole closure rather than offering 09:00.
    expect(decision.nextOpenAt).toBe(at(10));
  });

  it("refuses a night operation where the zone forbids one", () => {
    // 17:00–18:00 in March: sunset is about 18:07, so this is daylight.
    expect(
      evaluateAirspace(
        query({ slotStart: at(17), slotEnd: at(18) }),
        context(),
      ).status,
    ).toBe("allowed");

    // The Thursday evening window runs to 20:00, well past sunset.
    const thursday = riyadhInstant("2026-03-19", 19 * 60).toISOString();
    const decision = evaluateAirspace(
      query({
        slotStart: thursday,
        slotEnd: riyadhInstant("2026-03-19", 20 * 60).toISOString(),
        now: riyadhInstant("2026-03-19", 6 * 60).toISOString(),
      }),
      context(),
    );
    expect(codes(decision)).toContain("night_operation_not_permitted");
  });

  it("permits it where the zone allows night flight", () => {
    const decision = evaluateAirspace(
      query({
        slotStart: riyadhInstant("2026-03-19", 19 * 60).toISOString(),
        slotEnd: riyadhInstant("2026-03-19", 20 * 60).toISOString(),
        now: riyadhInstant("2026-03-19", 6 * 60).toISOString(),
      }),
      context({ zones: [zoneRule({ nightAllowed: true })] }),
    );
    expect(codes(decision)).not.toContain("night_operation_not_permitted");
  });
});

describe("booking windows", () => {
  it("refuses inside minLeadMinutes", () => {
    const decision = evaluateAirspace(
      // Deciding at 07:30 for an 08:00 slot, with a 60-minute lead.
      query({ now: at(7, 30) }),
      context(),
    );
    expect(codes(decision)).toContain("booking_lead_time");
    const reason = decision.reasons.find(
      (candidate) => candidate.code === "booking_lead_time",
    );
    expect(reason?.params).toEqual({ hours: 1 });
  });

  it("refuses beyond maxAdvanceDays", () => {
    const decision = evaluateAirspace(
      query({
        slotStart: riyadhInstant("2026-04-15", 8 * 60).toISOString(),
        slotEnd: riyadhInstant("2026-04-15", 9 * 60).toISOString(),
      }),
      context(),
    );
    expect(codes(decision)).toContain("booking_too_far_ahead");
    expect(
      decision.reasons.find(
        (candidate) => candidate.code === "booking_too_far_ahead",
      )?.params,
    ).toEqual({ days: 14 });
  });

  it("refuses a slot in the past", () => {
    const decision = evaluateAirspace(query({ now: at(9) }), context());
    expect(codes(decision)).toContain("slot_in_past");
  });
});

describe("capacity and the pilot's own diary", () => {
  it("refuses a full slot", () => {
    const decision = evaluateAirspace(
      query(),
      context({ availability: [{ slotStart: at(8), taken: 3 }] }),
    );
    expect(codes(decision)).toContain("slot_full");
  });

  it("allows a slot with one seat left", () => {
    const decision = evaluateAirspace(
      query(),
      context({ availability: [{ slotStart: at(8), taken: 2 }] }),
    );
    expect(decision.status).toBe("allowed");
  });

  it("refuses an instant the pilot already holds", () => {
    const decision = evaluateAirspace(
      query(),
      context({ pilotBusySlots: [at(8)] }),
    );
    expect(codes(decision)).toContain("duplicate_booking");
  });

  it("refuses once the pilot is at their daily cap", () => {
    const decision = evaluateAirspace(
      query(),
      context({ pilotBookingsOnDay: 2 }),
    );
    expect(codes(decision)).toContain("max_slots_per_day");
    expect(
      decision.reasons.find(
        (candidate) => candidate.code === "max_slots_per_day",
      )?.params,
    ).toEqual({ max: 2 });
  });
});

describe("the aircraft", () => {
  it("refuses a build type the zone does not permit", () => {
    const decision = evaluateAirspace(
      query(),
      context({
        zones: [zoneRule({ permittedBuildTypes: ["commercial"] })],
        aircraft: aircraft({ buildType: "fpv" }),
      }),
    );
    expect(codes(decision)).toContain("build_type_not_permitted");
  });

  it("treats a null permittedBuildTypes as no restriction", () => {
    const decision = evaluateAirspace(
      query(),
      context({ zones: [zoneRule({ permittedBuildTypes: null })] }),
    );
    expect(codes(decision)).not.toContain("build_type_not_permitted");
  });

  it("refuses a heavier class than the zone allows, and permits a lighter one", () => {
    const heavier = evaluateAirspace(
      query(),
      context({
        zones: [zoneRule({ maxWeightClass: "light" })],
        aircraft: aircraft({ weightClass: "medium" }),
      }),
    );
    expect(codes(heavier)).toContain("weight_class_not_permitted");

    const lighter = evaluateAirspace(
      query(),
      context({
        zones: [zoneRule({ maxWeightClass: "medium" })],
        aircraft: aircraft({ weightClass: "micro" }),
      }),
    );
    expect(codes(lighter)).not.toContain("weight_class_not_permitted");
  });

  it("refuses a drone that is not approved, expired or revoked", () => {
    for (const [status, code] of [
      ["pending", "drone_not_approved"],
      ["draft", "drone_not_approved"],
      ["rejected", "drone_not_approved"],
      ["expired", "drone_registration_expired"],
      ["revoked", "drone_revoked"],
    ] as const) {
      const decision = evaluateAirspace(
        query(),
        context({ aircraft: aircraft({ status }) }),
      );
      expect(codes(decision)).toContain(code);
    }
  });

  it("refuses a registration that expires before the flight ends", () => {
    const decision = evaluateAirspace(
      query(),
      // Expires at 08:30, mid-slot.
      context({ aircraft: aircraft({ registrationExpiresAt: at(8, 30) }) }),
    );
    expect(codes(decision)).toContain("drone_registration_expired");
  });

  it("refuses a missing or inactive Remote ID", () => {
    expect(
      codes(
        evaluateAirspace(
          query(),
          context({ aircraft: aircraft({ remoteIdStatus: null }) }),
        ),
      ),
    ).toContain("no_remote_id");

    expect(
      codes(
        evaluateAirspace(
          query(),
          context({ aircraft: aircraft({ remoteIdStatus: "suspended" }) }),
        ),
      ),
    ).toContain("remote_id_not_active");
  });
});

describe("broadcast Remote ID — open thread 34", () => {
  const verified = (overrides: Partial<DeclarationWindow> = {}) => ({
    verifiedAt: "2026-01-01T00:00:00.000Z",
    rejectedAt: null,
    supersededAt: null,
    validFrom: null,
    validUntil: null,
    ...overrides,
  });

  const broadcastZone = () => zoneRule({ requiresBroadcastRid: true });

  it("refuses a zone that demands broadcast when the declaration is unverified", () => {
    const decision = evaluateAirspace(
      query(),
      context({
        zones: [broadcastZone()],
        aircraft: aircraft({
          declarations: [verified({ verifiedAt: null })],
        }),
      }),
    );
    expect(codes(decision)).toContain("broadcast_rid_required");
  });

  it("accepts a verified, unexpired declaration", () => {
    const decision = evaluateAirspace(
      query(),
      context({
        zones: [broadcastZone()],
        aircraft: aircraft({ declarations: [verified()] }),
      }),
    );
    expect(codes(decision)).not.toContain("broadcast_rid_required");
  });

  it("checks the declaration's own window against the slot, not against now", () => {
    /**
     * **The thread, closed.** `remote_id.broadcastCapable` is a snapshot taken
     * at write time and nothing sweeps it, so a module whose `validUntil` falls
     * between now and the slot would still read `true` on the row. Evaluating
     * the rows against the *slot* is what catches it.
     */
    const expiringTonight = verified({ validUntil: at(12) });

    // Capable right now…
    expect(
      broadcastCapableAt([expiringTonight], new Date(at(8))),
    ).toBe(true);
    // …and not for a slot the day after.
    const tomorrow = riyadhInstant("2026-03-16", 8 * 60).toISOString();
    expect(broadcastCapableAt([expiringTonight], new Date(tomorrow))).toBe(
      false,
    );

    const decision = evaluateAirspace(
      query({
        slotStart: tomorrow,
        slotEnd: riyadhInstant("2026-03-16", 9 * 60).toISOString(),
      }),
      context({
        zones: [broadcastZone()],
        aircraft: aircraft({ declarations: [expiringTonight] }),
      }),
    );
    expect(codes(decision)).toContain("broadcast_rid_required");
  });

  it("ignores a superseded or rejected declaration", () => {
    expect(
      broadcastCapableAt([verified({ supersededAt: at(1) })], new Date(at(8))),
    ).toBe(false);
    expect(
      broadcastCapableAt([verified({ rejectedAt: at(1) })], new Date(at(8))),
    ).toBe(false);
  });

  it("ignores a declaration whose validity has not started", () => {
    expect(
      broadcastCapableAt(
        [verified({ validFrom: "2027-01-01T00:00:00.000Z" })],
        new Date(at(8)),
      ),
    ).toBe(false);
  });
});

describe("the pilot", () => {
  it("refuses an incomplete profile", () => {
    const decision = evaluateAirspace(
      query(),
      context({ pilot: { profileComplete: false, identityVerified: false } }),
    );
    expect(codes(decision)).toContain("pilot_profile_incomplete");
    expect(codes(decision)).not.toContain("identity_unverified");
  });

  it("separates a complete-but-unverified profile from an incomplete one", () => {
    /**
     * Identity is verified by a **human reviewer**, never automatically.
     * Telling someone who filled in every field that their profile is
     * incomplete sends them back to a form with nothing left to do.
     */
    const decision = evaluateAirspace(
      query(),
      context({ pilot: { profileComplete: true, identityVerified: false } }),
    );
    expect(codes(decision)).toContain("identity_unverified");
    expect(codes(decision)).not.toContain("pilot_profile_incomplete");
  });
});

describe("eligibility does not short-circuit the geometry", () => {
  it("still names the zone for a pilot whose registration has expired", () => {
    /**
     * The map has to keep working for someone who is not currently eligible —
     * showing them *where* they could fly once they renew is the whole reason
     * these reasons are collected rather than returned early.
     */
    const decision = evaluateAirspace(
      query(),
      context({ aircraft: aircraft({ status: "expired" }) }),
    );
    expect(codes(decision)).toContain("drone_registration_expired");
    expect(decision.zone?.code).toBe("TST-P-01");
    expect(decision.geometryVersion).toBe(7);
  });

  it("evaluates the airspace with no aircraft and no pilot at all", () => {
    const decision = evaluateAirspace(
      { point: INSIDE, now: at(6) },
      { zones: [zoneRule()] },
    );
    expect(decision.status).toBe("allowed");
    expect(decision.reasons).toEqual([]);
  });
});

describe("a suspended zone", () => {
  it("refuses, and still says which zone", () => {
    const decision = evaluateAirspace(
      query(),
      context({ zones: [zoneRule({ status: "suspended" })] }),
    );
    expect(codes(decision)).toContain("zone_suspended");
    expect(decision.zone?.code).toBe("TST-P-01");
  });
});

describe("a query with no zone under it", () => {
  it("is default-deny", () => {
    const decision = evaluateAirspace(
      query({ point: OUTSIDE }),
      context(),
    );
    expect(codes(decision)).toEqual(["outside_permitted_zone"]);
    expect(decision.zone).toBeNull();
    expect(decision.geometryVersion).toBe(0);
  });
});

describe("a zone query", () => {
  it("names its zone without a coordinate", () => {
    const decision = evaluateAirspace(
      { zoneId: "zone-1", slotStart: at(8), slotEnd: at(9), now: at(6) },
      context(),
    );
    expect(decision.status).toBe("allowed");
    expect(decision.zone?.id).toBe("zone-1");
  });

  it("refuses a zone that is not in the context", () => {
    const decision = evaluateAirspace(
      { zoneId: "nope", slotStart: at(8), now: at(6) },
      context(),
    );
    expect(codes(decision)).toContain("outside_permitted_zone");
  });
});

describe("every denial offers a way forward", () => {
  it("returns alternatives when a different time would fix it", () => {
    const decision = evaluateAirspace(
      query(),
      context({ availability: [{ slotStart: at(8), taken: 3 }] }),
    );
    expect(decision.status).toBe("denied");
    expect(decision.alternativeSlots.length).toBeGreaterThan(0);
    expect(decision.alternativeSlots[0].slotStart).not.toBe(at(8));
    expect(
      decision.alternativeSlots.every((slot) => slot.state === "available"),
    ).toBe(true);
  });

  it("offers none when a different time would not help", () => {
    // Wrong build type: every slot in this zone answers the same way.
    const decision = evaluateAirspace(
      query(),
      context({
        zones: [zoneRule({ permittedBuildTypes: ["commercial"] })],
      }),
    );
    expect(decision.alternativeSlots).toEqual([]);
    expect(decision.nextOpenAt).toBeNull();
  });
});
