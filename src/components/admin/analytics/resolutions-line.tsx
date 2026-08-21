import { getTranslations } from "next-intl/server";
import {
  ChartCard,
  ChartLegend,
  ChartTable,
} from "@/components/admin/analytics/chart-card";
import { ChartAxes, thinLabels } from "@/components/admin/analytics/chart-axes";
import { ChartHover } from "@/components/admin/analytics/chart-hover";
import { CHART, LINE_WIDTH, MARKER_SIZE } from "@/lib/analytics/layout";
import { bucketLabel, countLabel } from "@/lib/analytics/labels";
import { RESOLVERS, RESOLVER_SLOT } from "@/lib/analytics/palette";
import type { ResolutionRow, Window } from "@/lib/analytics/queries";
import {
  axisMax,
  linePath,
  linearScale,
  niceTicks,
  pointScale,
} from "@/lib/analytics/scale";
import type { Locale } from "@/lib/locale";

/**
 * Remote ID resolutions, split by who did the resolving.
 *
 * **This is the chart that says the enforcement half of the proposition is
 * being used.** A Remote ID that nobody ever scans is a sticker; the staff line
 * is the evidence that an officer standing beside an aircraft actually reaches
 * for it — which is the claim `/admin/lookup` exists to make good on.
 *
 * See `palette.ts` for why the split is public-against-staff rather than F25's
 * literal "anonymous / reviewer": all five values of
 * `remote_id_scan.viewer_level` land in exactly one of the two series, so the
 * chart's total is the table's total.
 *
 * **Two series, so a legend is present** — identity is never carried by colour
 * alone — and it carries each series' total for the window, which is where the
 * direct labels ended up. See `ChartLegend` for why they are not at the ends of
 * the lines: two series finishing on the same value print on top of each other,
 * and that is the ordinary case here rather than the exotic one.
 */
export async function ResolutionsLine({
  rows,
  window,
  locale,
}: {
  rows: readonly ResolutionRow[];
  window: Window;
  locale: Locale;
}) {
  const t = await getTranslations("analytics");

  const box = CHART;
  const rtl = locale === "ar";
  const peak = rows.reduce(
    (max, row) => Math.max(max, ...RESOLVERS.map((side) => row.value[side])),
    0,
  );
  const empty = peak === 0;

  const ticks = niceTicks(peak);
  const y = linearScale(0, axisMax(peak), box.plotHeight, 0);
  const x = pointScale(rows.length, box.plotWidth);

  const labels = rows.map((row) =>
    bucketLabel(row.key, window.bucket, locale, t("weekOf")),
  );

  const series = RESOLVERS.map((side) => ({
    side,
    label: t(`resolver.${side}`),
    ink: RESOLVER_SLOT[side],
    points: rows.map((row, i) => ({ x: x.at(i), y: y(row.value[side]) })),
    total: rows.reduce((sum, row) => sum + row.value[side], 0),
  }));

  return (
    <ChartCard
      title={t("resolutionsTitle")}
      note={t("resolutionsNote")}
      empty={empty}
      emptyMessage={t("resolutionsEmpty")}
      legend={
        <ChartLegend
          items={series.map((s) => ({
            label: s.label,
            swatch: s.ink.bg,
            value: countLabel(s.total, locale),
          }))}
        />
      }
      table={
        <ChartTable
          caption={t("resolutionsTitle")}
          head={[t("period"), ...series.map((s) => s.label)]}
          rows={rows.map((row, i) => [
            labels[i] ?? row.key,
            ...RESOLVERS.map((side) => countLabel(row.value[side], locale)),
          ])}
        />
      }
    >
      <div className="relative" style={{ width: box.width }}>
        <svg
          width={box.width}
          height={box.height}
          role="img"
          aria-label={t("resolutionsTitle")}
        >
          <ChartAxes
            box={box}
            ticks={ticks}
            y={y}
            tickLabels={ticks.map((tick) => countLabel(tick, locale))}
            categories={thinLabels(rows.length, (i) => labels[i] ?? "")}
            xAt={(i) => x.at(i)}
            rtl={rtl}
          />

          <g transform={`translate(${box.start} ${box.top})`}>
            {series.map((s) => (
              <path
                key={s.side}
                d={linePath(s.points)}
                fill="none"
                strokeWidth={LINE_WIDTH}
                strokeLinejoin="round"
                strokeLinecap="round"
                className={s.ink.stroke}
              />
            ))}
            {/*
              A marker on the last point of each series only. On a 30-day axis a
              marker per point is the "a number on every point" anti-pattern's
              quieter cousin; on a one-bucket range it is the only thing that
              renders, because a single-vertex path draws nothing.
            */}
            {series.map((s) => {
              const point = s.points[s.points.length - 1];
              if (!point) return null;
              return (
                <circle
                  key={s.side}
                  cx={point.x}
                  cy={point.y}
                  r={MARKER_SIZE / 2}
                  className={`${s.ink.fill} stroke-card`}
                  strokeWidth={2}
                />
              );
            })}
          </g>

        </svg>

        <ChartHover
          box={box}
          mode="point"
          labels={labels}
          series={series.map((s) => ({
            label: s.label,
            swatch: s.ink.bg,
            values: rows.map((row) => countLabel(row.value[s.side], locale)),
          }))}
        />
      </div>
    </ChartCard>
  );
}
