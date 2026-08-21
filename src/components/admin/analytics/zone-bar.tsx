import { getTranslations } from "next-intl/server";
import { ChartCard, ChartTable } from "@/components/admin/analytics/chart-card";
import { AXIS_FONT_SIZE, zoneBarBox } from "@/lib/analytics/layout";
import { countLabel } from "@/lib/analytics/labels";
import { SOLO } from "@/lib/analytics/palette";
import type { ZoneBarRow } from "@/lib/analytics/queries";
import { axisMax, bandScale, linearScale } from "@/lib/analytics/scale";
import { pickColumns } from "@/lib/i18n-content";
import type { Locale } from "@/lib/locale";

/**
 * Where people book — horizontal bars, because the category labels are Arabic
 * zone names and some of them are long.
 *
 * `نطاق مطار الملك خالد الدولي` is 27 characters. On a vertical bar chart it
 * would be rotated, truncated, or set at a size nobody reads; given a whole row
 * to itself it simply fits. That is the entire reason F25 specifies this form,
 * and it is worth restating because "make it vertical like the others" looks
 * like tidying up.
 *
 * **This is the one chart on the page whose plot IS mirrored in Arabic, and the
 * exception proves the rule.** Everywhere else the x axis is time, and time
 * does not reverse for a language — reversing it would misinform rather than
 * accommodate. Here the x axis is a *count* and the y axis is a list of names:
 * bars that grow away from the names they belong to are simply back to front,
 * in any language. The distinction the page states is between a *time* axis,
 * which is fixed, and reading order, which is not.
 *
 * The mirroring is arithmetic — every x is reflected about the box's centre —
 * rather than a CSS transform, because a `scaleX(-1)` on the group would
 * reverse the glyphs inside it too and then need un-reversing, and that is two
 * transforms to keep in step instead of one number.
 *
 * **One series, so `primary` and no legend.** Colouring the bars by their own
 * value would spend the identity channel re-encoding what bar length already
 * shows.
 */
export async function ZoneBar({
  rows,
  locale,
}: {
  rows: readonly ZoneBarRow[];
  locale: Locale;
}) {
  const t = await getTranslations("analytics");

  const box = zoneBarBox(rows.length);
  const peak = rows.reduce((max, row) => Math.max(max, row.n), 0);
  const empty = rows.length === 0 || peak === 0;
  const rtl = locale === "ar";

  const length = linearScale(0, axisMax(peak), 0, box.plotWidth);
  const band = bandScale(Math.max(rows.length, 1), box.plotHeight, 0.35);

  /** Reflects an x coordinate about the drawing's centre under RTL. */
  const mirror = (x: number) => (rtl ? box.width - x : x);

  return (
    <ChartCard
      title={t("zonesTitle")}
      note={t("zonesNote")}
      empty={empty}
      emptyMessage={t("zonesEmpty")}
      table={
        <ChartTable
          caption={t("zonesTitle")}
          head={[t("zone"), t("bookings")]}
          rows={rows.map((row) => [
            pickColumns(row, "name", locale),
            countLabel(row.n, locale),
          ])}
        />
      }
    >
      <svg
        width={box.width}
        height={box.height}
        role="img"
        aria-label={t("zonesTitle")}
      >
        {rows.map((row, i) => {
          const width = Math.max(2, length(row.n));
          const barStart = mirror(box.start + (rtl ? width : 0));
          const barEnd = mirror(box.start + width);
          const y = box.top + band.centre(i);

          return (
            <g key={row.zoneId}>
              <rect
                x={barStart}
                y={box.top + band.at(i)}
                width={width}
                height={band.width}
                rx={4}
                className={SOLO.fill}
              />
              <text
                x={mirror(box.start - 8)}
                y={y}
                /*
                  **`end` in both directions, and that is not a bug.** The name
                  wants its edge against the plot. Under LTR that is its right
                  edge, which is `end`; under RTL the coordinates are mirrored
                  so it wants its *left* edge — and `end` on an RTL page anchors
                  the left edge. The geometry and the anchor semantics mirror
                  together, so the constant survives. Written as `rtl ? "start"
                  : "end"` first, which flipped it twice and printed every zone
                  name on top of its own bar.
                */
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={AXIS_FONT_SIZE}
                className="fill-foreground"
              >
                {pickColumns(row, "name", locale)}
              </text>
              {/*
                The value at the end of its own bar — the direct label that
                makes this chart readable with no hover layer at all. A
                horizontal bar chart is the one plotted form where every value
                can be labelled without collision, so every value is labelled,
                and there is deliberately no tooltip here.
              */}
              <text
                x={barEnd + (rtl ? -6 : 6)}
                y={y}
                /* `start` in both directions, for the mirror-image reason. */
                textAnchor="start"
                dominantBaseline="middle"
                fontSize={AXIS_FONT_SIZE}
                className="fill-muted-foreground"
              >
                {countLabel(row.n, locale)}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartCard>
  );
}
