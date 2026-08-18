/**
 * Map constants. **No API key anywhere in this file, and none in `.env`.**
 *
 * That is a product requirement, not a convenience: Ajniha is a proposal
 * somebody else has to be able to clone and run, and a map that needs a billing
 * account is a map the reviewer never sees.
 */

/**
 * OpenFreeMap — open vector tiles, no key, no account, no usage cap.
 *
 * `liberty` rather than `bright` or `positron`: it carries the most place
 * labels of the three, and this map's job is to let a pilot recognise where a
 * zone actually is. A near-blank basemap makes a polygon float.
 */
export const TILE_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/**
 * Served from our own origin, not a CDN — see `scripts/vendor-rtl-plugin.mts`.
 * MapLibre's worker loads this with `importScripts`, so it must be a URL rather
 * than a bundled import.
 */
export const RTL_PLUGIN_URL = "/vendor/mapbox-gl-rtl-text.js";

/** Riyadh. Matches the seeded city so the map opens on the authored airspace. */
export const DEFAULT_CENTER: [lng: number, lat: number] = [46.68, 24.72];
export const DEFAULT_ZOOM = 9;

/**
 * Wide enough to hold the seeded extent with room to pan, tight enough that a
 * viewport query never asks for more than `/api/zones/geojson` will return —
 * that route refuses a bbox spanning more than 5°.
 */
export const MIN_ZOOM = 6;
export const MAX_ZOOM = 16;

/**
 * `moveend` fires once per gesture, but a flick can chain several. 300 ms
 * collapses a pan-and-correct into one request.
 */
export const VIEWPORT_DEBOUNCE_MS = 300;

/**
 * How long to wait for the first tile before declaring the basemap unreachable
 * and falling back to polygons on a plain ground. Long enough for a slow phone
 * on 3G, short enough that nobody stares at an empty rectangle.
 */
export const TILE_TIMEOUT_MS = 8000;

/**
 * The style used when the basemap cannot be reached.
 *
 * **An unreachable tile host must not blank the screen.** The airspace is our
 * data, not OpenFreeMap's, so a network failure at their end should cost the
 * reader the streets and the place names — not the answer to "where are the
 * zones". This style has no external sources at all, so it cannot fail the same
 * way, and the zone layers go on top of it exactly as they would over tiles.
 * The map still pans and zooms.
 *
 * `glyphs` still points at OpenFreeMap: if the failure was partial the labels
 * come back, and if it was total they simply do not draw. Either is better than
 * refusing to build the style.
 */
export const FALLBACK_STYLE = {
  version: 8 as const,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {},
  layers: [
    {
      id: "background",
      type: "background" as const,
      paint: { "background-color": "#e9eef2" },
    },
  ],
};

/**
 * The label expression, and the `coalesce` is the whole point.
 *
 * OpenMapTiles carries `name:ar` for most Saudi features but **not all** — and
 * a plain `["get", "name:ar"]` renders those as nothing at all, so the map
 * quietly loses labels rather than showing a Latin one. Written here rather
 * than inline in the layer code so both the basemap relabelling and any future
 * caller use the same fallback.
 */
export function localisedNameExpression(
  locale: string,
): readonly unknown[] {
  return locale === "ar"
    ? ["coalesce", ["get", "name:ar"], ["get", "name"]]
    : ["coalesce", ["get", "name:en"], ["get", "name"]];
}
