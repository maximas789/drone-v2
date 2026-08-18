import { getTranslations } from "next-intl/server";
import { Disclaimer } from "@/components/layout/disclaimer";
import { getSession } from "@/lib/auth-guards";
import { listActiveZones } from "@/lib/data/zone";
import type { BoundingBox, Geometry } from "@/lib/geo";
import { pathFor, projectionFor, unionBounds } from "@/lib/geo/project";
import type { Locale } from "@/lib/locale";

/**
 * The seeded Riyadh airspace, drawn.
 *
 * **Real rows, not an illustration** — `listActiveZones` is the same reader the
 * rest of the app uses, so what the front door shows is what a pilot will
 * actually be judged against. If the seed changes, this changes.
 *
 * **A static SVG rather than MapLibre**, decided before it was built:
 * [F20](../../../.claude/plans/features/F20-airspace-map.md) owns the
 * interactive map, and a second map here would mean two implementations of the
 * same picture — the drift the single-projection rule exists to stop — plus a
 * tile source, a `setRTLTextPlugin` call that must happen exactly once, and a
 * client bundle on the one page that has to load fast. This cannot pan, cannot
 * zoom and answers no airspace question. It shows the shape of the model:
 * a restricted city, permitted carve-outs inside it, no-fly overlays on top.
 *
 * **The drawing is not mirrored in Arabic.** SVG coordinates ignore `direction`
 * — which is correct and worth saying, because everything else on this page
 * flips: east has to stay east on a map of a real city whatever language the
 * labels are in. Only the legend beside it mirrors.
 */

/** Painted back to front, so the strictest rule is the one you see. */
const DRAW_ORDER = ["restricted", "permitted", "no_fly"] as const;

const FILL: Record<(typeof DRAW_ORDER)[number], string> = {
  restricted: "var(--zone-restricted)",
  permitted: "var(--zone-permitted)",
  no_fly: "var(--zone-no-fly)",
};

export async function MapPreview({ locale }: { locale: Locale }) {
  const t = await getTranslations("landing");
  const session = await getSession();
  const zones = await listActiveZones(session);

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
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">{t("mapTitle")}</h2>
        <p className="text-muted-foreground max-w-2xl">{t("mapBody")}</p>
      </div>

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
                  fill={FILL[kind]}
                  fillOpacity={kind === "restricted" ? 0.18 : 0.42}
                  stroke={FILL[kind]}
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
              style={{ backgroundColor: FILL[kind] }}
            />
            <span>{t(`zoneKinds.${kind}`)}</span>
          </li>
        ))}
      </ul>

      <Disclaimer locale={locale} />
    </section>
  );
}
