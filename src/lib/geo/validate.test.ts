import { describe, expect, it } from "vitest";
import { pointInGeometry } from "@/lib/airspace/geometry";
import type { LinearRing } from "./index";
import {
  MAX_VERTICES,
  MIN_AREA_SQM,
  ringSelfIntersects,
  validateGeometry,
} from "./validate";
import { isCounterClockwise, reverseRing } from "./winding";

/**
 * The server's rule for whether a drawn polygon may be airspace.
 *
 * Every case here is one an admin can actually produce with a mouse: a
 * figure-of-eight from crossing your own trace, an unclosed ring from a tool
 * that leaves closure to the serialiser, a sliver from a double-click, a hole
 * wound the wrong way, and a pair of taps in the wrong order that puts the zone
 * in Ukraine.
 */

const SQUARE: LinearRing = [
  [46.6, 24.6],
  [46.61, 24.6],
  [46.61, 24.61],
  [46.6, 24.61],
  [46.6, 24.6],
];

const HOLE: LinearRing = [
  [46.603, 24.603],
  [46.603, 24.607],
  [46.607, 24.607],
  [46.607, 24.603],
  [46.603, 24.603],
];

const codes = (result: ReturnType<typeof validateGeometry>) =>
  result.ok
    ? result.warnings.map((w) => w.code)
    : result.problems.map((p) => p.code);

