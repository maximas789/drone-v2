import { describe, expect, it } from "vitest";
import { assertWithinSaudiArabia, computeBbox } from "@/lib/geo/bbox";
import type { Geometry, Position } from "@/lib/geo";
import { RIYADH_ZONES } from "@/lib/seed/zones-riyadh";
import {
  areaIntersectsGeometry,
  areaWithinGeometry,
  bboxContainsPoint,
  pointInGeometry,
  pointInPolygon,
  pointInRing,
  segmentsIntersect,
  zoneContainsPoint,
} from "./geometry";

/** A unit square from (0,0) to (1,1), closed. */
const square: Geometry = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
};

function seedZone(code: string) {
  const zone = RIYADH_ZONES.find((candidate) => candidate.code === code);
  if (!zone) throw new Error(`no seeded zone ${code}`);
  return { ...zone, bbox: computeBbox(zone.geometry) };
}

describe("pointInRing", () => {
  const ring = square.coordinates[0];

  it("puts an interior point inside and an exterior point outside", () => {
    expect(pointInRing([0.5, 0.5], ring)).toBe(true);
    expect(pointInRing([1.5, 0.5], ring)).toBe(false);
    expect(pointInRing([-0.5, 0.5], ring)).toBe(false);
  });

  it("counts a vertex-level crossing once, not twice", () => {
    // A ray through y = 1 grazes two vertices. The half-open rule is what stops
    // that being counted as two crossings and flipping the answer back.
    expect(pointInRing([0.5, 1], ring)).toBe(false);
    expect(pointInRing([0.5, 0], ring)).toBe(true);
  });
});

describe("a point on the seam between two abutting zones", () => {
  /**
   * The acceptance criterion, and the reason the half-open rule is not an
   * implementation detail: two permitted zones sharing an edge must resolve a
   * tap on that edge to **exactly one** of them. Both would double-book; neither
   * would refuse a legal flight for no visible reason.
   */
  const west: Geometry = {
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
  const east: Geometry = {
    type: "Polygon",
    coordinates: [
      [
        [46.6, 24.6],
        [46.7, 24.6],
        [46.7, 24.7],
        [46.6, 24.7],
        [46.6, 24.6],
      ],
    ],
  };

  it("resolves to exactly one zone, anywhere along the seam", () => {
    for (const lat of [24.61, 24.63, 24.65, 24.68]) {
      const onSeam: Position = [46.6, lat];
      const hits = [west, east].filter((zone) => pointInGeometry(onSeam, zone));
      expect(hits).toHaveLength(1);
    }
  });

  it("still resolves to one when the seam is horizontal", () => {
    const north: Geometry = {
      type: "Polygon",
      coordinates: [
        [
          [46.5, 24.7],
          [46.6, 24.7],
          [46.6, 24.8],
          [46.5, 24.8],
          [46.5, 24.7],
        ],
      ],
    };
    const onSeam: Position = [46.55, 24.7];
    const hits = [west, north].filter((zone) => pointInGeometry(onSeam, zone));
    expect(hits).toHaveLength(1);
  });
});

describe("interior rings", () => {
  const annulus: Geometry = {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
      [
        [4, 4],
        [6, 4],
        [6, 6],
        [4, 6],
        [4, 4],
      ],
    ],
  };

  it("excludes a point inside the hole", () => {
    expect(pointInPolygon([5, 5], annulus.coordinates)).toBe(false);
    expect(pointInPolygon([2, 2], annulus.coordinates)).toBe(true);
  });

  /**
   * **Open thread 9, closed.** F04 asserted only that `RUH-NF-KKIA` has two
   * rings; it deferred the containment assertion rather than write a second
   * point-in-polygon outside this folder. This is that assertion, against the
   * real seeded geometry.
   */
  it("does not contain the excluded core of the KKIA CTR", () => {
    const kkia = seedZone("RUH-NF-KKIA");

    // The centre of the interior ring: inside the airfield perimeter, and so
    // deliberately not part of the control ring.
    expect(zoneContainsPoint(kkia, [46.6988, 24.9576])).toBe(false);

    // Between the two rings — the annulus itself, which is very much no-fly.
    expect(zoneContainsPoint(kkia, [46.6988, 24.9])).toBe(true);
  });
});

