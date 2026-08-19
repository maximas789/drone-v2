import { describe, expect, it } from "vitest";
import type { Geometry, LinearRing } from "./index";
import { approximateAreaSqM } from "./area";
import {
  ensureWinding,
  isCounterClockwise,
  reverseRing,
  signedDoubleArea,
} from "./winding";

/**
 * A one-kilometre-ish square near Riyadh, traced **counter-clockwise** in
 * `[lng, lat]`: east, north, west, south.
 */
const CCW: LinearRing = [
  [46.6, 24.6],
  [46.61, 24.6],
  [46.61, 24.61],
  [46.6, 24.61],
  [46.6, 24.6],
];

const CW: LinearRing = reverseRing(CCW);

/** A hole in the middle of it. */
const HOLE_CW: LinearRing = [
  [46.603, 24.603],
  [46.603, 24.607],
  [46.607, 24.607],
  [46.607, 24.603],
  [46.603, 24.603],
];

describe("isCounterClockwise", () => {
  it("reads the shoelace sign in a [lng, lat] frame", () => {
    expect(isCounterClockwise(CCW)).toBe(true);
    expect(isCounterClockwise(CW)).toBe(false);
  });

  /**
   * A ring with no area has no orientation, and saying "counter-clockwise"
   * about one would send `ensureWinding` reversing it for ever. The validator
   * refuses such a ring long before this is asked.
   */
  it("calls a degenerate ring not counter-clockwise", () => {
    const collinear: LinearRing = [
      [46.6, 24.6],
      [46.61, 24.6],
      [46.62, 24.6],
      [46.6, 24.6],
    ];
    expect(signedDoubleArea(collinear)).toBe(0);
    expect(isCounterClockwise(collinear)).toBe(false);
  });
});

describe("ensureWinding", () => {
  it("leaves a correctly wound polygon identical — by reference", () => {
    const geometry: Geometry = { type: "Polygon", coordinates: [CCW, HOLE_CW] };
    // Identity is the signal `validateGeometry` uses to decide whether to warn
    // that it corrected something.
    expect(ensureWinding(geometry)).toBe(geometry);
  });

  it("turns a clockwise outer ring counter-clockwise", () => {
    const fixed = ensureWinding({ type: "Polygon", coordinates: [CW] });
    expect(isCounterClockwise(fixed.coordinates[0] as LinearRing)).toBe(true);
  });

  /**
   * **The case the rule exists for.** A hole wound the same way as its outer
   * ring renders as a second solid island in about half the software that will
   * ever read the exported GeoJSON — and KKIA's ring is a hole.
   */
  it("turns a counter-clockwise hole clockwise", () => {
    const holeCcw = reverseRing(HOLE_CW);
    const fixed = ensureWinding({
      type: "Polygon",
      coordinates: [CCW, holeCcw],
    });
    expect(isCounterClockwise(fixed.coordinates[0] as LinearRing)).toBe(true);
    expect(isCounterClockwise(fixed.coordinates[1] as LinearRing)).toBe(false);
  });

  it("fixes every part of a MultiPolygon", () => {
    const fixed = ensureWinding({
      type: "MultiPolygon",
      coordinates: [[CW], [CW, reverseRing(HOLE_CW)]],
    });
    const parts = fixed.coordinates as readonly (readonly LinearRing[])[];
    expect(isCounterClockwise(parts[0][0])).toBe(true);
    expect(isCounterClockwise(parts[1][0])).toBe(true);
    expect(isCounterClockwise(parts[1][1])).toBe(false);
  });

  it("does not change the ring's first position when reversing", () => {
    const fixed = ensureWinding({ type: "Polygon", coordinates: [CW] });
    const ring = fixed.coordinates[0] as LinearRing;
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });
});

describe("approximateAreaSqM", () => {
  /**
   * 0.01° of latitude is ~1.11 km; 0.01° of longitude at 24.6°N is ~1.01 km.
   * So the square is about **1.12 km²** — and taking degrees as square would
   * give 1.24 km², a tenth too much.
   *
   * The window is 1.05–1.18 km² deliberately: loose enough not to pin an
   * approximation to the square metre, tight enough that **dropping the cosine
   * fails this test**. The first version of it spanned 1.0–1.25 and let that
   * mutation through, which made it a test of nothing.
   */
  it("scales longitude by latitude rather than taking degrees as square", () => {
    const area = approximateAreaSqM({ type: "Polygon", coordinates: [CCW] });
    expect(area).toBeGreaterThan(1.05e6);
    expect(area).toBeLessThan(1.18e6);
  });

  it("gives the same answer whichever way the ring is wound", () => {
    const ccw = approximateAreaSqM({ type: "Polygon", coordinates: [CCW] });
    const cw = approximateAreaSqM({ type: "Polygon", coordinates: [CW] });
    expect(cw).toBeCloseTo(ccw, 6);
  });

  it("subtracts holes, because a hole is not part of the zone", () => {
    const solid = approximateAreaSqM({ type: "Polygon", coordinates: [CCW] });
    const withHole = approximateAreaSqM({
      type: "Polygon",
      coordinates: [CCW, HOLE_CW],
    });
    expect(withHole).toBeLessThan(solid);
    // The hole is 0.004° × 0.004°, the outer 0.01° × 0.01° — 16% of it.
    expect(withHole / solid).toBeCloseTo(0.84, 2);
  });

  it("adds the parts of a MultiPolygon", () => {
    const one = approximateAreaSqM({ type: "Polygon", coordinates: [CCW] });
    const two = approximateAreaSqM({
      type: "MultiPolygon",
      coordinates: [[CCW], [HOLE_CW]],
    });
    expect(two).toBeGreaterThan(one);
  });
});
