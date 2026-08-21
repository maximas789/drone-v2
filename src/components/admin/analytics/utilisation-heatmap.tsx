import { getTranslations } from "next-intl/server";
import { ChartCard, ChartTable } from "@/components/admin/analytics/chart-card";
import { countLabel } from "@/lib/analytics/labels";
import {
  SEQUENTIAL_BG,
  sequentialScale,
  sequentialStep,
  sequentialStepMax,
} from "@/lib/analytics/palette";
import type { UtilisationCell } from "@/lib/analytics/queries";
import { formatMinuteOfDay, formatWeekday } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * When and where people actually fly — seven weekday rows against twenty-four
 * hour columns.
 *
 * **Sunday is the first row**, because the Saudi working week starts on Sunday
 * and every recurring-availability rule in this build is indexed that way.
 * `extract(dow ...)` in Postgres is already Sunday = 0, so this is one of the
 * few places the convention comes for free.
 *
 * **This is magnitude, so it takes the sequential ramp** — one hue, light to
 * dark — and not the categorical slots. Discrete steps rather than a continuous
 * interpolation, because a reader compares *cells*: "busier than that one" is
 * answerable at a glance from a stepped ramp and needs a colour picker on a
 * smooth one. The ramp uses **as many steps as there are distinguishable
 * values**, up to six: six shades over a maximum of one is six shades that all
 * mean "1", and the legend printed that number six times.
 *
 * **A never-used hour is not step zero.** It gets the empty treatment — the
 * card's own surface, with a dashed hairline — because "nobody has ever flown
 * here" is a different kind of fact from "one person did", and one shade of
 * blue apart is not enough to say so. Every cell also carries its count as a
 * `title` and in a visually-hidden span, and the whole grid is in the table, so
 * the ramp is never the only route to a number.
 */
export async function UtilisationHeatmap({
  cells,
  locale,
}: {
  cells: readonly UtilisationCell[];
  locale: Locale;
}) {
  const t = await getTranslations("analytics");

  const grid = new Map<string, number>();
  let peak = 0;
  for (const cell of cells) {
    grid.set(`${cell.weekday}-${cell.hour}`, cell.n);
    peak = Math.max(peak, cell.n);
  }
  const empty = peak === 0;

  const weekdays = [0, 1, 2, 3, 4, 5, 6];
  const hours = Array.from({ length: 24 }, (_, hour) => hour);
  const at = (weekday: number, hour: number) =>
    grid.get(`${weekday}-${hour}`) ?? 0;

  return (
    <ChartCard
      title={t("utilisationTitle")}
      note={t("utilisationNote")}
      empty={empty}
      emptyMessage={t("utilisationEmpty")}
      legend={
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <li className="text-muted-foreground">{t("utilisationLegend")}</li>
          {sequentialScale(peak).map((step) => (
            <li key={step} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={`inline-block size-2.5 shrink-0 rounded-[2px] ${SEQUENTIAL_BG[step]}`}
              />
              <span className="text-foreground">
                <bdi>{countLabel(sequentialStepMax(step, peak), locale)}</bdi>
              </span>
            </li>
          ))}
        </ul>
      }
      table={
        <ChartTable
          caption={t("utilisationTitle")}
          head={[
            t("weekday"),
            ...hours.map((h) => formatMinuteOfDay(h * 60, locale)),
          ]}
          rows={weekdays.map((weekday) => [
            formatWeekday(weekday, locale),
            ...hours.map((hour) => countLabel(at(weekday, hour), locale)),
          ])}
        />
      }
    >
      {/*
        A CSS grid rather than an SVG. Every mark here is a rectangle on a
        regular lattice with no scale to compute, which is exactly what a grid
        already is — and it means each cell is a real element that can carry a
        title and a hidden label rather than a `<rect>` that cannot.

        **`dir="ltr"` on the grid, and it is load-bearing.** The hour axis is a
        *time* axis, and this page states in as many words that time runs left
        to right in both languages. Left to inherit the page's direction, the
        grid flowed right-to-left and printed the hours 23…0 — so the one chart
        where the promise is most visible was the one breaking it. The row
        labels move to the left edge as a consequence, which is where the y
        axis of every other chart here already is.

        Every element under it that carries *words* is given the page's own
        direction back. Mixed Arabic and numerals under an LTR base reorder —
        `الأحد 06:00: 1` becomes something else entirely — and it is exactly the
        `dir="ltr"` trap that `SlotTime` was written to avoid. Here the
        direction is restored on the text rather than avoided on the container,
        because the container's job is geometry.
      */}
      <div
        dir="ltr"
        className="grid gap-px"
        style={{
          gridTemplateColumns: "auto repeat(24, 22px)",
          width: "max-content",
        }}
      >
        <span />
        {hours.map((hour) => (
          <span
            key={hour}
            className="text-muted-foreground pb-1 text-center text-[10px]"
          >
            {/* Every third hour, so 24 labels do not collide at 22 px. */}
            {hour % 3 === 0 ? countLabel(hour, locale) : ""}
          </span>
        ))}

        {weekdays.map((weekday) => (
          <Row
            key={weekday}
            locale={locale}
            label={formatWeekday(weekday, locale)}
            cells={hours.map((hour) => {
              const value = at(weekday, hour);
              return {
                hour,
                title: t("utilisationCell", {
                  weekday: formatWeekday(weekday, locale),
                  hour: formatMinuteOfDay(hour * 60, locale),
                  count: countLabel(value, locale),
                }),
                step: sequentialStep(value, peak),
              };
            })}
          />
        ))}
      </div>
    </ChartCard>
  );
}

function Row({
  label,
  cells,
  locale,
}: {
  label: string;
  cells: readonly {
    hour: number;
    title: string;
    step: number | null;
  }[];
  locale: Locale;
}) {
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <>
      <span
        dir={dir}
        className="text-muted-foreground pe-2 text-xs leading-[22px] whitespace-nowrap"
      >
        {label}
      </span>
      {cells.map((cell) => (
        <span
          key={cell.hour}
          title={cell.title}
          className={
            cell.step === null
              ? "bg-muted/40 border-border/60 h-[22px] rounded-[2px] border border-dashed"
              : `h-[22px] rounded-[2px] ${SEQUENTIAL_BG[cell.step]}`
          }
        >
          <span dir={dir} className="sr-only">
            {cell.title}
          </span>
        </span>
      ))}
    </>
  );
}
