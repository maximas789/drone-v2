import { describe, expect, it } from "vitest";
import type { Geometry, Position } from "@/lib/geo";
import { computeBbox } from "@/lib/geo/bbox";
import { STANDARD_HOURS } from "@/lib/seed/zone-hours";
import { RIYADH_ZONES, type SeedZone } from "@/lib/seed/zones-riyadh";
import { evaluateAirspace } from "./evaluate";
import { riyadhInstant } from "./time";
import type { AirspaceContext, ReasonCode, ZoneRule, ZoneWindow } from "./types";

/**
 * Precedence, against the **real seeded Riyadh airspace** rather than a
 * fixture:
 *
 * ```
 * no_fly  >  permitted  >  restricted  >  default-deny
 * ```
 *
 * These are the zones the app ships with. A test that invented its own polygons
 * would pass while the seed said something else entirely.
 */

const HOURS: ZoneWindow[] = STANDARD_HOURS.map((hour) => ({
  weekday: hour.weekday,
  opensMinute: hour.opensMinute,
  closesMinute: hour.closesMinute,
}));

/** The seed rows as the engine sees them, exactly as `query.ts` hydrates them. */
function ruleFor(seed: SeedZone): ZoneRule {
  return {
    id: seed.code,
    code: seed.code,
    kind: seed.kind,
    status: "active",
    nameAr: seed.nameAr,
    nameEn: seed.nameEn,
    geometry: seed.geometry,
    geometryVersion: 1,
    bbox: computeBbox(seed.geometry),
    ceilingAglM: seed.ceilingAglM,
    floorAglM: seed.floorAglM ?? 0,
    capacity: seed.capacity ?? 1,
    slotDurationMinutes: seed.slotDurationMinutes ?? 60,
    minLeadMinutes: seed.minLeadMinutes ?? 60,
    maxAdvanceDays: seed.maxAdvanceDays ?? 30,
    maxSlotsPerPilotPerDay: seed.maxSlotsPerPilotPerDay ?? 2,
    autoApprove: seed.autoApprove ?? false,
    nightAllowed: seed.nightAllowed ?? false,
    maxWeightClass: seed.maxWeightClass ?? null,
    permittedBuildTypes: seed.permittedBuildTypes ?? null,
    requiresBroadcastRid: seed.requiresBroadcastRid ?? false,
    // Only permitted zones get hours in the seed: a restricted or no-fly zone
    // is never "open", and giving it opening hours would state in data that
    // there is a time when you may fly there.
    hours: seed.kind === "permitted" ? HOURS : [],
    closures: [],
  };
}

const RIYADH: AirspaceContext = {
  zones: RIYADH_ZONES.map(ruleFor),
};

/** A Sunday morning, well inside every zone's window. */
const NOW = riyadhInstant("2026-03-15", 6 * 60).toISOString();

function decideAt(point: Position, overrides: Partial<AirspaceContext> = {}) {
  return evaluateAirspace(
    { point, now: NOW },
    { ...RIYADH, ...overrides },
  );
}

const codes = (decision: { reasons: { code: ReasonCode }[] }) =>
  decision.reasons.map((reason) => reason.code);

describe("default-deny", () => {
  it("refuses a point outside every zone in the seed", () => {
    // Open desert well east of the greater-Riyadh polygon.
    const decision = decideAt([47.9, 24.5]);
    expect(codes(decision)).toEqual(["outside_permitted_zone"]);
    expect(decision.zone).toBeNull();
  });

  it("refuses a point in central Riyadh that is in no permitted zone", () => {
    /**
     * **F12's acceptance criterion says `outside_permitted_zone` here, and the
     * seeded airspace makes that wrong.** `RUH-R-CITY` is a default-deny base
     * covering the whole of greater Riyadh, so a point in the city that is in
     * no carve-out is *inside a restricted zone* — a more specific and more
     * useful answer, and the one the seed's own design note describes.
     * `outside_permitted_zone` is what you get beyond the base, above.
     */
    // Al Malaz, central Riyadh: inside the base, inside no carve-out.
    const decision = decideAt([46.74, 24.66]);
    expect(codes(decision)).toEqual(["inside_restricted_zone"]);
    expect(decision.zone?.code).toBe("RUH-R-CITY");
  });
});

