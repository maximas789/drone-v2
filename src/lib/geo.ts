/**
 * GeoJSON geometry, WGS84.
 *
 * **`[lng, lat]`, always.** The type is named `Position` rather than aliased to
 * `[number, number]` so that a reversed pair is a type error at the boundary
 * instead of a drone authorised in the Indian Ocean. Every function that takes
 * a coordinate takes a `Position`.
 *
 * Lives outside `src/lib/airspace/` because the schema needs it too, and the
 * airspace engine must stay importable by the browser map.
 */
export type Position = readonly [lng: number, lat: number];

/** A ring is closed: the last position repeats the first. */
export type LinearRing = readonly Position[];

export type Polygon = {
  type: "Polygon";
  /** First ring is the outer boundary; any others are holes. */
  coordinates: readonly LinearRing[];
};

export type MultiPolygon = {
  type: "MultiPolygon";
  coordinates: readonly (readonly LinearRing[])[];
};

export type Geometry = Polygon | MultiPolygon;

/**
 * Denormalised bounding box, stored alongside the geometry as a SQL
 * pre-filter. `doublePrecision`, never `numeric` — Drizzle maps `numeric` to
 * `string`, which would put a `Number()` parse inside the point-in-polygon
 * hot loop.
 */
export type BoundingBox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};
