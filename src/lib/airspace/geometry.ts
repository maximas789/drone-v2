import type { BoundingBox, Geometry, LinearRing, Position } from "@/lib/geo";
import { computeBbox } from "@/lib/geo/bbox";
import { segmentsIntersect } from "@/lib/geo/segments";

/**
 * **`segmentsIntersect` moved to `src/lib/geo/segments.ts` in F23a** and is
 * re-exported here so F12's callers keep the import they have. F23's
 * self-intersection check needs the identical arithmetic, and this file already
 * imports from `@/lib/geo` — putting it the other way round would have made a
 * cycle, and a second copy would let "touching denies" and "this polygon is
 * valid" drift apart on what an intersection is.
 */
export { segmentsIntersect };

/**
 * Point-in-polygon, and the drawn-area predicates built on it. **Pure** — this
 * file runs unchanged in the browser map and inside the booking transaction.
 *
 * No PostGIS. The bbox columns are the SQL pre-filter; the real containment
 * test is here, so the same answer comes out on both sides of the wire.
 */

/**
 * Ray casting on the **half-open rule** `(yi > y) !== (yj > y)`.
 *
 * That asymmetry is what makes a point on a shared edge between two abutting
 * zones resolve to exactly one of them instead of both or neither — which is
 * not a curiosity, because the seeded permitted zones abut and a pilot who taps
 * the seam has to get one answer.
 */
export function pointInRing(point: Position, ring: LinearRing): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    if (yi > y !== yj > y) {
      // Where the edge crosses the horizontal ray through the point.
      const xCross = xj + ((y - yj) * (xi - xj)) / (yi - yj);
      if (x < xCross) inside = !inside;
    }
  }

  return inside;
}

/**
 * Inside the outer ring **and** not inside any interior ring.
 *
 * The holes matter: `RUH-NF-KKIA` is an annulus whose core sits inside the
 * airfield perimeter and is managed by the airport itself. A point in that core
 * is not inside the CTR polygon — and this is the assertion F04 deferred to
 * this feature rather than write a second ray-cast to check it.
 */
export function pointInPolygon(
  point: Position,
  rings: readonly LinearRing[],
): boolean {
  const [outer, ...holes] = rings;
  if (!outer || !pointInRing(point, outer)) return false;
  return !holes.some((hole) => pointInRing(point, hole));
}

export function pointInMultiPolygon(
  point: Position,
  polygons: readonly (readonly LinearRing[])[],
): boolean {
  return polygons.some((rings) => pointInPolygon(point, rings));
}

export function pointInGeometry(point: Position, geometry: Geometry): boolean {
  return geometry.type === "Polygon"
    ? pointInPolygon(point, geometry.coordinates)
    : pointInMultiPolygon(point, geometry.coordinates);
}

export function bboxContainsPoint(bbox: BoundingBox, point: Position): boolean {
  const [lng, lat] = point;
  return (
    lat >= bbox.minLat &&
    lat <= bbox.maxLat &&
    lng >= bbox.minLng &&
    lng <= bbox.maxLng
  );
}

/**
 * The guarded entry point. Every containment test goes through here, so the
 * cheap rectangle comparison always runs before the ray-cast — on a viewport
 * holding a dozen zones that is the difference between a map that answers on
 * every pan and one that stutters.
 */
export function zoneContainsPoint(
  zone: { geometry: Geometry; bbox: BoundingBox },
  point: Position,
): boolean {
  if (!bboxContainsPoint(zone.bbox, point)) return false;
  return pointInGeometry(point, zone.geometry);
}

// --- Drawn areas ----------------------------------------------------------

function ringsOf(geometry: Geometry): readonly LinearRing[] {
  return geometry.type === "Polygon"
    ? geometry.coordinates
    : geometry.coordinates.flat();
}

function edgesCross(a: Geometry, b: Geometry): boolean {
  for (const ringA of ringsOf(a)) {
    for (let i = 1; i < ringA.length; i++) {
      for (const ringB of ringsOf(b)) {
        for (let j = 1; j < ringB.length; j++) {
          if (
            segmentsIntersect(ringA[i - 1], ringA[i], ringB[j - 1], ringB[j])
          ) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Any overlap at all: a vertex of one inside the other, or a pair of edges
 * crossing. Used for the no-fly test, where **touching is denying**.
 */
export function areaIntersectsGeometry(area: Geometry, other: Geometry): boolean {
  const areaBbox = computeBbox(area);
  const otherBbox = computeBbox(other);
  if (
    areaBbox.minLat > otherBbox.maxLat ||
    areaBbox.maxLat < otherBbox.minLat ||
    areaBbox.minLng > otherBbox.maxLng ||
    areaBbox.maxLng < otherBbox.minLng
  ) {
    return false;
  }

  for (const ring of ringsOf(area)) {
    for (const position of ring) {
      if (pointInGeometry(position, other)) return true;
    }
  }
  for (const ring of ringsOf(other)) {
    for (const position of ring) {
      if (pointInGeometry(position, area)) return true;
    }
  }
  return edgesCross(area, other);
}

/**
 * Containment, which is what a permitted zone demands of a drawn area: **every**
 * vertex inside, and no edge of the area crossing out through the boundary.
 *
 * The vertex test alone is not enough — a bow-tie or a long span across a
 * concave zone can have every corner inside while the area itself leaves. The
 * edge test is what closes that, and it is the reason the rule for an area is
 * stricter than the rule for a point rather than the same rule applied twice.
 */
export function areaWithinGeometry(area: Geometry, other: Geometry): boolean {
  for (const ring of ringsOf(area)) {
    for (const position of ring) {
      if (!pointInGeometry(position, other)) return false;
    }
  }
  return !edgesCross(area, other);
}
