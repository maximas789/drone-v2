import type { BoundingBox, Geometry, LinearRing, Position } from "@/lib/geo";
import { computeBbox } from "@/lib/geo/bbox";

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

function orientation(a: Position, b: Position, c: Position): number {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

function onSegment(a: Position, b: Position, p: Position): boolean {
  return (
    Math.min(a[0], b[0]) <= p[0] &&
    p[0] <= Math.max(a[0], b[0]) &&
    Math.min(a[1], b[1]) <= p[1] &&
    p[1] <= Math.max(a[1], b[1])
  );
}

/** Proper or touching intersection of two segments. */
export function segmentsIntersect(
  a1: Position,
  a2: Position,
  b1: Position,
  b2: Position,
): boolean {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  if (o1 !== o2 && o3 !== o4) return true;

  // Collinear and overlapping counts: an area whose edge runs along a no-fly
  // boundary is touching it, and touching denies.
  if (o1 === 0 && onSegment(a1, a2, b1)) return true;
  if (o2 === 0 && onSegment(a1, a2, b2)) return true;
  if (o3 === 0 && onSegment(b1, b2, a1)) return true;
  if (o4 === 0 && onSegment(b1, b2, a2)) return true;

  return false;
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
