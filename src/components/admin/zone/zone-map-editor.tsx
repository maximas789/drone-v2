"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { Map as MapLibreMap, NavigationControl, ScaleControl } from "maplibre-gl";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawRectangleMode,
  TerraDrawSelectMode,
} from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { Button } from "@/components/ui/button";
import type { Geometry } from "@/lib/geo";
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  TILE_STYLE_URL,
} from "@/lib/maps/config";
import { resolveZoneColors } from "@/lib/maps/color-resolve";
import { ensureRtlTextPlugin } from "@/lib/maps/rtl-plugin";

/**
 * Drawing airspace — MapLibre with terra-draw on top.
 *
 * **Loaded `ssr: false` and only from admin routes.** A drawing library is
 * ~100 kB that a pilot looking at the map has no use for, and terra-draw
 * reaches for `window` at module scope the same way MapLibre does.
 * `EditorMount` is the boundary; nothing outside `(admin)` imports this file.
 *
 * **`ensureRtlTextPlugin` before the first map, always.** `setRTLTextPlugin`
 * may be called exactly once per document and must run before any instance
 * exists, or Arabic labels come out disconnected and reversed — and calling it
 * twice throws. That helper owns both facts, and it also points MapLibre's
 * worker at `public/vendor/maplibre/`, without which the worker pool answers
 * nothing and the canvas stays blank with a clean console.
 *
 * **One zone is one geometry.** Finishing a second shape replaces the first
 * rather than adding to it: this editor edits *a* zone, and a store holding two
 * polygons would leave "which one is the zone?" to whoever read the snapshot.
 * A MultiPolygon zone is still perfectly storable — the validator accepts one —
 * it just is not something this tool produces by accident.
 *
 * **The map is not mirrored in Arabic and must not be.** East stays east
 * whatever language the labels are in; only the toolbar beside it flips, which
 * it does by being ordinary flex content in an RTL document.
 */

type Mode = "polygon" | "rectangle" | "select";

