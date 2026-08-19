import type { Geometry, LinearRing } from "./index";
import { signedDoubleArea } from "./winding";

/**
 * How big is this polygon, in square metres — **approximately, and that is
 * enough.**
 *
 * The only caller is a sanity floor: a zone under about 0.01 km² is a
 * mis-click, not airspace. Nothing in this app computes anything from an area,
 * so the accuracy that matters is "is this ten thousand square metres or ten",
 * and for that an equirectangular approximation about the polygon's own mean
 * latitude is comfortably right — under a tenth of a percent over a city.
 *
 * **A degree of longitude is not a degree of latitude**, which is the whole
 * reason this file exists rather than a `signedDoubleArea` call at the call
 * site: at Riyadh's 24.7°N a degree of longitude is about 101 km against
 * latitude's 111, and taking the shoelace sum for an area would overstate every
 * zone by a tenth. A proper geodesic area needs no more than this does and
 * would invite somebody to believe the number to the square metre.
 *
 * Holes subtract, because a hole is not part of the zone. `MultiPolygon` parts
 * add.
 */

/** WGS84 mean radius, metres. */
const EARTH_RADIUS_M = 6_371_008.8;
const DEG_TO_M = (Math.PI / 180) * EARTH_RADIUS_M;

/** Mean latitude of a ring's positions, for the longitude scale factor. */
function meanLatitude(ring: LinearRing): number {
  let sum = 0;
  for (const [, lat] of ring) sum += lat;
  return ring.length === 0 ? 0 : sum / ring.length;
}

/** Unsigned area of one ring, square metres. */
function ringAreaSqM(ring: LinearRing): number {
  if (ring.length < 4) return 0;
  const scale = Math.cos((meanLatitude(ring) * Math.PI) / 180);
  // The shoelace sum is *twice* the signed area, in square degrees.
  const squareDegrees = Math.abs(signedDoubleArea(ring)) / 2;
  return squareDegrees * DEG_TO_M * DEG_TO_M * scale;
}

export function approximateAreaSqM(geometry: Geometry): number {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

  let total = 0;
  for (const rings of polygons) {
    rings.forEach((ring, index) => {
      // Outer ring adds; every interior ring is a hole and takes away.
      total += index === 0 ? ringAreaSqM(ring) : -ringAreaSqM(ring);
    });
  }
  // A hole larger than its outer ring would give a negative total. The
  // validator refuses that case on its own terms; clamping here keeps this
  // function from ever handing back a negative area.
  return Math.max(0, total);
}
