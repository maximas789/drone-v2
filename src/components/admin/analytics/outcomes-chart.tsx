import { getTranslations } from "next-intl/server";
import {
  ChartCard,
  ChartLegend,
  ChartTable,
} from "@/components/admin/analytics/chart-card";
import { ChartAxes, thinLabels } from "@/components/admin/analytics/chart-axes";
import { ChartHover } from "@/components/admin/analytics/chart-hover";
import { CHART, MAX_BAR_WIDTH, SURFACE_GAP } from "@/lib/analytics/layout";
import { bucketLabel, countLabel } from "@/lib/analytics/labels";
import { STATUS } from "@/lib/analytics/palette";
import type { OutcomeRow, Window } from "@/lib/analytics/queries";
import {
  axisMax,
  bandScale,
  linearScale,
  niceTicks,
} from "@/lib/analytics/scale";
import type { Locale } from "@/lib/locale";

/**
 * Approved against rejected, per bucket.
 *
 * **Grouped, not stacked.** F25 asks the question "is the balance of decisions
 * changing", and a stack answers "how many decisions were there" — the two bars
 * have to sit on a common baseline for a reader to compare them at a glance.
 *
 * **These wear status colours, not categorical slots**, because they are not
 * two arbitrary series: one is a good outcome and one is a bad one, and the
 * `dataviz` collision rule says a series that *means* good or bad takes the
 * reserved status scale. Both clear 3:1 in light and dark, and both always
 * arrive with a written label — the legend and the table — so a reader who
 * cannot separate the hues loses nothing.
 */
export async function OutcomesChart({
  rows,
  window,
  locale,
}: {
  rows: readonly OutcomeRow[];
  window: Window;
  locale: Locale;
}) {
  const t = await getTranslations("analytics");

  const box = CHART;
  const rtl = locale === "ar";
  const peak = rows.reduce(
    (max, row) => Math.max(max, row.value.approved, row.value.rejected),
    0,
  );
  const empty = rows.every(
    (row) => row.value.approved === 0 && row.value.rejected === 0,
  );

  const ticks = niceTicks(peak);
  const y = linearScale(0, axisMax(peak), box.plotHeight, 0);
  const group = bandScale(rows.length, box.plotWidth, 0.3);
  /**
   * Two bars inside each group, separated by the 2 px surface gap, and capped —
   * see `MAX_BAR_WIDTH`. The pair is then re-centred inside its band, because a
   * capped bar left at the band's start would drift away from the axis label
   * underneath it, which is centred.
   */
  const barWidth = Math.min(
    MAX_BAR_WIDTH,
    Math.max(3, (group.width - SURFACE_GAP) / 2),
  );
  const pairWidth = barWidth * 2 + SURFACE_GAP;

  const labels = rows.map((row) =>
    bucketLabel(row.key, window.bucket, locale, t("weekOf")),
  );

  const series = [
    { key: "approved" as const, label: t("approved"), ink: STATUS.good },
    { key: "rejected" as const, label: t("rejected"), ink: STATUS.critical },
  ];

  return (
    <ChartCard
      title={t("outcomesTitle")}
      note={t("outcomesNote")}
      empty={empty}
      emptyMessage={t("outcomesEmpty")}
      legend={
        <ChartLegend
          items={series.map((s) => ({
            label: s.label,
            swatch: s.ink.bg,
            value: countLabel(
              rows.reduce((sum, row) => sum + row.value[s.key], 0),
              locale,
            ),
          }))}
        />
      }
      table={
        <ChartTable
          caption={t("outcomesTitle")}
          head={[t("period"), ...series.map((s) => s.label)]}
          rows={rows.map((row, i) => [
            labels[i] ?? row.key,
            countLabel(row.value.approved, locale),
            countLabel(row.value.rejected, locale),
          ])}
        />
      }
    >
      <div className="relative" style={{ width: box.width }}>
        <svg
          width={box.width}
          height={box.height}
          role="img"
          aria-label={t("outcomesTitle")}
        >
          <ChartAxes
            box={box}
            ticks={ticks}
            y={y}
            tickLabels={ticks.map((tick) => countLabel(tick, locale))}
            categories={thinLabels(rows.length, (i) => labels[i] ?? "")}
            xAt={(i) => group.centre(i)}
            rtl={rtl}
          />

          <g transform={`translate(${box.start} ${box.top})`}>
            {rows.map((row, i) =>
              series.map((s, seriesIndex) => {
                const value = row.value[s.key];
                if (value === 0) return null;
                const height = box.plotHeight - y(value);
                return (
                  <rect
                    key={`${row.key}-${s.key}`}
                    x={
                      group.centre(i) -
                      pairWidth / 2 +
                      seriesIndex * (barWidth + SURFACE_GAP)
                    }
                    y={y(value)}
                    width={barWidth}
                    height={height}
                    /*
                      4 px rounded ends, anchored to the baseline: the radius is
                      on the top corners only, so the bar still reads as
                      standing on zero rather than floating.
                    */
                    rx={Math.min(4, barWidth / 2)}
                    className={s.ink.fill}
                  />
                );
              }),
            )}
          </g>
        </svg>

        <ChartHover
          box={box}
          mode="band"
          labels={labels}
          series={series.map((s) => ({
            label: s.label,
            swatch: s.ink.bg,
            values: rows.map((row) => countLabel(row.value[s.key], locale)),
          }))}
        />
      </div>
    </ChartCard>
  );
}
