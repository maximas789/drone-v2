import { getTranslations } from "next-intl/server";
import { ChartCard, ChartTable } from "@/components/admin/analytics/chart-card";
import { ChartAxes, thinLabels } from "@/components/admin/analytics/chart-axes";
import { ChartHover } from "@/components/admin/analytics/chart-hover";
import { CHART, LINE_WIDTH, MARKER_SIZE } from "@/lib/analytics/layout";
import {
  axisPercentLabel,
  bucketLabel,
  countLabel,
  rateLabel,
} from "@/lib/analytics/labels";
import { SOLO } from "@/lib/analytics/palette";
import type { NoShowRow, Window } from "@/lib/analytics/queries";
import { linePath, linearScale, pointScale } from "@/lib/analytics/scale";
import type { Locale } from "@/lib/locale";

/**
 * The share of concluded flights nobody turned up for.
 *
 * **A rate, not a count**, so the y axis is fixed at 0–100 % rather than nicely
 * fitted to the data. A no-show axis that rescaled itself would make two per
 * cent and forty per cent look identical from one page load to the next, and
 * this is a compliance signal that gets compared across visits.
 *
 * **Buckets with no concluded flights are a gap, not a zero.** A week in which
 * nothing was due is not a week in which everybody showed up, and joining
 * straight across it would claim exactly that. The line is therefore drawn in
 * segments, and the table prints the denominator beside every rate so a reader
 * can see that a 100 % bucket is two bookings rather than two hundred.
 *
 * **One series, so `primary` and no legend.**
 */
export async function NoShowLine({
  rows,
  window,
  locale,
}: {
  rows: readonly NoShowRow[];
  window: Window;
  locale: Locale;
}) {
  const t = await getTranslations("analytics");

  const box = CHART;
  const rtl = locale === "ar";
  const totals = rows.map((row) => row.value.noShow + row.value.attended);
  const empty = totals.every((total) => total === 0);

  const ticks = [0, 25, 50, 75, 100];
  const y = linearScale(0, 100, box.plotHeight, 0);
  const x = pointScale(rows.length, box.plotWidth);

  const labels = rows.map((row) =>
    bucketLabel(row.key, window.bucket, locale, t("weekOf")),
  );

  const points = rows.map((row, i) => {
    const total = totals[i] ?? 0;
    return total === 0
      ? null
      : { x: x.at(i), y: y((row.value.noShow / total) * 100) };
  });

  /**
   * Consecutive runs of buckets that actually have a denominator. Each run is
   * its own `<path>`, so the line stops at the edge of a gap rather than
   * bridging it.
   */
  const segments: { x: number; y: number }[][] = [];
  let run: { x: number; y: number }[] = [];
  for (const point of points) {
    if (point === null) {
      if (run.length > 0) segments.push(run);
      run = [];
    } else {
      run.push(point);
    }
  }
  if (run.length > 0) segments.push(run);

  return (
    <ChartCard
      title={t("noShowTitle")}
      note={t("noShowNote")}
      empty={empty}
      emptyMessage={t("noShowEmpty")}
      table={
        <ChartTable
          caption={t("noShowTitle")}
          head={[t("period"), t("noShows"), t("concluded"), t("rate")]}
          rows={rows.map((row, i) => {
            const total = totals[i] ?? 0;
            return [
              labels[i] ?? row.key,
              countLabel(row.value.noShow, locale),
              countLabel(total, locale),
              total === 0 ? "—" : rateLabel(row.value.noShow / total, locale),
            ];
          })}
        />
      }
    >
      <div className="relative" style={{ width: box.width }}>
        <svg
          width={box.width}
          height={box.height}
          role="img"
          aria-label={t("noShowTitle")}
        >
          <ChartAxes
            box={box}
            ticks={ticks}
            y={y}
            tickLabels={ticks.map((tick) => axisPercentLabel(tick, locale))}
            categories={thinLabels(rows.length, (i) => labels[i] ?? "")}
            xAt={(i) => x.at(i)}
            rtl={rtl}
          />

          <g transform={`translate(${box.start} ${box.top})`}>
            {segments.map((segment, i) => (
              <path
                key={i}
                d={linePath(segment)}
                fill="none"
                strokeWidth={LINE_WIDTH}
                strokeLinejoin="round"
                strokeLinecap="round"
                className={SOLO.stroke}
              />
            ))}
            {/*
              A marker on every bucket that has a denominator. It is the hit
              target's visible anchor and — on a run of exactly one bucket,
              which is the common case on a young platform — it is the only
              thing that renders at all, since a one-point path draws nothing.
            */}
            {points.map((point, i) =>
              point === null ? null : (
                <circle
                  key={i}
                  cx={point.x}
                  cy={point.y}
                  r={MARKER_SIZE / 2}
                  className={`${SOLO.fill} stroke-card`}
                  strokeWidth={2}
                />
              ),
            )}
          </g>
        </svg>

        <ChartHover
          box={box}
          mode="point"
          labels={labels}
          series={[
            {
              label: t("rate"),
              swatch: SOLO.bg,
              values: rows.map((row, i) => {
                const total = totals[i] ?? 0;
                return total === 0
                  ? t("noneConcluded")
                  : `${rateLabel(row.value.noShow / total, locale)} (${countLabel(row.value.noShow, locale)}/${countLabel(total, locale)})`;
              }),
            },
          ]}
        />
      </div>
    </ChartCard>
  );
}
