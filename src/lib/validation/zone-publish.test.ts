import { describe, expect, it } from "vitest";
import type { Geometry } from "@/lib/geo";
import type { HourWindow } from "./zone-hours";
import { geometryShrinks, publishReadiness } from "./zone-publish";

/**
 * What must be true before a drawing becomes airspace, and what a moved
 * boundary does to the flights standing on it.
 */

/** A counter-clockwise square, `[lng, lat]`, somewhere north of Riyadh. */
function square(
  minLng: number,
  minLat: number,
  size: number,
): Geometry {
  return {
    type: "Polygon",
    coordinates: [
      [
        [minLng, minLat],
        [minLng + size, minLat],
        [minLng + size, minLat + size],
        [minLng, minLat + size],
        [minLng, minLat],
      ],
    ],
  };
}

const HOURS: HourWindow[] = [
  { weekday: 0, opensMinute: 360, closesMinute: 720 },
];

const permitted = (geometry: Geometry) => ({
  kind: "permitted",
  nameAr: "منطقة تجريبية",
  nameEn: "Test zone",
  capacity: 4,
  geometry,
});

describe("publishReadiness", () => {
  const base = square(46.6, 24.6, 0.05);

  it("passes a complete permitted zone", () => {
    const result = publishReadiness(permitted(base), HOURS, []);
    expect(result).toMatchObject({ ok: true, problems: [] });
  });

  it("refuses a permitted zone with no operating-hour window", () => {
    const result = publishReadiness(permitted(base), [], []);
    expect(result.ok).toBe(false);
    expect(result.problems).toContain("publish_hours_missing");
  });

  /**
   * A prohibition applies at all times. Demanding opening hours of one would be
   * asking somebody to say when it stops applying.
   */
  it("does not demand hours of a no-fly zone", () => {
    const result = publishReadiness(
      { ...permitted(base), kind: "no_fly" },
      [],
      [],
    );
    expect(result.ok).toBe(true);
  });

  it("refuses a zone missing either language name", () => {
    for (const missing of [{ nameAr: "" }, { nameEn: "  " }]) {
      const result = publishReadiness(
        { ...permitted(base), ...missing },
        HOURS,
        [],
      );
      expect(result.ok).toBe(false);
      expect(result.problems).toContain("publish_name_missing");
    }
  });

  it("refuses a capacity below one", () => {
    const result = publishReadiness(
      { ...permitted(base), capacity: 0 },
      HOURS,
      [],
    );
    expect(result.problems).toContain("publish_capacity_invalid");
  });

  it("refuses geometry the validator refuses", () => {
    const bowTie: Geometry = {
      type: "Polygon",
      coordinates: [
        [
          [46.6, 24.6],
          [46.7, 24.7],
          [46.7, 24.6],
          [46.6, 24.7],
          [46.6, 24.6],
        ],
      ],
    };
    const result = publishReadiness(permitted(bowTie), HOURS, []);
    expect(result.ok).toBe(false);
    expect(result.problems).toContain("publish_geometry_invalid");
  });

  /** Threads 37 and 55: the booking path cannot see this, so publish must. */
  describe("overlap with a no-fly zone", () => {
    it("refuses a permitted zone that overlaps one, and names it", () => {
      const result = publishReadiness(permitted(base), HOURS, [
        { code: "RUH-NF-KKIA", geometry: square(46.62, 24.62, 0.05) },
      ]);
      expect(result.ok).toBe(false);
      expect(result.problems).toContain("publish_overlaps_no_fly");
      expect(result.overlappingNoFly).toEqual(["RUH-NF-KKIA"]);
    });

    it("allows one that merely sits nearby", () => {
      const result = publishReadiness(permitted(base), HOURS, [
        { code: "RUH-NF-KKIA", geometry: square(46.9, 24.9, 0.05) },
      ]);
      expect(result.ok).toBe(true);
      expect(result.overlappingNoFly).toEqual([]);
    });

    /**
     * A no-fly zone may sit on top of anything — that is what it is for. The
     * rule is about the permitted zone's promise, not the prohibition's reach.
     */
    it("does not refuse a no-fly zone for overlapping another", () => {
      const result = publishReadiness(
        { ...permitted(base), kind: "no_fly" },
        HOURS,
        [{ code: "RUH-NF-KKIA", geometry: square(46.62, 24.62, 0.05) }],
      );
      expect(result.ok).toBe(true);
    });
  });
});

describe("geometryShrinks", () => {
  const before = square(46.6, 24.6, 0.05);

  it("is false when the new boundary contains the old one", () => {
    expect(geometryShrinks(before, square(46.55, 24.55, 0.2))).toBe(false);
  });

  /**
   * **Conservative where the two boundaries touch.** `areaWithinGeometry` uses
   * F12's "touching denies" arithmetic, so a new boundary that reuses an edge
   * of the old one — including one identical to it — is reported as shrinking
   * and its bookings get a second look. `updateZoneAction` never asks about an
   * unchanged polygon (it compares the JSON first), so the only case this
   * reaches is a real edit that kept an edge, and erring towards a human there
   * is the direction that cannot ground somebody by accident.
   */
  it("is conservative when the new boundary reuses an edge of the old", () => {
    expect(geometryShrinks(before, square(46.6, 24.6, 0.05))).toBe(true);
  });

  it("is true when the boundary is cut back", () => {
    expect(geometryShrinks(before, square(46.6, 24.6, 0.03))).toBe(true);
  });

  it("is true when the boundary is moved sideways, even keeping its area", () => {
    expect(geometryShrinks(before, square(46.65, 24.6, 0.05))).toBe(true);
  });
});
