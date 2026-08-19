import type { Geometry, LinearRing, Position } from "./index";

/**
 * Ring winding — **which way round a ring is drawn, and why it matters.**
 *
 * GeoJSON (RFC 7946 §3.1.6) says an outer ring runs **counter-clockwise** and
 * every interior ring **clockwise**. This app's own containment test does not
 * care: `pointInRing` casts a ray and counts crossings, which gives the same
 * answer whichever way the ring was traced. So why enforce it at all?
 *
 * Because everything *else* does. `fill-rule="evenodd"` in the SVG surfaces
 * happens to be winding-blind too, but MapLibre's fill layer is not, and
 * neither is any tool a regulator might open the exported GeoJSON in — QGIS,
 * turf, a validator. A hole wound the same way as its outer ring renders as a
 * second solid island in about half the software that will ever read it, and
 * KKIA's ring **is** a hole. Storing it correctly is what stops that being
 * somebody else's problem later.
 *
 * Pure and browser-safe, like everything in this folder.
 */

/**
 * Twice the signed area of a ring, in square degrees.
 *
 * The shoelace sum. **Positive is counter-clockwise** in a `[lng, lat]` frame
 * where latitude increases northwards, which is the frame this whole codebase
 * uses. Never used as an area — see `approximateAreaSqM`, which knows that a
 * degree of longitude is not a degree of latitude.
 */
export function signedDoubleArea(ring: LinearRing): number {
  let sum = 0;
  for (let i = 1; i < ring.length; i++) {
    const [x1, y1] = ring[i - 1];
    const [x2, y2] = ring[i];
    sum += x1 * y2 - x2 * y1;
  }
  return sum;
}

/**
 * Counter-clockwise, by the shoelace sign.
 *
 * A degenerate ring — zero area, every point collinear — is reported as **not**
 * counter-clockwise, and reversing it changes nothing. That is the honest
 * answer: such a ring has no orientation, and the validator refuses it long
 * before anybody asks this question of it.
 */
export function isCounterClockwise(ring: LinearRing): boolean {
  return signedDoubleArea(ring) > 0;
}

/** A ring traced the other way. The first position stays first. */
export function reverseRing(ring: LinearRing): LinearRing {
  return [...ring].reverse() as unknown as readonly Position[];
}

/**
 * The geometry with every ring wound the way GeoJSON says it should be:
 * **outer counter-clockwise, holes clockwise.**
 *
 * Returns the same object when nothing needed changing, so a caller can tell
 * whether it corrected anything by identity — which is how `validateGeometry`
 * decides whether to raise the `winding_corrected` warning. Silently fixing a
 * hole and saying nothing would leave an admin believing they drew it right.
 */
export function ensureWinding(geometry: Geometry): Geometry {
  let changed = false;

  const fixPolygon = (rings: readonly LinearRing[]): readonly LinearRing[] =>
    rings.map((ring, index) => {
      // Index 0 is the outer boundary; everything after it is a hole.
      const wantCounterClockwise = index === 0;
      if (isCounterClockwise(ring) === wantCounterClockwise) return ring;
      changed = true;
      return reverseRing(ring);
    });

  if (geometry.type === "Polygon") {
    const coordinates = fixPolygon(geometry.coordinates);
    return changed ? { type: "Polygon", coordinates } : geometry;
  }

  const coordinates = geometry.coordinates.map(fixPolygon);
  return changed ? { type: "MultiPolygon", coordinates } : geometry;
}