export function ZoneMapEditor({
  value,
  onChange,
  kind,
  contextGeojson,
}: {
  /** The geometry being edited, or `null` for a zone not drawn yet. */
  value: Geometry | null;
  onChange: (geometry: Geometry | null) => void;
  /** Only to colour the drawing, so a no-fly zone is not drawn in permitted green. */
  kind: "permitted" | "restricted" | "no_fly";
  /** Every other active zone, as GeoJSON, drawn faintly for context. */
  contextGeojson: unknown;
}) {
  const t = useTranslations("zoneAdmin");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  /**
   * The callback in a ref, not in the effect's dependencies. The map is built
   * once; re-running that effect because a parent re-rendered would tear down
   * the canvas mid-draw.
   *
   * **Assigned in an effect, not during render.** Writing `ref.current` in the
   * render body is what `react-hooks/refs` refuses, and rightly: a render may
   * be thrown away, and this one has a side effect the discarded pass would
   * still have performed.
   */
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const valueRef = useRef(value);

  const [mode, setMode] = useState<Mode>("polygon");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    let cancelled = false;

    void ensureRtlTextPlugin().then(() => {
      if (cancelled || !containerRef.current) return;

      const map = new MapLibreMap({
        container: containerRef.current,
        style: TILE_STYLE_URL,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        attributionControl: { compact: true },
      });
      mapRef.current = map;

      /**
       * A handle for driving the editor from the browser console during
       * development — the same one `AirspaceMap` exposes, and **never in
       * production**. This screen is admin-only rather than public, but a
       * global reference to a live map and its draw store is still a piece of
       * the app's internals with no reason to ship.
       */
      if (process.env.NODE_ENV !== "production") {
        (
          window as unknown as { __ajnihaZoneEditor?: unknown }
        ).__ajnihaZoneEditor = { map };
      }

      map.addControl(new NavigationControl({ showCompass: false }));
      map.addControl(new ScaleControl({ unit: "metric" }));

      /**
       * **`load` may already have happened.** With the basemap style in the
       * browser's cache, MapLibre can finish loading between construction and
       * the moment this listener attaches — and then `on("load")` never fires,
       * the draw instance is never created, and the toolbar sits there enabled
       * over a map that ignores every click. It happened on the second visit to
       * this page and not the first, which is exactly what a warm cache looks
       * like. Asking `isStyleLoaded()` first covers both orders.
       */
      const whenStyleReady = (run: () => void) => {
        if (map.isStyleLoaded()) run();
        else map.once("load", run);
      };

      whenStyleReady(() => {
        if (cancelled) return;

        /**
         * The neighbours, faint and underneath. Drawing airspace next to
         * airspace without seeing the airspace is how zones end up overlapping
         * by fifty metres.
         */
        if (contextGeojson) {
          map.addSource("context-zones", {
            type: "geojson",
            data: contextGeojson as never,
          });
          map.addLayer({
            id: "context-zones-fill",
            type: "fill",
            source: "context-zones",
            paint: { "fill-color": "#94a3b8", "fill-opacity": 0.12 },
          });
          map.addLayer({
            id: "context-zones-line",
            type: "line",
            source: "context-zones",
            paint: {
              "line-color": "#64748b",
              "line-width": 1,
              "line-opacity": 0.5,
            },
          });
        }

        /**
         * **Resolved to hex, not `ZONE_FILL` straight.** That map holds
         * `var(--zone-permitted)`, which MapLibre's own layers accept because
         * the app resolves them for those too — terra-draw does not: handed a
         * `var(...)` it silently falls back to its default grey, and the first
         * polygon drawn came out grey on a permitted zone. `resolveZoneColors`
         * reads the tokens off the container, so a `.dark` ancestor is taken
         * into account. Found by drawing one and looking at it.
         */
        const colors = resolveZoneColors(map.getContainer());
        const styling = {
          fillColor: colors[kind] as `#${string}`,
          outlineColor: colors[kind] as `#${string}`,
          fillOpacity: 0.4,
          outlineWidth: 2,
        };

        const draw = new TerraDraw({
          adapter: new TerraDrawMapLibreGLAdapter({ map }),
          modes: [
            /**
             * **Snap to an existing vertex.** When a new zone abuts one already
             * drawn, sharing the coordinate exactly is what lets F12's
             * half-open point-in-polygon rule resolve the seam to one zone
             * rather than to both or neither. A pilot tapping the boundary gets
             * one answer.
             */
            new TerraDrawPolygonMode({
              snapping: { toCoordinate: true },
              styles: {
                fillColor: styling.fillColor,
                outlineColor: styling.outlineColor,
                fillOpacity: styling.fillOpacity,
                outlineWidth: styling.outlineWidth,
              },
            }),
            // Rectangles are for quick bounding areas — a temporary restricted
            // block around an event, drawn in two clicks.
            new TerraDrawRectangleMode({
              styles: {
                fillColor: styling.fillColor,
                outlineColor: styling.outlineColor,
                fillOpacity: styling.fillOpacity,
                outlineWidth: styling.outlineWidth,
              },
            }),
            new TerraDrawSelectMode({
              flags: {
                // Both drawable modes get the same editing powers: drag the
                // shape, drag a vertex, insert one at a midpoint, delete one.
                polygon: {
                  feature: {
                    draggable: true,
                    coordinates: {
                      draggable: true,
                      midpoints: true,
                      deletable: true,
                      snappable: true,
                    },
                  },
                },
                rectangle: {
                  feature: {
                    draggable: true,
                    coordinates: { draggable: true, deletable: false },
                  },
                },
              },
            }),
          ],
        });

        draw.start();
        draw.setMode("polygon");
        drawRef.current = draw;
        if (process.env.NODE_ENV !== "production") {
          (
            window as unknown as { __ajnihaZoneEditor?: unknown }
          ).__ajnihaZoneEditor = { map, draw };
        }

        /**
         * `change` covers everything: finishing a shape, dragging a vertex,
         * deleting one. Reading the snapshot each time is cheap — the store
         * holds one feature by construction — and it means the form's live
         * validation reacts to a dragged vertex, not only to a finished
         * polygon.
         */
        draw.on("change", () => {
          /*
            Only the area features. terra-draw's store types its geometry as
            the union of everything any mode can produce — a select mode's
            midpoint handles are Points — so this filter is what makes the
            snapshot answer the question the form asked.
          */
          const features = draw
            .getSnapshot()
            .filter((feature) => feature.geometry.type === "Polygon");
          if (features.length === 0) {
            onChangeRef.current(null);
            return;
          }
          // One zone, one geometry: the newest wins and the rest go.
          const newest = features[features.length - 1];
          for (const feature of features.slice(0, -1)) {
            if (feature.id !== undefined) draw.removeFeatures([feature.id]);
          }
          onChangeRef.current(newest.geometry as unknown as Geometry);
        });

        // An existing zone opens with its polygon in the editor, selectable.
        const existing = valueRef.current;
        if (existing) {
          /**
           * **Every part of this shape is load-bearing**, and the first version
           * had two of them wrong — the polygon simply did not appear, with no
           * error anywhere. terra-draw validates what it is handed and returns
           * the verdict rather than throwing: a feature needs an `id` its own
           * strategy accepts (a UUID by default, not `undefined`), and a
           * `properties.mode` naming a registered mode, or the store rejects it
           * silently. The verdict is logged in development for that reason.
           */
          const [validation] = draw.addFeatures([
            {
              id: crypto.randomUUID(),
              type: "Feature",
              geometry: existing as never,
              properties: { mode: "polygon" },
            } as never,
          ]);
          if (validation && !validation.valid) {
            console.error("[zone-editor] existing geometry rejected:", validation);
          }
          const [[minLng, minLat], [maxLng, maxLat]] = boundsOf(existing);
          map.fitBounds(
            [
              [minLng, minLat],
              [maxLng, maxLat],
            ],
            { padding: 48, duration: 0 },
          );
        }

        setReady(true);
      });
    });

    return () => {
      cancelled = true;
      drawRef.current?.stop();
      drawRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Built once. `kind` and `contextGeojson` are read at construction; a zone
    // whose kind changes mid-draw keeps the colour it started with until the
    // page is reloaded, which is a great deal better than a remount that throws
    // the polygon away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choose(next: Mode) {
    setMode(next);
    drawRef.current?.setMode(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["polygon", "rectangle", "select"] as const).map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={mode === option ? "default" : "outline"}
            disabled={!ready}
            aria-pressed={mode === option}
            onClick={() => choose(option)}
          >
            {t(`tool.${option}`)}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!ready}
          onClick={() => {
            drawRef.current?.clear();
            onChangeRef.current(null);
          }}
        >
          {t("tool.clear")}
        </Button>
      </div>

      <div
        ref={containerRef}
        /**
         * `dir="ltr"` on the map container, and only here. MapLibre positions
         * its own controls with `left`/`right` and an RTL document flips them
         * onto the wrong side of the canvas; the geography inside is unaffected
         * either way, because SVG and WebGL coordinates ignore `direction`.
         */
        dir="ltr"
        className="h-[24rem] w-full overflow-hidden rounded-lg border sm:h-[32rem]"
      />

      <p className="text-muted-foreground text-xs">{t("tool.hint")}</p>
    </div>
  );
}

/** The drawn shape's extent, for the opening camera. */
function boundsOf(geometry: Geometry): [[number, number], [number, number]] {
  const rings =
    geometry.type === "Polygon"
      ? geometry.coordinates
      : geometry.coordinates.flat();
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
