import { getTranslations } from "next-intl/server";
import {
  ChartCard,
  ChartTable,
} from "@/components/admin/analytics/chart-card";
import { ChartAxes } from "@/components/admin/analytics/chart-axes";
import { ChartHover } from "@/components/admin/analytics/chart-hover";
import {
  CHART,
  LABEL_FONT_SIZE,
  MAX_BAR_WIDTH,
} from "@/lib/analytics/layout";
import { countLabel } from "@/lib/analytics/labels";
import { SOLO } from "@/lib/analytics/palette";
import type { HistogramBucket } from "@/lib/analytics/queries";
import {
  axisMax,
  bandScale,
  linearScale,
  niceTicks,
} from "@/lib/analytics/scale";
import { formatDays, formatHours } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * How long review actually takes — the distribution, not the average.
 *
 * **A median hides the tail, and the tail is what a regulator answers for.** A
 * platform where half of everything is decided in four hours and one aircraft
 * waited six months is not the same platform as one where everything lands
 * inside a day, and the two report the same median. This chart is the tile's
 * conscience, which is why F25 asks for both and why they sit next to each
 * other.
 *
 * **One series, so it wears `primary` rather than a categorical slot** and has
 * no legend: the heading already says what is being counted, and a one-row
 * legend would only repeat it. See `palette.ts`, rule 4.
 *
 * The buckets are unequal in width — 0–4h, 4–24h, 1–3d, 3–7d, 7–30d, 30d+ — and
 * drawn as equal bands. That is a deliberate departure from a true histogram: a
 * proportional x axis would give the last bucket ninety per cent of the plot to
 * hold, usually, one bar. Each band prints its own range, so nobody has to
 * infer the widths from the geometry.
 */
export async function TurnaroundHistogram({
  buckets,
  locale,
}: {
  buckets: readonly HistogramBucket[];
  locale: Locale;
}) {
  const t = await getTranslations("analytics");

  const box = CHART;
  const rtl = locale === "ar";
  const peak = buckets.reduce((max, bucket) => Math.max(max, bucket.n), 0);
  const empty = peak === 0;

  const ticks = niceTicks(peak);
  const y = linearScale(0, axisMax(peak), box.plotHeight, 0);
  const band = bandScale(buckets.length, box.plotWidth, 0.25);
  // Capped and re-centred on the band, for the reason `MAX_BAR_WIDTH` gives.
  const barWidth = Math.min(MAX_BAR_WIDTH, band.width);

  /**
   * `formatHours` / `formatDays` rather than an ICU message with a `{n}` in it:
   * a bare numeric argument is formatted by next-intl under the page locale and
   * renders `٤` under `ar` (thread 22), and CLDR already knows Arabic's six
   * plural categories so nothing has to be written into the catalogue.
   */
  function edge(hours: number): string {
    return hours < 24
      ? formatHours(hours, locale)
      : formatDays(hours / 24, locale);
  }

  const labels = buckets.map((bucket) =>
    bucket.to === null
      ? t("bucketOver", { from: edge(bucket.from) })
      : t("bucketRange", { from: edge(bucket.from), to: edge(bucket.to) }),
  );

  return (
    <ChartCard
      title={t("turnaroundTitle")}
      note={t("turnaroundNote")}
      empty={empty}
      emptyMessage={t("turnaroundEmpty")}
      table={
        <ChartTable
          caption={t("turnaroundTitle")}
          head={[t("turnaroundBucket"), t("decisions")]}
          rows={buckets.map((bucket, i) => [
            labels[i] ?? "",
            countLabel(bucket.n, locale),
          ])}
        />
      }
    >
      <div className="relative" style={{ width: box.width }}>
        <svg
          width={box.width}
          height={box.height}
          role="img"
          aria-label={t("turnaroundTitle")}
        >
          <ChartAxes
            box={box}
            ticks={ticks}
            y={y}
            tickLabels={ticks.map((tick) => countLabel(tick, locale))}
            categories={buckets.map((_, index) => ({
              index,
              label: labels[index] ?? "",
            }))}
            xAt={(i) => band.centre(i)}
            rtl={rtl}
          />

          <g transform={`translate(${box.start} ${box.top})`}>
            {buckets.map((bucket, i) =>
              bucket.n === 0 ? null : (
                <g key={`${bucket.from}`}>
                  <rect
                    x={band.centre(i) - barWidth / 2}
                    y={y(bucket.n)}
                    width={barWidth}
                    height={box.plotHeight - y(bucket.n)}
                    rx={4}
                    className={SOLO.fill}
                  />
                  {/*
                    A direct label on every bar is legible here and only here:
                    six bars, one number each. On a 90-point time series the
                    same choice would be the "a number on every point"
                    anti-pattern, which is why the line charts label only their
                    ends.
                  */}
                  <text
                    x={band.centre(i)}
                    y={y(bucket.n) - 5}
                    textAnchor="middle"
                    fontSize={LABEL_FONT_SIZE}
                    className="fill-foreground"
                  >
                    {countLabel(bucket.n, locale)}
                  </text>
                </g>
              ),
            )}
          </g>
        </svg>

        <ChartHover
          box={box}
          mode="band"
          labels={labels}
          series={[
            {
              label: t("decisions"),
              swatch: SOLO.bg,
              values: buckets.map((bucket) => countLabel(bucket.n, locale)),
            },
          ]}
        />
      </div>
    </ChartCard>
  );
}
