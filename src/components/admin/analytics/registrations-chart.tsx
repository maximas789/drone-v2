import { getTranslations } from "next-intl/server";
import {
  ChartCard,
  ChartLegend,
  ChartTable,
} from "@/components/admin/analytics/chart-card";
import { ChartAxes, thinLabels } from "@/components/admin/analytics/chart-axes";
import { ChartHover } from "@/components/admin/analytics/chart-hover";
import { HEADLINE, SURFACE_GAP } from "@/lib/analytics/layout";
import { bucketLabel, countLabel } from "@/lib/analytics/labels";
import { BUILD_TYPES, BUILD_TYPE_SLOT } from "@/lib/analytics/palette";
import {
  serialLessShare,
  type BuildTypeRow,
  type Window,
} from "@/lib/analytics/queries";
import {
  areaPath,
  axisMax,
  linearScale,
  niceTicks,
  pointScale,
  stackMax,
  stackRow,
} from "@/lib/analytics/scale";
import { formatPercent } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * **The chart this product is making its case with.**
 *
 * Registrations issued over time, stacked by build type. The point is not the
 * total — it is the *share* of the stack that is `self_built` or `fpv`:
 * aircraft with no manufacturer serial number, which under a serial-keyed
 * registration could not have been registered at all. That share is stated in
 * words above the plot as well as drawn in it, because a number a regulator has
 * to measure off a chart with their eye is a number they will not quote.
 *
 * **First and largest**, per F25. It gets `HEADLINE`'s taller box and the only
 * `text-lg` heading on the page.
 *
 * **A stacked area, not stacked bars.** The question is how the composition
 * moves over time; an area answers it continuously and a bar chart makes the
 * reader compare segment heights across a gap. The segments are separated by a
 * 2 px stroke in the surface colour so two touching fills never read as one.
 */
export async function RegistrationsChart({
  rows,
  window,
  locale,
}: {
  rows: readonly BuildTypeRow[];
  window: Window;
  locale: Locale;
}) {
  const t = await getTranslations("analytics");
  const tBuild = await getTranslations("drones");

  const box = HEADLINE;
  const rtl = locale === "ar";
  const share = serialLessShare(rows);
  const empty = share.total === 0;

  const columns = rows.map((row) => BUILD_TYPES.map((type) => row.value[type]));
  const max = axisMax(stackMax(columns));
  const ticks = niceTicks(stackMax(columns));
  const y = linearScale(0, max, box.plotHeight, 0);
  const x = pointScale(rows.length, box.plotWidth);

  const labels = rows.map((row) =>
    bucketLabel(row.key, window.bucket, locale, t("weekOf")),
  );

  /**
   * Cumulative tops per column, then one band per series between its own top
   * and the top below it. `stackRow` never reorders, so a segment cannot swap
   * places with its neighbour between two columns.
   */
  const tops = columns.map((column) => stackRow(column));

  const bands = BUILD_TYPES.map((type, seriesIndex) => {
    const upper = rows.map((_, i) => ({
      x: x.at(i),
      y: y(tops[i]?.[seriesIndex] ?? 0),
    }));
    const lower = rows.map((_, i) => ({
      x: x.at(i),
      y: y(seriesIndex === 0 ? 0 : (tops[i]?.[seriesIndex - 1] ?? 0)),
    }));
    return { type, upper, lower };
  });

  const buildLabel = (type: (typeof BUILD_TYPES)[number]) =>
    tBuild(`buildTypes.${type}`);

  return (
    <ChartCard
      headline
      title={t("registrationsTitle")}
      note={
        empty
          ? t("registrationsNote")
          : t("registrationsShare", {
              share: formatPercent(share.serialLess / share.total, locale),
              count: countLabel(share.serialLess, locale),
              total: countLabel(share.total, locale),
            })
      }
      empty={empty}
      emptyMessage={t("registrationsEmpty")}
      legend={
        <ChartLegend
          items={BUILD_TYPES.map((type) => ({
            label: buildLabel(type),
            swatch: BUILD_TYPE_SLOT[type].bg,
            value: countLabel(totalFor(rows, type), locale),
          }))}
        />
      }
      table={
        <ChartTable
          caption={t("registrationsTitle")}
          head={[t("period"), ...BUILD_TYPES.map(buildLabel), t("total")]}
          rows={rows.map((row, i) => [
            labels[i] ?? row.key,
            ...BUILD_TYPES.map((type) => countLabel(row.value[type], locale)),
            countLabel(
              BUILD_TYPES.reduce((sum, type) => sum + row.value[type], 0),
              locale,
            ),
          ])}
        />
      }
    >
      <div className="relative" style={{ width: box.width }}>
        <svg
          width={box.width}
          height={box.height}
          role="img"
          aria-label={t("registrationsTitle")}
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
            {bands.map((band) => (
              <path
                key={band.type}
                d={areaPath(band.upper, band.lower)}
                className={`${BUILD_TYPE_SLOT[band.type].fill} stroke-card`}
                /*
                  The 2 px separator is a stroke on each band in the *surface*
                  colour, not a gap cut into the geometry: a gap would move the
                  band's edge, and the direct label at the end of the series
                  aims at that edge.
                */
                strokeWidth={SURFACE_GAP}
                fillOpacity={0.85}
              />
            ))}
          </g>

        </svg>

        <ChartHover
          box={box}
          mode="point"
          labels={labels}
          series={BUILD_TYPES.map((type) => ({
            label: buildLabel(type),
            swatch: BUILD_TYPE_SLOT[type].bg,
            values: rows.map((row) => countLabel(row.value[type], locale)),
          }))}
        />
      </div>
    </ChartCard>
  );
}

/** A series' total across the window — the number its legend swatch carries. */
function totalFor(
  rows: readonly BuildTypeRow[],
  type: (typeof BUILD_TYPES)[number],
): number {
  return rows.reduce((sum, row) => sum + row.value[type], 0);
}
