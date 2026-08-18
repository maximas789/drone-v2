import { describe, expect, it } from "vitest";
import type { BoundingBox, Geometry } from "./index";
import { pathFor, projectionFor, unionBounds } from "./project";

/** Roughly Riyadh, so the cosine correction is exercised at a real latitude. */
const BOUNDS: BoundingBox = {
  minLat: 24.5,
  maxLat: 24.9,
  minLng: 46.5,
  maxLng: 46.9,
};

describe("projectionFor", () => {
  /**
   * The one that fails silently. Latitude increases northward and SVG's y
   * increases downward, so projecting them directly prints the city upside
   * down — and an upside-down map of somewhere you don't know looks fine.
   */
  it("flips y, so north is up", () => {
    const projection = projectionFor(BOUNDS);
    const [, northY] = projection.project([46.7, BOUNDS.maxLat]);
    const [, southY] = projection.project([46.7, BOUNDS.minLat]);
    expect(northY).toBeLessThan(southY);
  });

  it("puts east to the right", () => {
    const projection = projectionFor(BOUNDS);
    const [westX] = projection.project([BOUNDS.minLng, 24.7]);
    const [eastX] = projection.project([BOUNDS.maxLng, 24.7]);
    expect(westX).toBeLessThan(eastX);
  });

  it("keeps the extent inside the viewBox, padding included", () => {
    const projection = projectionFor(BOUNDS, { width: 1000, padding: 12 });

    for (const corner of [
      [BOUNDS.minLng, BOUNDS.minLat],
      [BOUNDS.maxLng, BOUNDS.maxLat],
    ] as const) {
      const [x, y] = projection.project(corner);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(projection.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(projection.height);
    }

    // The corners sit exactly on the padding, not inside or beyond it.
    expect(projection.project([BOUNDS.minLng, BOUNDS.maxLat])).toEqual([12, 12]);
  });

  /**
   * A degree of longitude is shorter than a degree of latitude away from the
   * equator. Without the `cos(lat)` correction an equal-degree box would come
   * out square, which draws the city ~10 % too wide at Riyadh's latitude.
   */
  it("corrects longitude for latitude, so an equal-degree box is not square", () => {
    const projection = projectionFor(BOUNDS);
    expect(projection.height).toBeGreaterThan(projection.width);

    const expected = 1 / Math.cos((24.7 * Math.PI) / 180);
    const drawable = { w: projection.width - 24, h: projection.height - 24 };
    expect(drawable.h / drawable.w).toBeCloseTo(expected, 2);
  });

  it("survives a degenerate extent rather than dividing by zero", () => {
    const point = { minLat: 24.7, maxLat: 24.7, minLng: 46.7, maxLng: 46.7 };
    const projection = projectionFor(point);
    const [x, y] = projection.project([46.7, 24.7]);
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
  });
});

describe("unionBounds", () => {
  it("covers every box", () => {
    const union = unionBounds([
      { minLat: 1, maxLat: 2, minLng: 10, maxLng: 11 },
      { minLat: -3, maxLat: 0, minLng: 12, maxLng: 20 },
    ]);
    expect(union).toEqual({ minLat: -3, maxLat: 2, minLng: 10, maxLng: 20 });
  });

  it("is null for nothing, so the caller renders no empty frame", () => {
    expect(unionBounds([])).toBeNull();
  });
});

describe("pathFor", () => {
  const square: Geometry = {
    type: "Polygon",
    coordinates: [
      [
        [46.5, 24.5],
        [46.9, 24.5],
        [46.9, 24.9],
        [46.5, 24.9],
        [46.5, 24.5],
      ],
    ],
  };

  it("emits one closed subpath per ring", () => {
    const d = pathFor(square, projectionFor(BOUNDS));
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d.match(/M/g)).toHaveLength(1);
  });

  /**
   * A hole has to be its own subpath, because that is what lets
   * `fill-rule="evenodd"` cut it out. Merged into one, a permitted carve-out
   * inside a restricted zone would be painted over rather than punched through
   * — which looks the same and says something different.
   */
  it("gives an inner ring its own subpath", () => {
    const withHole: Geometry = {
      type: "Polygon",
      coordinates: [
        square.coordinates[0]!,
        [
          [46.6, 24.6],
          [46.7, 24.6],
          [46.7, 24.7],
          [46.6, 24.6],
        ],
      ],
    };
    const d = pathFor(withHole, projectionFor(BOUNDS));
    expect(d.match(/M/g)).toHaveLength(2);
    expect(d.match(/Z/g)).toHaveLength(2);
  });

  it("handles a multipolygon", () => {
    const multi: Geometry = {
      type: "MultiPolygon",
      coordinates: [square.coordinates, square.coordinates],
    };
    expect(pathFor(multi, projectionFor(BOUNDS)).match(/M/g)).toHaveLength(2);
  });

  it("emits nothing for an empty ring rather than a broken path", () => {
    const empty: Geometry = { type: "Polygon", coordinates: [[]] };
    expect(pathFor(empty, projectionFor(BOUNDS))).toBe("");
  });
});
