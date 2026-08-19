import type {
  CircleLayerSpecification,
  FillLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl";
import type { DecisionStatus, ZoneKindValue } from "@/lib/airspace/types";
import type { Geometry, Position } from "@/lib/geo";
import type { Locale } from "@/lib/locale";
import type { ZoneColors } from "./color-resolve";
import { DRAW_ORDER } from "./zone-palette";

/**
 * How the airspace is drawn. Kept out of the component so the shape of the
 * picture is one readable file rather than three hundred lines of imperative
 * `addLayer` calls.
 */

export const ZONE_SOURCE_ID = "ajniha-zones";
export const HATCH_IMAGE_ID = "ajniha-no-fly-hatch";

/**
 * Re-exported so map code has one import for its drawing vocabulary. The array
 * itself is shared with the SVG renderer — see `zone-palette.ts`. MapLibre
 * draws in the order layers are added, so this *is* the z-order.
 */
export { DRAW_ORDER };

/**
 * The minimum a zone needs to be *drawn*.
 *
 * `geometry` is passed through **unflattened**, which is the one thing this
 * type has to get right: a polygon's second and subsequent rings are holes, and
 * MapLibre honours that natively. That is what makes `RUH-NF-KKIA`'s annulus
 * render as a ring rather than a disc. Nothing here has to ask for the
 * behaviour — it only has to avoid destroying it on the way through.
 *
 * Structural rather than tied to `ZoneRule`, because the two callers hand over
 * different shapes and both are legitimate: the page passes the rows it already
 * read for the zone list (which also carry `district` and `notes`), while the
 * viewport fetch returns full `ZoneRule`s from `/api/zones/geojson`. Both
 * satisfy this, so there is one drawing path and no conversion step that could
 * disagree with itself.
 */
export type DrawableZone = {
  id: string;
  code: string;
  kind: ZoneKindValue;
  nameAr: string;
  nameEn: string;
  geometry: Geometry;
  ceilingAglM: number | null;
};

export type ZoneFeatureProperties = {
  id: string;
  code: string;
  kind: ZoneKindValue;
  name: string;
  ceilingAglM: number | null;
};

export type ZoneFeatureCollection = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    id: string;
    properties: ZoneFeatureProperties;
    geometry: Geometry;
  }[];
};

/**
 * `ZoneRule[]` → GeoJSON, with the label already localised.
 *
 * The name is resolved **here**, not in a MapLibre expression, because the
 * paired `nameAr`/`nameEn` columns are our own schema rather than a tile
 * property — an expression would have to know which column the current locale
 * maps to, and that knowledge belongs with the rest of the bilingual rendering.
 */
export function zonesToGeoJson(
  zones: readonly DrawableZone[],
  locale: Locale,
): ZoneFeatureCollection {
  return {
    type: "FeatureCollection",
    features: zones.map((zone) => ({
      type: "Feature",
      id: zone.id,
      properties: {
        id: zone.id,
        code: zone.code,
        kind: zone.kind,
        name: locale === "ar" ? zone.nameAr : zone.nameEn,
        ceilingAglM: zone.ceilingAglM,
      },
      geometry: zone.geometry,
    })),
  };
}

/**
 * A diagonal hatch, drawn at runtime and registered with `map.addImage`.
 *
 * **This is accessibility, not decoration.** The three zone kinds are green,
 * amber and red — and red/green is the most common colour-vision deficiency
 * there is. A reader who cannot separate the permitted fill from the no-fly
 * fill by hue can still separate them by texture, and "may I fly here" is not a
 * question to answer with colour alone. The outline weights differ for the same
 * reason.
 *
 * Returns `null` when there is no 2D context to draw on; the caller then skips
 * `fill-pattern` and keeps the flat fill, which is degraded but not broken.
 */
export function createHatchImage(
  color: string,
  size = 8,
): ImageData | null {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.clearRect(0, 0, size, size);
  context.strokeStyle = color;
  context.lineWidth = 1.5;
  context.beginPath();
  // Two strokes, offset by the tile size, so the diagonal is continuous across
  // repeats rather than breaking at every tile edge.
  context.moveTo(-size, size);
  context.lineTo(size, -size);
  context.moveTo(0, size * 2);
  context.lineTo(size * 2, 0);
  context.stroke();

  return context.getImageData(0, 0, size, size);
}

/** The fill layer for one zone kind. Opacity carries the severity. */
const FILL_OPACITY: Record<ZoneKindValue, number> = {
  // Low: it is the ground the whole city sits on, and at full strength it
  // would drown the carve-outs that are the point of looking.
  restricted: 0.16,
  permitted: 0.38,
  // Highest, and hatched on top.
  no_fly: 0.42,
};

export function fillLayer(
  kind: ZoneKindValue,
  colors: ZoneColors,
): FillLayerSpecification {
  return {
    id: `${ZONE_SOURCE_ID}-fill-${kind}`,
    type: "fill",
    source: ZONE_SOURCE_ID,
    filter: ["==", ["get", "kind"], kind],
    paint: {
      "fill-color": colors[kind],
      "fill-opacity": FILL_OPACITY[kind],
    },
  };
}

/** The hatch sits in its own layer above the no-fly fill. */
export function hatchLayer(): FillLayerSpecification {
  return {
    id: `${ZONE_SOURCE_ID}-hatch`,
    type: "fill",
    source: ZONE_SOURCE_ID,
    filter: ["==", ["get", "kind"], "no_fly"],
    paint: {
      "fill-pattern": HATCH_IMAGE_ID,
      "fill-opacity": 0.9,
    },
  };
}

/**
 * Outlines. The restricted boundary is **dashed** — it is an administrative
 * extent rather than a hard edge you could stand on, and drawing it solid makes
 * it read as another prohibition rather than as the default-deny background.
 */
