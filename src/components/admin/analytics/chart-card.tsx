import { getTranslations } from "next-intl/server";

/**
 * The frame every chart on `/admin/analytics` is drawn in: a heading, an
 * optional sentence saying what the chart is measuring, the plot, a legend, and
 * — always — a table of the same numbers.
 *
 * **The table is not a nicety, it is the palette's other half.** Three of the
 * light-mode categorical slots sit below 3:1 against white. That is a known,
 * accepted result of validating the palette, and it comes with an obligation:
 * no value on this page may be readable *only* by matching a fill to a legend
 * swatch. Direct labels do most of that work; the table closes the rest of it,
 * and it is also what a screen reader gets instead of an `<svg>`.
 *
 * It is a `<details>` rather than an always-open table because seven open
 * tables would bury the charts, and `<details>` is a real disclosure control
 * that keyboard and assistive technology already understand — no JavaScript,
 * on a page that otherwise ships almost none.
 *
 * **The empty state replaces the plot, it does not sit under it.** A chart with
 * no data drawn as an axis with nothing on it reads as a rendering failure, and
 * the reader's next move is to reload rather than to believe it. So an empty
 * chart says, in words, that there is nothing to show yet.
 */
export async function ChartCard({
  title,
  note,
  empty,
  emptyMessage,
  legend,
  table,
  headline = false,
  children,
}: {
  title: string;
  note?: string;
  empty: boolean;
  emptyMessage: string;
  legend?: React.ReactNode;
  table: React.ReactNode;
  headline?: boolean;
  children: React.ReactNode;
}) {
  const t = await getTranslations("analytics");

  return (
    <section className="bg-card flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h2
          className={
            headline ? "text-lg font-semibold" : "text-base font-semibold"
          }
        >
          {title}
        </h2>
        {note === undefined ? null : (
          <p className="text-muted-foreground text-sm">{note}</p>
        )}
      </div>

      {empty ? (
        <p className="text-muted-foreground border-border flex min-h-24 items-center justify-center rounded-md border border-dashed p-6 text-center text-sm">
          {emptyMessage}
        </p>
      ) : (
        <>
          {legend}
          {/*
            **The scroll lives here and nowhere else.** The SVG is drawn at its
            intrinsic size so its type stays the size it was chosen at; below
            about 760 px this box scrolls and the page body does not. Under RTL
            `document.documentElement.scrollWidth` is not a trustworthy signal
            for whether that held (thread 62) — `body.scrollWidth ===
            clientWidth` is.
          */}
          <div className="overflow-x-auto">{children}</div>
        </>
      )}

      <details className="group">
        {/*
          `inline-flex min-h-8` rather than a bare line of text: measured on the
          page, the summary was a 20 px-high target. It is very wide, so it was
          never hard to hit, but 20 px is below anything this build calls a
          control and it costs nothing to fix. `w-fit` keeps the target on the
          words instead of spanning the whole card, which would make an
          accidental click anywhere on that row open the table.
        */}
        <summary className="text-muted-foreground hover:text-foreground inline-flex min-h-8 w-fit cursor-pointer items-center text-sm">
          {t("tableToggle")}
        </summary>
        <div className="mt-3 overflow-x-auto">{table}</div>
      </details>
    </section>
  );
}

/** The table every chart ships beside its plot. One shape, seven callers. */
export function ChartTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: readonly string[];
  rows: readonly (readonly string[])[];
}) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b">
          {head.map((cell, i) => (
            <th
              key={cell}
              scope="col"
              /*
                The first column is the category and takes the reading
                direction; the rest are counts and hug the numeric column.
                `text-start` / `text-end`, never `left` / `right`.
              */
              className={`text-muted-foreground py-1.5 font-medium ${
                i === 0 ? "text-start" : "text-end"
              }`}
            >
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]} className="border-b last:border-0">
            {row.map((cell, i) => (
              <td
                key={`${row[0]}-${i}`}
                className={`py-1.5 ${i === 0 ? "text-start" : "text-end"}`}
              >
                {/*
                  A formatted Arabic date sits in the first column of most of
                  these tables. `<bdi>` isolates it so the neutral numerals
                  around a strong-RTL month name do not reorder — never
                  `dir="ltr"`, which produces `19 17:00 – 15:00 2026 أغسطس`
                  and only a screenshot catches it, because `innerText` stays
                  correct.
                */}
                <bdi>{cell}</bdi>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The legend. Present whenever a chart has two or more series — identity is
 * never carried by colour alone — and absent when it has one, where the title
 * already names what is being counted and a one-row legend is just noise.
 *
 * **It carries each series' total for the window, and that is the direct
 * label.** The conventional place for one is at the end of the series, and
 * that is where these started; on real data it did not survive. Two series
 * whose last non-empty bucket is a month apart put their numbers fifteen
 * pixels apart on a three-year axis and printed them on top of each other, and
 * two series ending on the same value at the same bucket would overlap
 * exactly. A total beside the swatch cannot collide with anything, is present
 * even when a series is empty for the whole window, and binds the number to
 * the colour — which is what the light-mode contrast relief actually requires.
 * *When* it happened is the tooltip's job, and the table's.
 */
export function ChartLegend({
  items,
}: {
  items: readonly {
    readonly label: string;
    readonly swatch: string;
    /** Pre-formatted through `format.ts`. Optional — a legend may be identity only. */
    readonly value?: string;
  }[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-sm">
          <span
            aria-hidden
            className={`inline-block size-2.5 shrink-0 rounded-[2px] ${item.swatch}`}
          />
          {/*
            The label wears text ink, never the series colour: a coloured word
            beside a coloured swatch is two encodings of the same thing and the
            weaker one is the one that fails in greyscale.
          */}
          <span className="text-muted-foreground">{item.label}</span>
          {item.value === undefined ? null : (
            <span className="text-foreground font-medium tabular-nums">
              <bdi>{item.value}</bdi>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
