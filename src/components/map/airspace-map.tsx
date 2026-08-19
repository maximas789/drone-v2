"use client";

import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  type ErrorEvent,
  type GeoJSONSource,
  type LayerSpecification,
  type MapMouseEvent,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DecisionStatus } from "@/lib/airspace/types";
import type { Position } from "@/lib/geo";
import { computeBbox } from "@/lib/geo/bbox";
import { unionBounds } from "@/lib/geo/project";
import type { Locale } from "@/lib/locale";
import { resolveZoneColors } from "@/lib/maps/color-resolve";
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  FALLBACK_STYLE,
  MAX_ZOOM,
  MIN_ZOOM,
  TILE_STYLE_URL,
  TILE_TIMEOUT_MS,
  VIEWPORT_DEBOUNCE_MS,
  localisedNameExpression,
} from "@/lib/maps/config";
import {
  DRAW_ORDER,
  HATCH_IMAGE_ID,
  PROBE_SOURCE_ID,
  ZONE_SOURCE_ID,
  createHatchImage,
  fillLayer,
  hatchLayer,
  labelLayer,
  outlineLayer,
  probeGeoJson,
  probeHaloLayer,
  probeMarkerLayer,
  zonesToGeoJson,
  type DrawableZone,
} from "@/lib/maps/layer-styles";
import { ensureRtlTextPlugin } from "@/lib/maps/rtl-plugin";

/**
 * The interactive airspace map.
 *
 * **It needs `setMapWorkerUrl()` before it is constructed**, which
 * `ensureRtlTextPlugin` does — see `src/lib/maps/worker-url.ts`. Without it
 * MapLibre builds its worker pool from a URL that 404s after bundling and every
 * worker round-trip hangs silently, which draws a blank canvas over a perfectly
 * healthy basemap and reports no error at all. That was thread 53 and it cost a
 * session; the ordering is not incidental.
 *
 * **F20a draws; F20b answers.** This renders the seeded zones over a real
 * basemap and nothing more — there is no tap-to-evaluate here yet, because the
 * status panel, the altitude slider and the drone selector are F20b, and half a
 * status panel is worse than none. What is here is the whole picture: the
 * default-deny restricted ground, the permitted carve-outs inside it, the
 * no-fly overlays on top, and KKIA's annulus as a genuine hole.
 *
 * **This component replaces the SVG preview, not the data.** `zonesToGeoJson`
 * takes the same rows `listActiveZones` returns, so the front door, `/zones`
 * and this map are all drawing the identical set — there is no second source of
 * truth about where a zone is.
 *
 * **`dir="ltr"` on the container in both locales.** Geography is not mirrored:
 * east stays east on a map of a real city whatever language its labels are in.
 * Only the chrome around the map flips. MapLibre also positions its own
 * controls with physical CSS it does not expose, so an `rtl` container puts the
 * zoom buttons somewhere it did not intend.
 */

type MapStatus = "loading" | "ready" | "tiles-failed";

