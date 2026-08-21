import { describe, expect, it } from "vitest";
import {
  diffFields,
  diffValue,
  geometryDiff,
  geometryFrom,
} from "./audit-diff";

const SQUARE = {
  type: "Polygon",
  coordinates: [
    [
      [46.6, 24.7],
      [46.7, 24.7],
      [46.7, 24.8],
      [46.6, 24.8],
      [46.6, 24.7],
    ],
  ],
};

describe("diffFields", () => {
  it("lists only the fields that changed", () => {
    expect(
      diffFields(
        { status: "pending", zoneCode: "RUH-P-07" },
        { status: "approved", zoneCode: "RUH-P-07" },
      ),
    ).toEqual([{ field: "status", before: "pending", after: "approved" }]);
  });

  /**
   * An absent key and a `null` value are different facts about an event. The
   * diff row carries `null` for the first and the string `"null"` for the
   * second, and the table must not conflate them.
   */
  it("distinguishes an absent key from a null value", () => {
    expect(diffFields({}, { verifiedAt: null })).toEqual([
      { field: "verifiedAt", before: null, after: "null" },
    ]);
  });

  it("orders by field name so two rows of the same change agree", () => {
    const rows = diffFields({ b: 1, a: 1 }, { b: 2, a: 2 });
    expect(rows.map((row) => row.field)).toEqual(["a", "b"]);
  });

  /** The boundary is a map, not two strings — `geometry` is never a row. */
  it("drops the geometry key", () => {
    expect(
      diffFields(
        { geometry: SQUARE, geometryVersion: 1 },
        { geometry: SQUARE, geometryVersion: 2 },
      ),
    ).toEqual([{ field: "geometryVersion", before: "1", after: "2" }]);
  });

  it("survives a payload that is not an object", () => {
    expect(diffFields(null, null)).toEqual([]);
    expect(diffFields("text", 7)).toEqual([]);
    expect(diffFields([1, 2], { a: 1 })).toEqual([
      { field: "a", before: null, after: "1" },
    ]);
  });
});

describe("diffValue", () => {
  /** No `Intl` anywhere: a number becomes its own digits, in both locales. */
  it("renders primitives without formatting them", () => {
    expect(diffValue(1234)).toBe("1234");
    expect(diffValue(true)).toBe("true");
    expect(diffValue(null)).toBe("null");
    expect(diffValue("الثمامة")).toBe("الثمامة");
  });

  it("compacts a nested value rather than pretty-printing it", () => {
    expect(diffValue({ a: [1, 2] })).toBe('{"a":[1,2]}');
  });
});

describe("geometryFrom", () => {
  it("reads a polygon and a multipolygon", () => {
    expect(geometryFrom(SQUARE)?.type).toBe("Polygon");
    expect(
      geometryFrom({ type: "MultiPolygon", coordinates: [SQUARE.coordinates] })
        ?.type,
    ).toBe("MultiPolygon");
  });

  /**
   * Deliberately **not** `validateGeometry`. That decides whether a polygon may
   * be saved — it refuses one outside Saudi bounds or below a minimum area —
   * and those are the wrong rules for a log. A historical row must still draw.
   */
  it("accepts a boundary that today's editor would refuse to save", () => {
    const tiny = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [0.0001, 0],
          [0.0001, 0.0001],
          [0, 0],
        ],
      ],
    };
    expect(geometryFrom(tiny)).not.toBeNull();
  });

  it("refuses anything that is not a ring of coordinate pairs", () => {
    expect(geometryFrom(null)).toBeNull();
    expect(geometryFrom({ type: "Point", coordinates: [1, 2] })).toBeNull();
    expect(geometryFrom({ type: "Polygon", coordinates: [[[1, 2]]] })).toBeNull();
    expect(
      geometryFrom({
        type: "Polygon",
        coordinates: [[["a", "b"], [1, 2], [3, 4], ["a", "b"]]],
      }),
    ).toBeNull();
  });
});

describe("geometryDiff", () => {
  it("returns both boundaries for a geometry change", () => {
    const diff = geometryDiff({ geometry: SQUARE }, { geometry: SQUARE });
    expect(diff?.before.type).toBe("Polygon");
    expect(diff?.after.type).toBe("Polygon");
  });

  /**
   * **Both sides or nothing.** A map showing only the new boundary is not a
   * diff — it is a picture of the zone, which the zone page already has.
   */
  it("returns null when only one side carries a boundary", () => {
    expect(geometryDiff({}, { geometry: SQUARE })).toBeNull();
    expect(geometryDiff({ geometry: SQUARE }, {})).toBeNull();
    expect(geometryDiff({ status: "active" }, { status: "draft" })).toBeNull();
  });
});
