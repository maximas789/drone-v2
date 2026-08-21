"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { Map as MapLibreMap, NavigationControl } from "maplibre-gl";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { computeBbox } from "@/lib/geo/bbox";
import type { Geometry } from "@/lib/geo";
import {
  FALLBACK_STYLE,
  MAX_ZOOM,
  MIN_ZOOM,
  TILE_STYLE_URL,
  TILE_TIMEOUT_MS,
  localisedNameExpression,
} from "@/lib/maps/config";
import { resolveZoneColors } from "@/lib/maps/color-resolve";
import { ensureRtlTextPlugin } from "@/lib/maps/rtl-plugin";
import type { Locale } from "@/lib/locale";

/**
 * **The one diff that is a picture.** A boundary before and after, overlaid.
 *
 * Every other field in this log diffs as two strings. A polygon does not: two
 * hundred coordinates against two hundred coordinates tells a reader nothing,
 * and this is the change that matters most, because moving a boundary can put
 * an already-approved flight inside a no-fly area. So the audit browser draws
 * it — old boundary dashed, new boundary solid and filled — on the smallest map
 * that can carry the answer.
 *
 * **The second MapLibre surface in this build, and it carries every trap the
 * first one paid for.**
 *
 * - `ensureRtlTextPlugin()` **first, always.** It calls `setWorkerUrl` before
 *   anything can touch the worker pool — without which MapLibre resolves its
 *   own worker against a hashed chunk URL that 404s, never listens for `error`
 *   on the `Worker` it just made, and draws a blank canvas with a clean console
 *   (thread 53). It also owns `setRTLTextPlugin`, which may be called exactly
 *   once per document and throws on the second call — which is precisely what a
 *   *second* map surface would otherwise do.
 * - **`load` may already have happened.** With the basemap in cache, MapLibre
 *   can finish loading between construction and the moment the listener
 *   attaches, and then `once("load")` never fires and the polygons never
 *   appear. `whenStyleReady` asks `isStyleLoaded()` first.
 * - **`dir="ltr"` on the container.** East stays east whatever language the
 *   page is in. It goes on the map's own element and nothing else — this is
 *   geometry, not text.
 * - **No SVG text anywhere on this surface.** The legend below is ordinary HTML
 *   in the page's own direction, so F25a's `text-anchor` trap — `end` anchors
 *   the *left* edge under `ar`, which put every y-axis tick on `/admin/analytics`
 *   backwards with every check green — cannot arise here. A tick label needing
 *   an anchor would go through `anchorAtMinX`/`anchorAtMaxX`; there is not one.
 * - **A blank map in a screenshot is usually not a blank map** (thread 67).
 *   MapLibre repaints on demand and a CDP capture does not force one. Click the
 *   canvas before believing it.
 */
