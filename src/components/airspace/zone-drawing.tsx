import { getTranslations } from "next-intl/server";
import type { listActiveZones } from "@/lib/data/zone";
import type { BoundingBox, Geometry } from "@/lib/geo";
import { pathFor, projectionFor, unionBounds } from "@/lib/geo/project";

/**
 * The seeded airspace, drawn — **one implementation, two pages.**
 *
 * Lifted out of `landing/map-preview.tsx` when `/zones` needed the same
 * picture. Two components drawing the same polygons with their own fill rules
 * is the drift the single-projection rule exists to stop: the day one of them
 * gets `fill-rule="evenodd"` and the other doesn't, KKIA's ring stops being a
 * hole on exactly one page and nobody notices, because nobody opens both.
 *
 * **A static SVG, not MapLibre.** [F20](../../../.claude/plans/features/F20-airspace-map.md)
 * owns the interactive map. This cannot pan, cannot zoom and answers no
 * airspace question — it shows the *shape* of the model: a restricted city,
 * permitted carve-outs inside it, no-fly overlays on top. F20 replaces the
 * picture, not the data.
 *
 * **The drawing is not mirrored in Arabic.** SVG coordinates ignore
 * `direction`, which is correct and worth saying out loud, because everything
 * around it flips: east stays east on a map of a real city whatever language
 * the labels are in. Only the legend beside it mirrors.
 */

export type ZoneRow = Awaited<ReturnType<typeof listActiveZones>>[number];

/** Painted back to front, so the strictest rule is the one you see. */
const DRAW_ORDER = ["restricted", "permitted", "no_fly"] as const;

export const ZONE_FILL: Record<(typeof DRAW_ORDER)[number], string> = {
  restricted: "var(--zone-restricted)",
  permitted: "var(--zone-permitted)",
  no_fly: "var(--zone-no-fly)",
};

export async function ZoneDrawing({ zones }: { zones: readonly ZoneRow[] }) {
  const t = await getTranslations("landing");

  const bounds = unionBounds(
    zones.map(
      (zone): BoundingBox => ({
        minLat: zone.minLat,
        maxLat: zone.maxLat,
        minLng: zone.minLng,
        maxLng: zone.maxLng,
      }),
    ),
  );

  // No seed, no picture — and no empty frame pretending to be one.
  if (!bounds || zones.length === 0) return null;

  const projection = projectionFor(bounds);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card overflow-hidden rounded-lg border">
        <svg
          viewBox={`0 0 ${projection.width} ${projection.height}`}
          /**
           * **Capped, and letterboxed rather than stretched.** The viewBox
           * aspect comes from the real extent of the seeded zones, and Riyadh's
           * is tall — left to `h-auto` alone the drawing rendered about 1,500 px
           * high and swallowed the page it was supposed to preview. Found by
           * scrolling to it. `meet` fits the whole extent inside the box and
           * centres it, so nothing is cropped and no geography is distorted,
           * which is the one thing a map may never do to earn a smaller box.
           */
          preserveAspectRatio="xMidYMid meet"
          className="h-auto max-h-[26rem] w-full"
          role="img"
          aria-label={t("mapAlt")}
        >
          {DRAW_ORDER.map((kind) =>
            zones
              .filter((zone) => zone.kind === kind)
              .map((zone) => (
                <path
                  key={zone.id}
                  d={pathFor(zone.geometry as Geometry, projection)}
                  /**
                   * `evenodd`, so a ring inside another ring is a hole. A
                   * permitted carve-out painted *over* a restricted zone would
                   * look identical here and be a different claim.
                   */
                  fillRule="evenodd"
                  fill={ZONE_FILL[kind]}
                  fillOpacity={kind === "restricted" ? 0.18 : 0.42}
                  stroke={ZONE_FILL[kind]}
                  strokeWidth={1.5}
                  strokeOpacity={0.9}
                />
              )),
          )}
        </svg>
      </div>

      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {DRAW_ORDER.map((kind) => (
          <li key={kind} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="size-3 rounded-sm"
              style={{ backgroundColor: ZONE_FILL[kind] }}
            />
            <span>{t(`zoneKinds.${kind}`)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
