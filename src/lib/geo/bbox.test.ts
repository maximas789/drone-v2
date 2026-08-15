import { describe, expect, it } from "vitest";
import {
  assertRingsClosed,
  assertWithinSaudiArabia,
  bboxOverlaps,
  computeBbox,
  countVertices,
} from "./bbox";
import type { Geometry } from "./index";

const square: Geometry = {
  type: "Polygon",
  coordinates: [
    [
      [46.6, 24.7],
      [46.8, 24.7],
      [46.8, 24.8],
      [46.6, 24.8],
      [46.6, 24.7],
    ],
  ],
};

describe("computeBbox", () => {
  it("derives the extent of a simple polygon", () => {
    expect(computeBbox(square)).toEqual({
      minLng: 46.6,
      maxLng: 46.8,
      minLat: 24.7,
      maxLat: 24.8,
    });
  });

  it("includes interior rings — a hole cannot fall outside the box", () => {
    const annulus: Geometry = {
      type: "Polygon",
      coordinates: [
        square.coordinates[0],
        [
          [46.65, 24.72],
          [46.7, 24.72],
          [46.7, 24.75],
          [46.65, 24.75],
          [46.65, 24.72],
        ],
      ],
    };
    expect(computeBbox(annulus)).toEqual(computeBbox(square));
  });

  it("spans every member of a MultiPolygon", () => {
    const multi: Geometry = {
      type: "MultiPolygon",
      coordinates: [
        square.coordinates,
        [
          [
            [47.0, 25.0],
            [47.2, 25.0],
            [47.2, 25.1],
            [47.0, 25.1],
            [47.0, 25.0],
          ],
        ],
      ],
    };
    expect(computeBbox(multi)).toEqual({
      minLng: 46.6,
      maxLng: 47.2,
      minLat: 24.7,
      maxLat: 25.1,
    });
  });
});

describe("countVertices", () => {
  it("counts every ring including holes", () => {
    expect(countVertices(square)).toBe(5);
  });
});

describe("bboxOverlaps", () => {
  const a = { minLat: 24.7, maxLat: 24.8, minLng: 46.6, maxLng: 46.8 };

  it("is true when boxes intersect", () => {
    expect(
      bboxOverlaps(a, { minLat: 24.75, maxLat: 24.9, minLng: 46.7, maxLng: 47 }),
    ).toBe(true);
  });

  it("is true when they merely touch — a shared edge still needs evaluating", () => {
    expect(
      bboxOverlaps(a, { minLat: 24.8, maxLat: 24.9, minLng: 46.8, maxLng: 47 }),
    ).toBe(true);
  });

  it("is false when they are apart", () => {
    expect(
      bboxOverlaps(a, { minLat: 25.0, maxLat: 25.1, minLng: 47, maxLng: 47.2 }),
    ).toBe(false);
  });
});

describe("assertWithinSaudiArabia", () => {
  it("accepts a Riyadh polygon", () => {
    expect(() => assertWithinSaudiArabia(square, "ok")).not.toThrow();
  });

  /**
   * The reversal this exists to catch: `[24.7, 46.6]` written where
   * `[46.6, 24.7]` was meant puts the zone in Ukraine.
   */
  it("rejects a reversed [lat, lng] pair", () => {
    const reversed: Geometry = {
      type: "Polygon",
      coordinates: [
        [
          [24.7, 46.6],
          [24.7, 46.8],
          [24.8, 46.8],
          [24.7, 46.6],
        ],
      ],
    };
    expect(() => assertWithinSaudiArabia(reversed, "reversed")).toThrow(
      /looks reversed/,
    );
  });
});

describe("assertRingsClosed", () => {
  it("accepts a closed ring", () => {
    expect(() => assertRingsClosed(square, "ok")).not.toThrow();
  });

  it("rejects a ring whose last position is not its first", () => {
    const open: Geometry = {
      type: "Polygon",
      coordinates: [
        [
          [46.6, 24.7],
          [46.8, 24.7],
          [46.8, 24.8],
          [46.6, 24.8],
        ],
      ],
    };
    expect(() => assertRingsClosed(open, "open")).toThrow(/not closed/);
  });
});