export function GeometryDiffMap({
  before,
  after,
  locale,
}: {
  before: Geometry;
  after: Geometry;
  locale: Locale;
}) {
  const t = useTranslations("audit");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let fellBack = false;
    let tileTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * **Nothing is built until the row is actually open**, and this is the
     * shape of the component rather than a detail.
     *
     * The map lives inside a `<details>`. While that is closed Chrome skips
     * rendering its contents, and MapLibre built into a skipped subtree never
     * completes a first render pass: `load` never fires, `isStyleLoaded()`
     * stays false for ever, and the layers are therefore never added. The tile
     * timeout meanwhile fires on schedule and swaps in the offline fallback, so
     * the first version drew correct boundaries on a flat grey ground with the
     * tile host perfectly reachable — a convincing impersonation of the
     * `setWorkerUrl` trap in `config.ts` and nothing to do with it.
     *
     * **A `toggle` listener, not a `ResizeObserver`.** The obvious fix was to
     * observe the container and build when it gained a size; it never fired at
     * all. A closed `<details>` still reports a box through
     * `getBoundingClientRect`, so there is no size *change* to observe on
     * opening, and a resize observer skips a subtree whose rendering is
     * skipped. `toggle` is a real DOM event that fires exactly once, on the
     * transition this code actually cares about.
     *
     * `open` is checked first so a row rendered already expanded — which is
     * what a deep link to a single event should be — builds immediately rather
     * than waiting for a toggle that will never come.
     *
     * None of this was visible to `typecheck`, `lint`, `build` or the suite,
     * and only half of it was visible in a screenshot. It was found by reading
     * `isStyleLoaded()` and the layer list off the map through the dev handle.
     */
    const disclosure = container.closest("details");

    if (!disclosure || disclosure.open) {
      void build();
    } else {
      disclosure.addEventListener("toggle", onToggle);
    }

    function onToggle() {
      if (disclosure?.open && !mapRef.current) void build();
    }

    async function build() {
      await ensureRtlTextPlugin();
      if (cancelled || !containerRef.current || mapRef.current) return;

      /**
       * The union of the two boundaries, so a shrink is as visible as a growth.
       * Fitting to the *new* one alone would push the old boundary off the edge
       * of a map whose only job is to compare them.
       */
      const bounds = unionBbox(before, after);

      const map = new MapLibreMap({
        container: containerRef.current,
        style: TILE_STYLE_URL,
        bounds: [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat],
        fitBoundsOptions: { padding: 32, duration: 0 },
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.addControl(new NavigationControl({ showCompass: false }));

      /**
       * A handle for driving this map from the browser console during
       * development — the same one `AirspaceMap` and `ZoneMapEditor` expose,
       * and **never in production**. A live map object on `window` is a piece
       * of the app's internals with no reason to ship.
       */
      if (process.env.NODE_ENV !== "production") {
        (window as unknown as { __ajnihaDiffMap?: unknown }).__ajnihaDiffMap =
          map;
      }

      /**
       * An unreachable tile host must not blank the diff. The boundaries are
       * our data; losing OpenFreeMap should cost the reader the streets and the
       * place names, not the answer to "where did this boundary move to".
       * `fellBack` guards against the infinite `setStyle` loop a failing
       * fallback would otherwise start.
       *
       * **The test is `isStyleLoaded()`, not `loaded()`** — and the difference
       * is the whole reliability of this control. `loaded()` is false until
       * every tile in view has arrived, which on a cold dev chunk took longer
       * than the eight-second deadline on a host that was answering perfectly:
       * the map fell back to the offline style *while the real one was
       * downloading*, then drew nothing at all, because the layers were queued
       * against the style it had just thrown away. The question this timer is
       * actually asking is "can we reach OpenFreeMap", and a style that has
       * parsed is a host that answered.
       */
      tileTimer = setTimeout(() => {
        if (cancelled || fellBack || map.isStyleLoaded()) return;
        fellBack = true;
        map.setStyle(FALLBACK_STYLE);
      }, TILE_TIMEOUT_MS);

      const whenStyleReady = (run: () => void) => {
        if (map.isStyleLoaded()) run();
        else map.once("load", run);
      };

      const draw = () => {
        if (cancelled) return;
        relabel(map, locale);

        /**
         * Through `resolveZoneColors`, never a hex literal and never the raw
         * token: `ZONE_FILL` holds `var(--zone-*)` and MapLibre does not parse
         * `oklch()` at all (thread 65). The resolver paints the computed value
         * to a 1×1 canvas and reads the pixel back.
         */
        const colors = resolveZoneColors(map.getContainer());

        addBoundary(map, "audit-before", before, colors.restricted, true);
        addBoundary(map, "audit-after", after, colors.permitted, false);
      };

      whenStyleReady(draw);
      /**
       * **And on `idle`, which is the event that can actually be relied on
       * here.**
       *
       * `load` never fires on this surface at all — traced, not guessed: the
       * map is constructed the instant the `<details>` opens, and it never
       * reaches the state MapLibre calls loaded, so a lone `once("load", draw)`
       * waits for ever. `styledata` is no better: it fires *while* a style is
       * being installed, so a handler gated on `isStyleLoaded()` sees false
       * every time and the flag flips afterwards with no further event.
       *
       * `idle` fires when the map has finished rendering and gone quiet, and
       * fires again after anything changes it — including the fallback
       * `setStyle`, which drops every layer and would otherwise leave the diff
       * blank. `addBoundary` is idempotent for exactly this reason: calling it
       * more often than strictly necessary costs nothing, and missing the one
       * call that mattered costs the entire diff.
       */
      map.on("idle", draw);
    }

    return () => {
      cancelled = true;
      disclosure?.removeEventListener("toggle", onToggle);
      if (tileTimer) clearTimeout(tileTimer);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [before, after, locale]);

  return (
    <div className="flex flex-col gap-2">
      {/*
        `dir="ltr"` on the map element only. The legend below stays in the
        page's direction, because it is words.
      */}
      <div
        ref={containerRef}
        dir="ltr"
        className="h-64 w-full overflow-hidden rounded-lg border"
        role="img"
        aria-label={t("geometryTitle")}
      />
      <ul className="text-muted-foreground flex flex-wrap gap-4 text-xs">
        <li className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="border-b-2 border-dashed"
            style={{ width: "1.5rem", borderColor: "var(--zone-restricted)" }}
          />
          {t("geometryBefore")}
        </li>
        <li className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="border-b-2"
            style={{ width: "1.5rem", borderColor: "var(--zone-permitted)" }}
          />
          {t("geometryAfter")}
        </li>
      </ul>
      <p className="text-muted-foreground text-xs">{t("geometryNote")}</p>
    </div>
  );
}

/**
 * `["coalesce", ["get", "name:ar"], ["get", "name"]]` — **the fallback is the
 * point.** OpenMapTiles carries `name:ar` for most Saudi features but not all,
 * and a bare `["get", "name:ar"]` renders those as nothing at all, so the map
 * quietly loses labels rather than showing a Latin one.
 */
function relabel(map: MapLibreMap, locale: Locale) {
  const expression = localisedNameExpression(locale);
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== "symbol") continue;
    if (layer.layout?.["text-field"] === undefined) continue;
    try {
      /* `as never`, exactly as `AirspaceMap` does: MapLibre's layout-property
         type is a mutable tuple union and `localisedNameExpression` returns a
         `readonly unknown[]`, which is the correct type for a value two
         renderers share. */
      map.setLayoutProperty(layer.id, "text-field", expression as never);
    } catch {
      /* A layer whose text-field is not a name expression. Leave it alone. */
    }
  }
}