describe("validateGeometry — structure", () => {
  it("refuses anything that is not an object", () => {
    for (const input of [null, undefined, "polygon", 7, true]) {
      expect(codes(validateGeometry(input))).toEqual(["not_an_object"]);
    }
  });

  it("refuses a geometry type this app does not store", () => {
    expect(
      codes(validateGeometry({ type: "Point", coordinates: [46.6, 24.6] })),
    ).toEqual(["unsupported_type"]);
    expect(
      codes(validateGeometry({ type: "LineString", coordinates: [] })),
    ).toEqual(["unsupported_type"]);
  });

  it("refuses a position that is not a finite pair", () => {
    expect(
      codes(validateGeometry({ type: "Polygon", coordinates: [[[46.6]]] })),
    ).toEqual(["position_not_a_pair"]);
    expect(
      codes(
        validateGeometry({
          type: "Polygon",
          coordinates: [[["46.6", 24.6]]],
        }),
      ),
    ).toEqual(["position_not_finite"]);
    expect(
      codes(
        validateGeometry({
          type: "Polygon",
          coordinates: [[[Number.NaN, 24.6]]],
        }),
      ),
    ).toEqual(["position_not_finite"]);
  });

  it("drops a third element rather than storing an elevation nothing reads", () => {
    const result = validateGeometry({
      type: "Polygon",
      coordinates: [SQUARE.map(([lng, lat]) => [lng, lat, 120])],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const position of result.geometry.coordinates[0]) {
      expect(position).toHaveLength(2);
    }
  });

  it("refuses a ring with too few positions to enclose anything", () => {
    expect(
      codes(
        validateGeometry({
          type: "Polygon",
          coordinates: [
            [
              [46.6, 24.6],
              [46.61, 24.6],
            ],
          ],
        }),
      ),
    ).toEqual(["ring_too_short"]);
  });
});

describe("validateGeometry — repairs", () => {
  it("closes an open ring and says so", () => {
    const open = SQUARE.slice(0, -1);
    const result = validateGeometry({ type: "Polygon", coordinates: [open] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.map((w) => w.code)).toContain("ring_auto_closed");
    const ring = result.geometry.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it("corrects winding and says so", () => {
    const result = validateGeometry({
      type: "Polygon",
      coordinates: [reverseRing(SQUARE)],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.map((w) => w.code)).toContain("winding_corrected");
    expect(
      isCounterClockwise(result.geometry.coordinates[0] as LinearRing),
    ).toBe(true);
  });

  it("says nothing when it changed nothing", () => {
    const result = validateGeometry({
      type: "Polygon",
      coordinates: [SQUARE, HOLE],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
  });
});

describe("validateGeometry — refusals", () => {
  /**
   * The bow-tie. Ray casting on a self-intersecting ring answers confidently
   * and wrongly, and its answer is what a flight is authorised against — so
   * this is the one problem with no repair. Nobody can guess which loop was
   * meant.
   */
  it("refuses a self-intersecting ring", () => {
    const bowTie: LinearRing = [
      [46.6, 24.6],
      [46.61, 24.61],
      [46.61, 24.6],
      [46.6, 24.61],
      [46.6, 24.6],
    ];
    expect(ringSelfIntersects(bowTie)).toBe(true);
    expect(
      codes(validateGeometry({ type: "Polygon", coordinates: [bowTie] })),
    ).toContain("self_intersecting");
  });

  it("does not mistake a ring's own shared vertices for a crossing", () => {
    // Every consecutive pair of edges touches by construction, and so do the
    // first and last. A predicate that counted those would refuse every
    // polygon ever drawn.
    expect(ringSelfIntersects(SQUARE)).toBe(false);
    const concave: LinearRing = [
      [46.6, 24.6],
      [46.62, 24.6],
      [46.62, 24.62],
      [46.61, 24.61],
      [46.6, 24.62],
      [46.6, 24.6],
    ];
    expect(ringSelfIntersects(concave)).toBe(false);
  });

  it("refuses more vertices than the cap, and does so first", () => {
    const many: number[][] = [];
    for (let i = 0; i < MAX_VERTICES + 10; i++) {
      // Deliberately also self-intersecting and outside Saudi Arabia: the cap
      // must answer alone, because every other check is O(n) or worse over
      // exactly these positions.
      many.push([100 + (i % 2), 60 + (i % 3)]);
    }
    const result = validateGeometry({ type: "Polygon", coordinates: [many] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0].code).toBe("too_many_vertices");
    expect(result.problems[0].params?.max).toBe(MAX_VERTICES);
  });

  it("refuses a polygon outside Saudi Arabia — the reversed-pair detector", () => {
    // Riyadh's coordinates written [lat, lng] land in Ukraine.
    const reversed = SQUARE.map(([lng, lat]) => [lat, lng]);
    expect(
      codes(validateGeometry({ type: "Polygon", coordinates: [reversed] })),
    ).toContain("outside_saudi_arabia");
  });

  it("refuses a sliver — a mis-click, not airspace", () => {
    const tiny: LinearRing = [
      [46.6, 24.6],
      [46.6002, 24.6],
      [46.6002, 24.6002],
      [46.6, 24.6],
    ];
    const result = validateGeometry({ type: "Polygon", coordinates: [tiny] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const problem = result.problems.find((p) => p.code === "area_too_small");
    expect(problem).toBeDefined();
    expect(problem?.params?.minSqM).toBe(MIN_AREA_SQM);
  });
});

describe("validateGeometry — what it hands back", () => {
  it("computes the bbox and the vertex count itself", () => {
    const result = validateGeometry({
      type: "Polygon",
      coordinates: [SQUARE, HOLE],
      // A caller's own bbox is a claim about which viewports will find the
      // zone. It is ignored: this shape is nowhere near those numbers.
      bbox: { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bbox).toEqual({
      minLat: 24.6,
      maxLat: 24.61,
      minLng: 46.6,
      maxLng: 46.61,
    });
    expect(result.vertexCount).toBe(SQUARE.length + HOLE.length);
  });

  /**
   * The end-to-end claim of the whole file: what comes out of the validator is
   * what `pointInGeometry` — the function a booking is authorised against —
   * reads as a hole.
   */
  it("returns a hole that the containment test treats as a hole", () => {
    const result = validateGeometry({
      type: "Polygon",
      // Both rings counter-clockwise on the way in: the hole is wrong until
      // `ensureWinding` fixes it.
      coordinates: [SQUARE, reverseRing(HOLE)],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(pointInGeometry([46.601, 24.601], result.geometry)).toBe(true);
    expect(pointInGeometry([46.605, 24.605], result.geometry)).toBe(false);
  });

  it("accepts a MultiPolygon of two separate squares", () => {
    const far = SQUARE.map(([lng, lat]) => [lng + 0.5, lat + 0.5]);
    const result = validateGeometry({
      type: "MultiPolygon",
      coordinates: [[SQUARE], [far]],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bbox.maxLng).toBeCloseTo(47.11, 6);
  });
});