export function AirspaceMap({
  zones,
  locale,
  labels,
  probePoint,
  probeStatus,
  onPointSelected,
  onViewportChange,
  className,
}: {
  /**
   * **Controlled.** The zones come from `AirspaceExplorer`, which owns them
   * because it also has to *evaluate* against them — two components holding
   * their own copy is how a map ends up drawing one set of polygons and
   * answering questions about another.
   *
   * The first value is server-rendered, which is not an optimisation: a reader
   * whose `/api/zones/geojson` call fails still sees the airspace, in the same
   * way the fallback style covers a reader whose *tiles* fail. The two
   * degradations are independent and both are handled.
   */
  zones: readonly DrawableZone[];
  locale: Locale;
  /** Pre-translated: this is a client component and the map has no provider. */
  labels: { tileFailure: string; loading: string; mapLabel: string };
  /** Where the reader last tapped, and the verdict that paints its halo. */
  probePoint: Position | null;
  probeStatus: DecisionStatus;
  onPointSelected: (point: Position) => void;
  /**
   * `minLng,minLat,maxLng,maxLat` rounded to three decimals — ~100 m, far finer
   * than a zone edge and coarse enough that a one-pixel drag is not a new
   * viewport. Debounced here because the debounce is about map *gestures*; what
   * the explorer does with the box is its own business.
   */
  onViewportChange: (bbox: string) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");

  /**
   * Live mirrors of the props, because **the MapLibre handlers below are
   * registered exactly once** and would otherwise close over the first render's
   * values for the life of the map. A stale `onPointSelected` is the subtle
   * version of that bug: the map keeps working and every tap is reported to a
   * callback holding last week's state.
   */
  const zonesRef = useRef<readonly DrawableZone[]>(zones);
  const selectRef = useRef(onPointSelected);
  const viewportRef = useRef(onViewportChange);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * The probe, mirrored for the same reason as the zones: `installZoneLayers`
   * runs inside a MapLibre event handler and needs the *current* marker, not
   * the one that existed when the style started loading.
   */
  const probeRef = useRef({ point: probePoint, status: probeStatus });

  /**
   * Refreshed after **every** render, deliberately without a dependency array.
   * Writing a ref during render is what React's rules forbid, and the initial
   * `useRef` values already cover the window before the first effect runs —
   * which is before MapLibre exists, let alone fires a handler.
   */
  useEffect(() => {
    zonesRef.current = zones;
    selectRef.current = onPointSelected;
    viewportRef.current = onViewportChange;
    probeRef.current = { point: probePoint, status: probeStatus };
  });

  /**
   * Adds the zone source, the hatch image and every zone layer to whatever
   * style is currently loaded.
   *
   * Called again after a `setStyle`, because **a style swap discards every
   * source and layer the app added** — including on the fallback path below.
   * Forgetting this is how a tile failure ends up showing an empty grey
   * rectangle, which is the exact outcome the fallback exists to prevent.
   */
  const installZoneLayers = useCallback(
    (map: MapLibreMap) => {
      if (map.getSource(ZONE_SOURCE_ID)) return;

      const colors = resolveZoneColors(
        containerRef.current ?? document.documentElement,
      );

      map.addSource(ZONE_SOURCE_ID, {
        type: "geojson",
        data: zonesToGeoJson(zonesRef.current, locale) as never,
      });

      const hatch = createHatchImage(colors.no_fly);
      if (hatch && !map.hasImage(HATCH_IMAGE_ID)) {
        map.addImage(HATCH_IMAGE_ID, hatch, { pixelRatio: 2 });
      }

      /**
       * **Idempotent, layer by layer.** `addLayer` throws on a duplicate id,
       * and an image registered with `addImage` survives a `setStyle` while the
       * layers do not — so a fallback swap can arrive with some of this already
       * present. Adding blind turns a recoverable partial state into a thrown
       * error inside a MapLibre event handler.
       */
      const add = (layer: LayerSpecification) => {
        if (!map.getLayer(layer.id)) map.addLayer(layer);
      };

      // Back to front: the strictest rule ends up on top.
      for (const kind of DRAW_ORDER) {
        add(fillLayer(kind, colors));
        add(outlineLayer(kind, colors));
      }
      // Only when the image actually exists — a `fill-pattern` naming a missing
      // image renders nothing at all, losing the no-fly fill rather than just
      // its texture.
      if (hatch) add(hatchLayer());
      add(labelLayer(colors));

      /**
       * The probe goes on **last, so it is on top of everything.** A marker
       * hidden under a no-fly fill would be a map that will not show you where
       * you just asked, in precisely the case where the answer matters most.
       */
      if (!map.getSource(PROBE_SOURCE_ID)) {
        map.addSource(PROBE_SOURCE_ID, {
          type: "geojson",
          data: probeGeoJson(probeRef.current.point, probeRef.current.status) as never,
        });
      }
      add(probeHaloLayer(colors));
      add(probeMarkerLayer(colors));
    },
    [locale],
  );

  /**
   * Rewrites the **basemap's** own labels to the reader's language.
   *
   * Every symbol layer in the OpenFreeMap style hard-codes `["get","name"]`,
   * which is the local-script name — so an Arabic reader gets Arabic for Riyadh
   * and Latin for everything the tiles happen to store that way. The
   * `coalesce` in `localisedNameExpression` is what keeps a feature with no
   * translated name from rendering blank instead of falling back.
   */
  const relabelBasemap = useCallback(
    (map: MapLibreMap) => {
      const expression = localisedNameExpression(locale);
      for (const layer of map.getStyle().layers ?? []) {
        if (layer.type !== "symbol") continue;
        const field = layer.layout?.["text-field"];
        if (field === undefined) continue;
        try {
          map.setLayoutProperty(layer.id, "text-field", expression as never);
        } catch {
          // A layer whose text-field is not a plain name lookup (a shield, a
          // ref number) is not ours to rewrite. Skipping one label is fine;
          // throwing out of the style-load handler would lose the whole map.
        }
      }
    },
    [locale],
  );

  /**
   * Opens on the airspace, rather than on a fixed centre that happens to be
   * near it.
   *
   * `DEFAULT_CENTER` and `DEFAULT_ZOOM` are a sane starting camera, but they are
   * a *guess* about the seed — and at zoom 9 they cut off the northern and
   * southern zones, so a page whose entire purpose is to publish the airspace
   * opened showing about three quarters of it. The extent is derived from the
   * same rows being drawn, so it cannot disagree with them, and re-seeding with
   * different geometry moves the camera with it.
   *
   * **Once, on first load only.** Refitting after the viewport refetch would
   * yank the camera back every time a pilot panned, and refitting after a
   * fallback style swap would move the ground under someone already reading it.
   */
  const fitToZones = useCallback((map: MapLibreMap) => {
    const bounds = unionBounds(
      zonesRef.current.map((zone) => computeBbox(zone.geometry)),
    );
    if (!bounds) return;

    map.fitBounds(
      [
        [bounds.minLng, bounds.minLat],
        [bounds.maxLng, bounds.maxLat],
      ],
      // Padding in pixels, so the outermost zone edge is not flush against the
      // frame. `animate: false` because this is the first paint, not a move.
      { padding: 32, animate: false, maxZoom: MAX_ZOOM },
    );
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    let cancelled = false;
    let fellBack = false;
    /**
     * Set once `style.load` has fired. `map.isStyleLoaded()` is not a
     * substitute: it also reads false while the *fallback* style is loading, so
     * using it let an error in that window re-enter the fallback path.
     */
    let styleLoaded = false;
    /** See `fitToZones` — the camera is placed once, not on every style load. */
    let fitted = false;
    let tileTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * **The plugin before the map.** `setRTLTextPlugin` has to be registered
     * before the first instance exists or the Arabic labels in the very first
     * paint come out disconnected and reversed, and it can only be called once
     * per document — both of which `ensureRtlTextPlugin` owns.
     */
    void ensureRtlTextPlugin().then(() => {
      if (cancelled || !containerRef.current) return;

      const map = new MapLibreMap({
        container: containerRef.current,
        style: TILE_STYLE_URL,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        // The basemap's own attribution is required by ODbL; MapLibre reads it
        // out of the style, so this only has to not be switched off.
        attributionControl: { compact: true },
      });
      mapRef.current = map;

      /**
       * A handle for driving the map from the browser console during
       * development. **Never in production** — this screen is public, and a
       * global reference to a live map object is a needless piece of the app's
       * internals to hand a stranger.
       */
      if (process.env.NODE_ENV !== "production") {
        (window as unknown as { __ajnihaMap?: MapLibreMap }).__ajnihaMap = map;
      }

      map.addControl(new NavigationControl({ showCompass: false }));
      map.addControl(new ScaleControl({ unit: "metric" }));

      /**
       * If the first tiles have not arrived by now, treat the basemap as
       * unreachable and swap to a style with no external sources. A blocked
       * host often produces no `error` event at all — the request simply hangs
       * — so a timeout is the only signal that covers every failure mode.
       */
      tileTimer = setTimeout(() => {
        if (cancelled || map.loaded()) return;
        failToFallbackStyle(map);
      }, TILE_TIMEOUT_MS);

      /**
       * **At most once.** `map.isStyleLoaded()` is false while the *fallback*
       * style is loading too, so an `error` arriving in that window would call
       * this again, `setStyle` again, and so on — an infinite loop that locks
       * the renderer hard enough to freeze the tab. Found exactly that way.
       */
      function failToFallbackStyle(map: MapLibreMap) {
        if (cancelled || fellBack) return;
        fellBack = true;
        setStatus("tiles-failed");
        map.setStyle(FALLBACK_STYLE as StyleSpecification);
        // `setStyle` discards our source and layers; `style.load` re-adds them.
      }

      map.on("style.load", () => {
        if (cancelled) return;
        styleLoaded = true;
        if (tileTimer) clearTimeout(tileTimer);

        /**
         * **Our own work is caught here, not left to `map.on("error")`.**
         *
         * MapLibre routes a validation failure from `addLayer` through the same
         * `error` event a dead tile host uses, so an unparseable zone colour
         * arrived looking exactly like "the basemap is down" — and the handler
         * dutifully swapped to the fallback style, which re-ran this, which
         * failed again. Nine errors and a grey rectangle. Catching here keeps
         * the two kinds of failure apart: this one is ours and is a bug, and it
         * must not be able to tear down a basemap that loaded perfectly well.
         */
        try {
          relabelBasemap(map);
          installZoneLayers(map);
          if (!fitted) {
            fitted = true;
            fitToZones(map);
          }
        } catch (error) {
          console.error("[map] could not install zone layers", error);
        }

        setStatus((current) =>
          current === "tiles-failed" ? current : "ready",
        );
      });

      map.on("error", (event: ErrorEvent) => {
        if (cancelled) return;

        /**
         * **Only a failure to load the style itself falls back.**
         *
         * MapLibre fires `error` liberally — a single tile 404 at one zoom
         * level, a missing sprite icon, a glyph range the font server does not
         * have. Treating any of those as "the basemap is down" would tear a
         * working map down to a grey rectangle over one absent icon, which is a
         * far worse bug than the one the fallback exists to fix.
         *
         * Before the style has loaded there is no map to lose, so an error at
         * that point is the real thing: the style URL was unreachable. After
         * it, the timeout above is the remaining safety net.
         */
        if (styleLoaded) return;
        console.error("[map] basemap style failed to load", event.error);
        failToFallbackStyle(map);
      });

      map.on("moveend", () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          const bounds = map.getBounds();
          viewportRef.current(
            [
              bounds.getWest().toFixed(3),
              bounds.getSouth().toFixed(3),
              bounds.getEast().toFixed(3),
              bounds.getNorth().toFixed(3),
            ].join(","),
          );
        }, VIEWPORT_DEBOUNCE_MS);
      });

      /**
       * **The tap is the whole interaction.** `click` fires for a touch tap as
       * well as a mouse click, and MapLibre suppresses it after a drag — so a
       * pan does not land a marker where the finger came to rest.
       */
      map.on("click", (event: MapMouseEvent) => {
        selectRef.current([event.lngLat.lng, event.lngLat.lat]);
      });

      // A crosshair, because the map is now a thing you ask questions of.
      map.getCanvas().style.cursor = "crosshair";
    });

    return () => {
      cancelled = true;
      if (tileTimer) clearTimeout(tileTimer);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [fitToZones, installZoneLayers, relabelBasemap]);

  /**
   * Push new zones into the source when the explorer replaces them.
   *
   * Separate from the mount effect on purpose: re-running *that* would tear
   * down and rebuild the map — and its camera — every time a viewport fetch
   * came back, which is the opposite of what a pan should do.
   */
  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource(ZONE_SOURCE_ID);
    if (source && "setData" in source) {
      (source as GeoJSONSource).setData(zonesToGeoJson(zones, locale) as never);
    }
  }, [zones, locale]);

  /** Same, for the marker and its halo. */
  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource(PROBE_SOURCE_ID);
    if (source && "setData" in source) {
      (source as GeoJSONSource).setData(
        probeGeoJson(probePoint, probeStatus) as never,
      );
    }
  }, [probePoint, probeStatus]);

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-lg border">
        {/**
         * `dir="ltr"` regardless of locale — see the note above. The
         * `aria-label` carries the map's purpose, because the canvas inside is
         * opaque to a screen reader and the zone list on the same page is the
         * accessible equivalent.
         */}
        <div
          ref={containerRef}
          dir="ltr"
          role="region"
          aria-label={labels.mapLabel}
          className="h-[26rem] w-full sm:h-[32rem]"
        />

        {status === "loading" ? (
          <p
            className="bg-card/80 text-muted-foreground absolute inset-0 flex items-center justify-center text-sm"
            role="status"
          >
            {labels.loading}
          </p>
        ) : null}
      </div>

      {status === "tiles-failed" ? (
        <p role="note" className="text-muted-foreground mt-2 border-s-2 ps-3 text-sm">
          {labels.tileFailure}
        </p>
      ) : null}
    </div>
  );
}