export function outlineLayer(
  kind: ZoneKindValue,
  colors: ZoneColors,
): LineLayerSpecification {
  return {
    id: `${ZONE_SOURCE_ID}-outline-${kind}`,
    type: "line",
    source: ZONE_SOURCE_ID,
    filter: ["==", ["get", "kind"], kind],
    paint: {
      "line-color": colors[kind],
      "line-width": kind === "restricted" ? 1.5 : 2,
      "line-opacity": 0.95,
      ...(kind === "restricted" ? { "line-dasharray": [3, 2] } : {}),
    },
  };
}

/**
 * Zone names.
 *
 * **`text-font` must name a stack the glyph server actually has.** OpenFreeMap
 * serves the OpenMapTiles set; asking for a font it does not host makes every
 * label silently disappear, which looks like a data problem and is not one.
 *
 * `symbol-placement: "point"` with `text-allow-overlap: false` lets MapLibre
 * drop labels rather than stack them illegibly when zones are close — the
 * permitted carve-outs in south Riyadh sit within a few kilometres of each
 * other.
 */
export function labelLayer(colors: ZoneColors): SymbolLayerSpecification {
  return {
    id: `${ZONE_SOURCE_ID}-label`,
    type: "symbol",
    source: ZONE_SOURCE_ID,
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 12,
      "text-allow-overlap": false,
      "text-padding": 4,
      "text-max-width": 8,
    },
    paint: {
      /**
       * The label takes its zone's colour, so a name read on its own still
       * carries the verdict. A single ink for all three would make "King Khalid
       * CTR" and "Thumamah" look like the same kind of place.
       */
      "text-color": [
        "match",
        ["get", "kind"],
        "permitted",
        colors.permitted,
        "no_fly",
        colors.no_fly,
        "restricted",
        colors.restricted,
        colors.permitted,
      ],
      /**
       * A white halo in both themes, and deliberately not a theme token: these
       * sit on the *basemap*, whose colour is not ours to choose and changes
       * with the zoom level. A dark halo on a dark page would vanish over the
       * light tiles underneath it.
       */
      "text-halo-color": "rgba(255,255,255,0.9)",
      "text-halo-width": 1.6,
    },
  };
}

// --- The probe: the tapped point and its verdict ---------------------------

export const PROBE_SOURCE_ID = "ajniha-probe";

/**
 * The verdict, as a feature property.
 *
 * Carried on the feature rather than swapped with `setPaintProperty` because a
 * `match` expression re-evaluates on the next frame with no repaint dance, and
 * because it keeps the marker's appearance a function of the data — the same
 * property that decides the panel's colour decides the halo's.
 */
export type ProbeFeatureProperties = { status: DecisionStatus };

export type ProbeFeatureCollection = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: ProbeFeatureProperties;
    geometry: { type: "Point"; coordinates: Position };
  }[];
};

/**
 * The tapped point, or nothing at all.
 *
 * An empty collection rather than a hidden layer: `setData` with no features
 * is one code path for "no probe yet", "the reader cleared it" and "the map
 * just mounted", and none of them can leave a stale marker behind.
 */
export function probeGeoJson(
  point: Position | null,
  status: DecisionStatus,
): ProbeFeatureCollection {
  return {
    type: "FeatureCollection",
    features: point
      ? [
          {
            type: "Feature",
            properties: { status },
            geometry: { type: "Point", coordinates: point },
          },
        ]
      : [],
  };
}

/**
 * `allowed | needs_review | denied` → the zone palette.
 *
 * **Deliberately the same three tokens the polygons use**, not a fourth set of
 * status colours. Green already means "you may fly here" everywhere else in
 * this app; a halo in a different green would be asking the reader to learn the
 * scheme twice. `needs_review` takes the restricted amber, which is the same
 * claim in a different place: permission exists but is not automatic.
 */
function statusColorExpression(colors: ZoneColors): unknown[] {
  return [
    "match",
    ["get", "status"],
    "allowed",
    colors.permitted,
    "needs_review",
    colors.restricted,
    "denied",
    colors.no_fly,
    colors.no_fly,
  ];
}

/**
 * The halo — a wide, soft disc under the marker.
 *
 * Radius is zoom-interpolated so it stays a *halo* rather than becoming a zone
 * of its own when you zoom in. It carries no meaning about size: it is not a
 * radius of effect, and drawing it in ground units would imply one.
 */
export function probeHaloLayer(colors: ZoneColors): CircleLayerSpecification {
  return {
    id: `${PROBE_SOURCE_ID}-halo`,
    type: "circle",
    source: PROBE_SOURCE_ID,
    paint: {
      "circle-color": statusColorExpression(colors) as never,
      "circle-opacity": 0.25,
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        6,
        12,
        16,
        28,
      ],
      "circle-stroke-color": statusColorExpression(colors) as never,
      "circle-stroke-width": 2,
      "circle-stroke-opacity": 0.9,
    },
  };
}

/**
 * The marker itself: a small opaque dot with a white ring.
 *
 * White, not a token, for `labelLayer`'s reason — it sits on the basemap, whose
 * colour is not ours and changes with zoom. A dot that vanished over a pale
 * tile would lose the one thing the reader needs to see: **where** they asked.
 */
export function probeMarkerLayer(colors: ZoneColors): CircleLayerSpecification {
  return {
    id: `${PROBE_SOURCE_ID}-marker`,
    type: "circle",
    source: PROBE_SOURCE_ID,
    paint: {
      "circle-color": statusColorExpression(colors) as never,
      "circle-radius": 5,
      "circle-stroke-color": "rgba(255,255,255,0.95)",
      "circle-stroke-width": 2,
    },
  };
}