/** One boundary: a fill for the new one, an outline for both. Idempotent. */
function addBoundary(
  map: MapLibreMap,
  id: string,
  geometry: Geometry,
  color: string,
  dashed: boolean,
) {
  if (!map.getSource(id)) {
    map.addSource(id, {
      type: "geojson",
      data: { type: "Feature", properties: {}, geometry } as never,
    });
  }
  if (!dashed && !map.getLayer(`${id}-fill`)) {
    map.addLayer({
      id: `${id}-fill`,
      type: "fill",
      source: id,
      paint: { "fill-color": color, "fill-opacity": 0.18 },
    });
  }
  if (!map.getLayer(`${id}-line`)) {
    map.addLayer({
      id: `${id}-line`,
      type: "line",
      source: id,
      paint: {
        "line-color": color,
        "line-width": 2,
        ...(dashed ? { "line-dasharray": [2, 2] } : {}),
      },
    });
  }
}

function unionBbox(a: Geometry, b: Geometry) {
  const one = computeBbox(a);
  const two = computeBbox(b);
  return {
    minLat: Math.min(one.minLat, two.minLat),
    maxLat: Math.max(one.maxLat, two.maxLat),
    minLng: Math.min(one.minLng, two.minLng),
    maxLng: Math.max(one.maxLng, two.maxLng),
  };
}