describe("the bbox guard", () => {
  it("rejects a point outside the rectangle before any ray-cast", () => {
    const bbox = computeBbox(square);
    expect(bboxContainsPoint(bbox, [0.5, 0.5])).toBe(true);
    expect(bboxContainsPoint(bbox, [2, 0.5])).toBe(false);
  });

  it("agrees with containment on a known Riyadh landmark", () => {
    // Kingdom Centre, 46.6753 E 24.7113 N — inside the greater-Riyadh base.
    const city = seedZone("RUH-R-CITY");
    expect(zoneContainsPoint(city, [46.6753, 24.7113])).toBe(true);
  });

  /**
   * `[lng, lat]`, always. TypeScript cannot make the reversed pair a compile
   * error — a tuple's element labels do not affect assignability, so
   * `[24.7113, 46.6753]` is a perfectly good `Position` to the compiler. What
   * catches it is this, and `assertWithinSaudiArabia` at every write.
   */
  it("puts a reversed pair nowhere near Riyadh, and the seed guard says so", () => {
    const city = seedZone("RUH-R-CITY");
    expect(zoneContainsPoint(city, [24.7113, 46.6753])).toBe(false);

    expect(() =>
      assertWithinSaudiArabia(
        {
          type: "Polygon",
          coordinates: [
            [
              [24.7, 46.6],
              [24.8, 46.6],
              [24.8, 46.7],
              [24.7, 46.6],
            ],
          ],
        },
        "reversed",
      ),
    ).toThrow(/looks reversed/);
  });
});

describe("segmentsIntersect", () => {
  it("finds a proper crossing", () => {
    expect(segmentsIntersect([0, 0], [2, 2], [0, 2], [2, 0])).toBe(true);
  });

  it("finds a touching endpoint", () => {
    expect(segmentsIntersect([0, 0], [2, 0], [2, 0], [2, 2])).toBe(true);
  });

  it("misses two segments that do not meet", () => {
    expect(segmentsIntersect([0, 0], [1, 0], [0, 1], [1, 1])).toBe(false);
  });
});

describe("drawn areas", () => {
  const inside: Geometry = {
    type: "Polygon",
    coordinates: [
      [
        [0.2, 0.2],
        [0.8, 0.2],
        [0.8, 0.8],
        [0.2, 0.8],
        [0.2, 0.2],
      ],
    ],
  };
  const straddling: Geometry = {
    type: "Polygon",
    coordinates: [
      [
        [0.5, 0.5],
        [1.5, 0.5],
        [1.5, 1.5],
        [0.5, 1.5],
        [0.5, 0.5],
      ],
    ],
  };
  const outside: Geometry = {
    type: "Polygon",
    coordinates: [
      [
        [3, 3],
        [4, 3],
        [4, 4],
        [3, 4],
        [3, 3],
      ],
    ],
  };

  it("is contained only when every part of it is", () => {
    expect(areaWithinGeometry(inside, square)).toBe(true);
    expect(areaWithinGeometry(straddling, square)).toBe(false);
    expect(areaWithinGeometry(outside, square)).toBe(false);
  });

  it("intersects when it merely touches", () => {
    expect(areaIntersectsGeometry(straddling, square)).toBe(true);
    expect(areaIntersectsGeometry(outside, square)).toBe(false);
    // Sharing a single edge is still touching, and touching a no-fly zone denies.
    const abutting: Geometry = {
      type: "Polygon",
      coordinates: [
        [
          [1, 0],
          [2, 0],
          [2, 1],
          [1, 1],
          [1, 0],
        ],
      ],
    };
    expect(areaIntersectsGeometry(abutting, square)).toBe(true);
  });

  it("is not contained when only its corners are inside", () => {
    /**
     * The case the vertex test alone gets wrong: every corner of this area sits
     * inside one of the two arms of an L-shaped zone, while the area itself
     * spans the notch between them. Only the edge test catches it — which is
     * why containment is not "all vertices inside".
     */
    const lShaped: Geometry = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [3, 0],
          [3, 1],
          [1, 1],
          [1, 3],
          [0, 3],
          [0, 0],
        ],
      ],
    };
    const spanning: Geometry = {
      type: "Polygon",
      coordinates: [
        [
          [0.2, 0.2],
          [2.5, 0.2],
          [2.5, 0.8],
          [0.2, 2.5],
          [0.2, 0.2],
        ],
      ],
    };
    expect(
      spanning.coordinates[0].every((position) =>
        pointInGeometry(position, lShaped),
      ),
    ).toBe(true);
    expect(areaWithinGeometry(spanning, lShaped)).toBe(false);
  });
});
