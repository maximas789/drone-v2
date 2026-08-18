import { describe, expect, it } from "vitest";
import { segmentsIntersect } from "@/lib/airspace/geometry";
import type { Geometry, LinearRing, Position } from "@/lib/geo";
import { RIYADH_ZONES } from "./zones-riyadh";

/**
 * **Open thread 10, closed.**
 *
 * The seeded polygons have been *drawn* since F16a and *looked* clean, and
 * "looked clean" is what this file exists to stop being the answer. A
 * self-intersecting ring is not a cosmetic problem: `pointInRing` is an
 * even-odd ray cast, so a ring that crosses itself has an interior the
 * algorithm disagrees with — a bow-tie has a lobe the cast reports as *outside*
 * while every human looking at the map reads it as inside. That is a permitted
 * zone whose green fill covers ground the engine refuses, or worse, a no-fly
 * zone with a hole in its enforcement that nothing on screen reveals.
 *
 * It cannot be caught by rendering, because MapLibre and the SVG both happily
 * fill a self-intersecting ring. It has to be computed.
 *
 * `segmentsIntersect` is F12's own primitive, so this checks the geometry
 * against the same code that decides containment rather than a second
 * implementation that could be wrong in a compensating way.
 */

/** Every ring in a geometry, outer and interior alike. */
function ringsOf(geometry: Geometry): LinearRing[] {
  return geometry.type === "Polygon"
    ? geometry.coordinates.map((ring) => ring)
    : geometry.coordinates.flatMap((polygon) =>
        polygon.map((ring) => ring),
      );
}

/**
 * Edges of a closed ring, dropping the repeated final vertex.
 *
 * GeoJSON requires the first and last positions to be identical, so iterating
 * the raw array would produce a zero-length final edge that touches everything.
 */
function edgesOf(ring: LinearRing): [Position, Position][] {
  const points = ring.slice(0, -1);
  return points.map((point, index) => [
    point,
    points[(index + 1) % points.length],
  ]);
}

/**
 * Non-adjacent edge pairs that cross.
 *
 * Adjacent edges share a vertex **by construction** and every ring's first and
 * last edge do too, so those pairs are skipped — counting them would report
 * every well-formed polygon in existence as self-intersecting.
 */
function selfIntersections(ring: LinearRing): [number, number][] {
  const edges = edgesOf(ring);
  const found: [number, number][] = [];

  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const adjacent = j === i + 1 || (i === 0 && j === edges.length - 1);
      if (adjacent) continue;
      if (segmentsIntersect(edges[i][0], edges[i][1], edges[j][0], edges[j][1])) {
        found.push([i, j]);
      }
    }
  }
  return found;
}

describe("seeded airspace geometry", () => {
  it("has no self-intersecting ring", () => {
    for (const zone of RIYADH_ZONES) {
      for (const [index, ring] of ringsOf(zone.geometry).entries()) {
        expect(
          selfIntersections(ring),
          `${zone.code} ring ${index} crosses itself`,
        ).toEqual([]);
      }
    }
  });

  it("closes every ring, and gives it enough distinct vertices to have an interior", () => {
    for (const zone of RIYADH_ZONES) {
      for (const [index, ring] of ringsOf(zone.geometry).entries()) {
        const label = `${zone.code} ring ${index}`;
        const first = ring[0];
        const last = ring[ring.length - 1];

        expect(first, `${label} is empty`).toBeDefined();
        expect([last[0], last[1]], `${label} is not closed`).toEqual([
          first[0],
          first[1],
        ]);
        // Three distinct corners plus the repeated closing vertex.
        expect(ring.length, `${label} is degenerate`).toBeGreaterThanOrEqual(4);
      }
    }
  });

  /**
   * The check that proves the check. Without it, a `selfIntersections` that
   * always returned `[]` would make the suite above pass and mean nothing —
   * which is exactly the failure mode a geometry assertion is prone to.
   */
  it("detects a bow-tie", () => {
    const bowTie: LinearRing = [
      [0, 0],
      [2, 2],
      [2, 0],
      [0, 2],
      [0, 0],
    ];
    expect(selfIntersections(bowTie).length).toBeGreaterThan(0);
  });

  it("passes a plain square", () => {
    const square: LinearRing = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ];
    expect(selfIntersections(square)).toEqual([]);
  });
});
