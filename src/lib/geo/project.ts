import type { BoundingBox, Geometry, Position } from "./index";

/**
 * Geometry → SVG path data, for the landing page's static airspace preview.
 *
 * **Pure, and deliberately not a map.** [F20](../../../.claude/plans/features/F20-airspace-map.md)
 * owns the interactive MapLibre surface; this projects the *same seeded
 * polygons* into a flat picture so the front door can show real airspace
 * without a second map implementation, a tile source or `setRTLTextPlugin`.
 * Two things that both call themselves the map is precisely the drift the
 * single-projection rule exists to prevent — so this one cannot pan, cannot
 * zoom, and answers no airspace question. It draws.
 *
 * An **equirectangular** projection with a cosine correction on longitude:
 * over a city-sized extent the error is invisible, and the correction is what
 * stops Riyadh looking horizontally stretched. No projection library.
 */

export type Projection = {
  /** `viewBox` width and height, in user units. */
  width: number;
  height: number;
  project: (position: Position) => readonly [x: number, y: number];
};

/**
 * `padding` is in the same user units as `width`, and is applied inside the
 * viewBox so a polygon touching the extent is not clipped by the stroke.
 */
export function projectionFor(
  bounds: BoundingBox,
  { width = 1000, padding = 12 }: { width?: number; padding?: number } = {},
): Projection {
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 1e-9);
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 1e-9);

  /**
   * A degree of longitude is shorter than a degree of latitude everywhere but
   * the equator, by `cos(latitude)`. At Riyadh's ~24.7° that is about 0.91:
   * without it the city is drawn 10 % too wide, which on a picture of real
   * airspace is a wrong shape rather than a stylistic choice.
   */
  const midLatRadians = (((bounds.minLat + bounds.maxLat) / 2) * Math.PI) / 180;
  const lngScale = Math.cos(midLatRadians);

  const drawable = width - padding * 2;
  const height = padding * 2 + (drawable * latSpan) / (lngSpan * lngScale);

  return {
    width,
    height,
    project([lng, lat]) {
      const x = padding + ((lng - bounds.minLng) / lngSpan) * drawable;
      /**
       * **Y is flipped.** Latitude increases northward and SVG's y increases
       * downward, so projecting them directly would print the city upside
       * down — a mistake that looks like a plausible map until somebody who
       * knows Riyadh sees it.
       */
      const y =
        padding + ((bounds.maxLat - lat) / latSpan) * (height - padding * 2);
      return [round(x), round(y)] as const;
    },
  };
}

/** The union of several bounding boxes — the extent the preview has to cover. */
export function unionBounds(boxes: readonly BoundingBox[]): BoundingBox | null {
  if (boxes.length === 0) return null;
  return boxes.reduce((union, box) => ({
    minLat: Math.min(union.minLat, box.minLat),
    maxLat: Math.max(union.maxLat, box.maxLat),
    minLng: Math.min(union.minLng, box.minLng),
    maxLng: Math.max(union.maxLng, box.maxLng),
  }));
}

/**
 * SVG path data for a polygon or multipolygon, holes included.
 *
 * Every ring is emitted as its own closed subpath, which is what makes
 * `fill-rule="evenodd"` cut a hole where a ring sits inside another — a
 * permitted carve-out drawn inside a restricted zone has to be a hole, not a
 * shape painted on top, or the colour underneath decides what the reader sees.
 */
export function pathFor(geometry: Geometry, projection: Projection): string {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

  const subpaths: string[] = [];
  for (const rings of polygons) {
    for (const ring of rings) {
      if (ring.length === 0) continue;
      const points = ring.map((position) => projection.project(position));
      const [first, ...rest] = points;
      if (!first) continue;
      subpaths.push(
        `M${first[0]} ${first[1]}` +
          rest.map(([x, y]) => `L${x} ${y}`).join("") +
          "Z",
      );
    }
  }

  return subpaths.join("");
}

/** Two decimals is ~1 m at this scale, and keeps the markup readable. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