describe("a permitted carve-out beats the restricted base", () => {
  it("allows a point inside RUH-P-04, which sits inside RUH-R-CITY", () => {
    const point: Position = [46.745, 24.72]; // King Salman Park

    // Both zones contain it…
    const city = RIYADH.zones.find((zone) => zone.code === "RUH-R-CITY");
    expect(city).toBeDefined();

    // …and the carve-out wins.
    const decision = decideAt(point);
    expect(decision.zone?.code).toBe("RUH-P-04");
    expect(codes(decision)).not.toContain("inside_restricted_zone");
    // `autoApprove: false` on this zone, so the answer is the third state.
    expect(decision.status).toBe("needs_review");
  });

  it("allows Thumamah, the FPV and self-built zone", () => {
    const decision = decideAt([46.58, 25.05]);
    expect(decision.zone?.code).toBe("RUH-P-01");
    expect(decision.status).toBe("allowed");
  });
});

describe("no-fly beats everything", () => {
  it("refuses a point inside a no-fly zone that also sits in a permitted one", () => {
    /**
     * The seed has no permitted zone deeply overlapping a no-fly zone — that
     * would be an authoring error, not a feature. So the overlap is staged
     * here: a permitted square laid over the Diplomatic Quarter.
     */
    const overlay: Geometry = {
      type: "Polygon",
      coordinates: [
        [
          [46.6, 24.66],
          [46.65, 24.66],
          [46.65, 24.71],
          [46.6, 24.71],
          [46.6, 24.66],
        ],
      ],
    };
    const permittedOverDq: ZoneRule = {
      ...ruleFor(RIYADH_ZONES[1]),
      id: "OVERLAY",
      code: "RUH-P-99",
      geometry: overlay,
      bbox: computeBbox(overlay),
    };

    const decision = decideAt([46.62, 24.68], {
      zones: [...RIYADH.zones, permittedOverDq],
    });
    expect(codes(decision)).toEqual(["inside_no_fly_zone"]);
    expect(decision.zone?.code).toBe("RUH-NF-DQ");
    expect(decision.status).toBe("denied");
  });

  it("refuses the Ministry of Defence area", () => {
    const decision = decideAt([46.71, 24.68]);
    expect(codes(decision)).toContain("inside_no_fly_zone");
    expect(decision.zone?.code).toBe("RUH-NF-MOD");
  });

  it("refuses the ring of the KKIA CTR", () => {
    const decision = decideAt([46.6988, 24.9]);
    expect(decision.zone?.code).toBe("RUH-NF-KKIA");
    expect(codes(decision)).toContain("inside_no_fly_zone");
  });

  it("does not refuse the excluded core of the KKIA CTR", () => {
    /**
     * The interior ring is inside the airfield perimeter and managed by the
     * airport itself — **not** a place you may fly, but not part of this
     * polygon either. It falls through to the restricted base, which refuses it
     * anyway. Default-deny is what makes the hole safe to have.
     */
    const decision = decideAt([46.6988, 24.9576]);
    expect(codes(decision)).not.toContain("inside_no_fly_zone");
    expect(codes(decision)).toEqual(["inside_restricted_zone"]);
  });
});

describe("drawn areas", () => {
  const around = (centre: Position, radius: number): Geometry => ({
    type: "Polygon",
    coordinates: [
      [
        [centre[0] - radius, centre[1] - radius],
        [centre[0] + radius, centre[1] - radius],
        [centre[0] + radius, centre[1] + radius],
        [centre[0] - radius, centre[1] + radius],
        [centre[0] - radius, centre[1] - radius],
      ],
    ],
  });

  const decideArea = (area: Geometry) =>
    evaluateAirspace({ area, now: NOW }, RIYADH);

  it("allows an area entirely inside a permitted zone", () => {
    const decision = decideArea(around([46.58, 25.05], 0.005));
    expect(decision.zone?.code).toBe("RUH-P-01");
    expect(decision.reasons).toEqual([]);
  });

  it("refuses an area that leaves the permitted zone", () => {
    /**
     * Stricter than the rule for a point, on purpose: half an area over the
     * boundary is not half a permission.
     */
    const decision = decideArea(around([46.52, 24.985], 0.02));
    expect(codes(decision)).toContain("inside_restricted_zone");
    expect(decision.zone?.code).not.toBe("RUH-P-01");
  });

  it("refuses an area that so much as touches a no-fly zone", () => {
    // Straddling the northern edge of the MOD square at 24.70.
    const decision = decideArea(around([46.71, 24.7], 0.01));
    expect(codes(decision)).toEqual(["inside_no_fly_zone"]);
    expect(decision.zone?.code).toBe("RUH-NF-MOD");
  });
});

describe("the same point always answers the same way", () => {
  it("does not depend on the order the zones arrive in", () => {
    const point: Position = [46.745, 24.72];
    const forwards = decideAt(point);
    const backwards = decideAt(point, { zones: [...RIYADH.zones].reverse() });
    expect(backwards.zone?.code).toBe(forwards.zone?.code);
    expect(codes(backwards)).toEqual(codes(forwards));
  });
});
