import { useTranslations } from "next-intl";
import type { listActiveZones } from "@/lib/data/zone";
import type { BoundingBox, Geometry } from "@/lib/geo";
import { pathFor, projectionFor, unionBounds } from "@/lib/geo/project";
import type { Locale } from "@/lib/locale";
import { DRAW_ORDER, ZONE_FILL } from "@/lib/maps/zone-palette";

type ZoneRow = Awaited<ReturnType<typeof listActiveZones>>[number];

/**
 * **Where** the flight is, drawn — the booked zone picked out of its
 * neighbours.
 *
 * Not `ZoneDrawing`, and not MapLibre. `ZoneDrawing` draws every zone with
 * equal weight and captions a three-kind legend beneath, which is right on the
 * landing page and wrong here: the reviewer's question is *which one of these
 * is the flight in*, and a legend claiming three kinds under a picture of one
 * would be a caption for a different image. MapLibre is F20's interactive map
 * and answers a point query — this booking has no point to ask about.
 *
 * The projection, the path builder and the palette are all shared, so this
 * cannot drift from the other two surfaces on what a restricted zone looks
 * like. Only the emphasis differs: the booked zone is drawn at full strength
 * over its neighbours, which are faint context.
 *
 * **The drawing is not mirrored in Arabic.** SVG coordinates ignore
 * `direction`, which is correct — east stays east whatever language the labels
 * are in.
 *
 * **No launch point** (open thread 37). A booking is made against a zone, not a
 * coordinate; `booking` has no lat/lng column, so there is no pin that would be
 * anything other than invented. The page says so rather than dropping a marker
 * in the middle of the polygon, which a reviewer would read as where the pilot
 * intends to take off.
 */
export function BookingZoneMap({
  zone,
  context,
  locale,
}: {
  zone: ZoneRow;
  /** The other active zones, drawn faintly so the booked one has a place. */
  context: readonly ZoneRow[];
  locale: Locale;
}) {
  const t = useTranslations("review");

  const boxOf = (row: ZoneRow): BoundingBox => ({
    minLat: row.minLat,
    maxLat: row.maxLat,
    minLng: row.minLng,
    maxLng: row.maxLng,
  });

  const bounds = unionBounds([zone, ...context].map(boxOf));
  if (!bounds) return null;

  const projection = projectionFor(bounds);
  const others = context.filter((row) => row.id !== zone.id);

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-card overflow-hidden rounded-lg border">
        <svg
          viewBox={`0 0 ${projection.width} ${projection.height}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-auto max-h-[22rem] w-full"
          role="img"
          aria-label={locale === "ar" ? zone.nameAr : zone.nameEn}
        >
          {/*
            Neighbours first and faint, in the same draw order the other
            surfaces use, so a no-fly overlay still sits on top of what it
            overlays.
          */}
          {DRAW_ORDER.map((kind) =>
            others
              .filter((row) => row.kind === kind)
              .map((row) => (
                <path
                  key={row.id}
                  d={pathFor(row.geometry as Geometry, projection)}
                  fillRule="evenodd"
                  fill={ZONE_FILL[kind]}
                  fillOpacity={0.08}
                  stroke={ZONE_FILL[kind]}
                  strokeWidth={1}
                  strokeOpacity={0.3}
                />
              )),
          )}

          <path
            d={pathFor(zone.geometry as Geometry, projection)}
            fillRule="evenodd"
            fill={ZONE_FILL[zone.kind]}
            fillOpacity={0.5}
            stroke={ZONE_FILL[zone.kind]}
            strokeWidth={2.5}
            strokeOpacity={1}
          />
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          aria-hidden
          className="size-3 rounded-sm"
          style={{ backgroundColor: ZONE_FILL[zone.kind] }}
        />
        <span className="font-medium">
          {locale === "ar" ? zone.nameAr : zone.nameEn}
        </span>
        <span dir="ltr" className="text-muted-foreground font-mono text-xs">
          {zone.code}
        </span>
      </div>

      <p className="text-muted-foreground text-xs">{t("mapNoPoint")}</p>
    </div>
  );
}
