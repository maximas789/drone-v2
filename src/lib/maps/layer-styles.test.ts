import { describe, expect, it } from "vitest";
import type { Geometry } from "@/lib/geo";
import { RIYADH_ZONES } from "@/lib/seed/zones-riyadh";
import { ZONE_COLOR_FALLBACK, type ZoneColors } from "./color-resolve";
import { localisedNameExpression } from "./config";
import {
  ZONE_SOURCE_ID,
  fillLayer,
  labelLayer,
  outlineLayer,
  zonesToGeoJson,
  type DrawableZone,
} from "./layer-styles";
import { DRAW_ORDER, ZONE_FILL } from "./zone-palette";

/**
 * The map's drawing rules, tested where they are decidable.
 *
 * The suite runs in a `node` environment with no DOM, so `resolveZoneColors`
 * and `createHatchImage` — both of which need a canvas — are **not** covered
 * here and are checked in the browser instead. Everything below is pure.
 */

const colors: ZoneColors = ZONE_COLOR_FALLBACK;

const zone = (over: Partial<DrawableZone> = {}): DrawableZone => ({
  id: "z1",
  code: "RUH-P-99",
  kind: "permitted",
  nameAr: "منطقة",
  nameEn: "Zone",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [46, 24],
        [47, 24],
        [47, 25],
        [46, 24],
      ],
    ],
  },
  ceilingAglM: 120,
  ...over,
});

describe("zonesToGeoJson", () => {
  it("picks the name column for the locale", () => {
    expect(zonesToGeoJson([zone()], "ar").features[0].properties.name).toBe(
      "منطقة",
    );
    expect(zonesToGeoJson([zone()], "en").features[0].properties.name).toBe(
      "Zone",
    );
  });

  /**
   * **The hole test, and it is the important one in this file.**
   *
   * `RUH-NF-KKIA` is an annulus: an outer ring with an interior ring that must
   * render as a hole, because the airfield core is managed by the airport
   * rather than open to flight. MapLibre gives that for free — a polygon's
   * second ring *is* a hole — so the only way to break it is to mangle the
   * coordinates on the way through, by flattening the rings or dropping all but
   * the first. This asserts the geometry arrives with both rings intact.
   */
  it("preserves the interior ring of the KKIA annulus", () => {
    const kkia = RIYADH_ZONES.find((z) => z.code === "RUH-NF-KKIA");
    expect(kkia, "the seed no longer contains RUH-NF-KKIA").toBeDefined();

    const source = kkia!.geometry as Extract<Geometry, { type: "Polygon" }>;
    expect(source.coordinates.length, "seed lost its interior ring").toBe(2);

    const [feature] = zonesToGeoJson(
      [zone({ geometry: kkia!.geometry, kind: "no_fly" })],
      "en",
    ).features;
    const drawn = feature.geometry as Extract<Geometry, { type: "Polygon" }>;

    expect(drawn.coordinates.length).toBe(2);
    expect(drawn.coordinates[1]).toEqual(source.coordinates[1]);
  });

  it("carries the kind through, because every layer filters on it", () => {
    const collection = zonesToGeoJson(
      [zone({ kind: "no_fly" }), zone({ id: "z2", kind: "restricted" })],
      "en",
    );
    expect(collection.features.map((f) => f.properties.kind)).toEqual([
      "no_fly",
      "restricted",
    ]);
  });
});

describe("layer specifications", () => {
  it("draws back to front, strictest last", () => {
    // If this ever reorders, a permitted carve-out starts painting over a
    // no-fly overlay — which looks identical and is a different claim.
    expect(DRAW_ORDER).toEqual(["restricted", "permitted", "no_fly"]);
  });

  it("filters each layer to its own kind", () => {
    for (const kind of DRAW_ORDER) {
      expect(fillLayer(kind, colors).filter).toEqual([
        "==",
        ["get", "kind"],
        kind,
      ]);
      expect(outlineLayer(kind, colors).filter).toEqual([
        "==",
        ["get", "kind"],
        kind,
      ]);
    }
  });

  it("reads every colour from the resolved palette, never a literal", () => {
    for (const kind of DRAW_ORDER) {
      expect(fillLayer(kind, colors).paint?.["fill-color"]).toBe(colors[kind]);
      expect(outlineLayer(kind, colors).paint?.["line-color"]).toBe(
        colors[kind],
      );
    }
  });

  it("dashes the restricted boundary and only that one", () => {
    // It is an administrative extent, not an edge you could stand on.
    expect(
      outlineLayer("restricted", colors).paint?.["line-dasharray"],
    ).toBeDefined();
    expect(
      outlineLayer("permitted", colors).paint?.["line-dasharray"],
    ).toBeUndefined();
    expect(
      outlineLayer("no_fly", colors).paint?.["line-dasharray"],
    ).toBeUndefined();
  });

  it("every layer binds to the one zone source", () => {
    const layers = [
      ...DRAW_ORDER.map((k) => fillLayer(k, colors)),
      ...DRAW_ORDER.map((k) => outlineLayer(k, colors)),
      labelLayer(colors),
    ];
    for (const layer of layers) {
      expect(layer.source).toBe(ZONE_SOURCE_ID);
    }
    // Duplicate ids silently replace one another in MapLibre.
    const ids = layers.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * OpenFreeMap serves the OpenMapTiles font set. A stack it does not host makes
   * **every label vanish** with no error — which looks like missing data and is
   * not. The live endpoint was checked when this was written; this pins the
   * string so a rename is a test failure rather than an empty map.
   */
  it("asks for a font stack OpenFreeMap actually serves", () => {
    expect(labelLayer(colors).layout?.["text-font"]).toEqual([
      "Noto Sans Regular",
    ]);
  });
});

describe("localisedNameExpression", () => {
  /**
   * The `coalesce` is the whole point. OpenMapTiles does not carry `name:ar`
   * for every feature, and a bare `["get","name:ar"]` renders those as nothing
   * at all — so the map quietly loses labels rather than falling back to the
   * local-script name.
   */
  it("falls back to the untagged name", () => {
    expect(localisedNameExpression("ar")).toEqual([
      "coalesce",
      ["get", "name:ar"],
      ["get", "name"],
    ]);
    expect(localisedNameExpression("en")).toEqual([
      "coalesce",
      ["get", "name:en"],
      ["get", "name"],
    ]);
  });
});

describe("zone palette", () => {
  it("names a CSS variable for every kind, never a literal colour", () => {
    for (const kind of DRAW_ORDER) {
      expect(ZONE_FILL[kind]).toMatch(/^var\(--zone-/);
    }
  });

  /**
   * The fallbacks only ever appear when `oklch()` could not be resolved. They
   * are allowed to be approximate — but not to collapse into each other, since
   * the one thing this screen must do is separate "you may fly" from "you may
   * not".
   */
  it("keeps the fallback colours distinguishable from one another", () => {
    const values = Object.values(ZONE_COLOR_FALLBACK);
    expect(new Set(values).size).toBe(values.length);
  });
});
