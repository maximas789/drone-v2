import type { BoundingBox, Geometry, LinearRing } from "./index";

/**
 * The **one** implementation of bbox derivation. The seed uses it (F04) and so
 * does every admin zone write (F23). Two implementations would drift, and the
 * symptom would be a zone that the map's viewport query silently omits.
 *
 * Pure: no database, no React, no request context. Safe for the browser.
 */

function rings(geometry: Geometry): readonly LinearRing[] {
  return geometry.type === "Polygon"
    ? geometry.coordinates
    : geometry.coordinates.flat();
}

export function computeBbox(geometry: Geometry): BoundingBox {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const ring of rings(geometry)) {
    for (const [lng, lat] of ring) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }

  if (!Number.isFinite(minLat)) {
    throw new Error("computeBbox: geometry has no coordinates");
  }
  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Counts every position, interior rings included. Stored so the admin UI can
 * warn before someone saves a 40,000-vertex trace that would make the
 * ray-cast crawl on every map click.
 */
export function countVertices(geometry: Geometry): number {
  return rings(geometry).reduce((total, ring) => total + ring.length, 0);
}

export function bboxOverlaps(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.minLat <= b.maxLat &&
    a.maxLat >= b.minLat &&
    a.minLng <= b.maxLng &&
    a.maxLng >= b.minLng
  );
}

/**
 * Saudi Arabia's extent, generously. Not a validation rule — a **reversal
 * detector**. A `[lat, lng]` pair written where `[lng, lat]` was meant puts
 * Riyadh at 46.7 °N 24.7 °E, in Ukraine, and this is what says so loudly
 * instead of authorising a flight over open water.
 */
export const SAUDI_BOUNDS = {
  minLat: 16,
  maxLat: 33,
  minLng: 34,
  maxLng: 56,
} as const;

export function assertWithinSaudiArabia(geometry: Geometry, label: string) {
  for (const ring of rings(geometry)) {
    for (const position of ring) {
      const [lng, lat] = position;
      if (
        lat < SAUDI_BOUNDS.minLat ||
        lat > SAUDI_BOUNDS.maxLat ||
        lng < SAUDI_BOUNDS.minLng ||
        lng > SAUDI_BOUNDS.maxLng
      ) {
        throw new Error(
          `${label}: position [${lng}, ${lat}] is outside Saudi Arabia. ` +
            `Coordinates are [lng, lat] — this pair looks reversed.`,
        );
      }
    }
  }
}

/** Every ring must be closed: the last position repeats the first. */
export function assertRingsClosed(geometry: Geometry, label: string) {
  for (const ring of rings(geometry)) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (ring.length < 4) {
      throw new Error(`${label}: a ring needs at least 4 positions when closed`);
    }
    if (first[0] !== last[0] || first[1] !== last[1]) {
      throw new Error(`${label}: ring is not closed`);
    }
  }
}
