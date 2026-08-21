import {
  AXIS_FONT_SIZE,
  anchorAtMaxX,
  type ChartBox,
} from "@/lib/analytics/layout";

/**
 * Gridlines, the count axis, and the category axis — shared by all seven
 * charts so they line up with each other down the page.
 *
 * **Recessive.** The grid is a hairline in the border token and the tick labels
 * are muted; the marks are the only thing on the page wearing a saturated
 * colour. A chart where the furniture competes with the data is the most common
 * way a dashboard becomes hard to read while every individual choice looks
 * defensible.
 *
 * **The axis is on the left in Arabic too.** F25 decides that the plot area is
 * not mirrored — time runs left to right in both locales — and an axis that
 * jumped to the other side would be a half-mirrored plot, which is worse than
 * either whole. The *labels* are Arabic and the numerals are Latin, which is
 * what `format.ts` guarantees. The page says this out loud rather than leaving
 * a reader to wonder whether it was an oversight.
 *
 * **Which is why `rtl` has to be passed in.** The tick labels want their right
 * edge against the plot, and `text-anchor="end"` does not mean that on an
 * Arabic page — see `anchorAtMaxX`. The category labels are `middle`, which is
 * the one anchor value that means the same thing in both directions, so they
 * need nothing.
 */
export function ChartAxes({
  box,
  ticks,
  y,
  tickLabels,
  categories,
  xAt,
  rtl,
}: {
  box: ChartBox;
  ticks: readonly number[];
  y: (value: number) => number;
  /** Pre-formatted through `format.ts`. Never a raw number. */
  tickLabels: readonly string[];
  /** Pre-formatted category labels, one per position, already thinned. */
  categories: readonly { readonly index: number; readonly label: string }[];
  xAt: (index: number) => number;
  /** True on the Arabic page. Affects anchoring only — never the geometry. */
  rtl: boolean;
}) {
  return (
    <g aria-hidden>
      {ticks.map((tick, i) => (
        <g key={tick}>
          <line
            x1={box.start}
            x2={box.start + box.plotWidth}
            y1={box.top + y(tick)}
            y2={box.top + y(tick)}
            className={
              // The zero line is the baseline the marks stand on, so it is the
              // one gridline allowed to be visible rather than a hairline.
              i === 0 ? "stroke-border" : "stroke-border/60"
            }
            strokeWidth={i === 0 ? 1 : 1}
            strokeDasharray={i === 0 ? undefined : "2 3"}
          />
          <text
            x={box.start - 6}
            y={box.top + y(tick)}
            textAnchor={anchorAtMaxX(rtl)}
            dominantBaseline="middle"
            fontSize={AXIS_FONT_SIZE}
            className="fill-muted-foreground"
          >
            {tickLabels[i]}
          </text>
        </g>
      ))}

      {categories.map((category) => (
        <text
          key={category.index}
          x={box.start + xAt(category.index)}
          y={box.height - 10}
          textAnchor="middle"
          fontSize={AXIS_FONT_SIZE}
          className="fill-muted-foreground"
        >
          {category.label}
        </text>
      ))}
    </g>
  );
}

/**
 * Which positions get a label. Every bucket labelled is unreadable at 90 daily
 * points and pointless at 3; the first and the last are always kept, because a
 * time axis whose ends are unlabelled does not say what period it covers.
 *
 * **The last label wins any collision near it.** The regular stride and the
 * always-kept final index are two rules that do not know about each other, and
 * where they land close together the labels overlap: 39 monthly buckets put a
 * label on index 36 and another on 38, and `أغسطس 2026` printed on top of
 * `يونيو 2026`. Every strided label within a stride of the end is therefore
 * dropped — the end is the one a reader actually needs, since it says where
 * the axis stops.
 *
 * Found on the page. Nothing about it is visible to `lint`, `typecheck` or a
 * unit test that only asserts which indices come back.
 */
export function thinLabels(
  count: number,
  format: (index: number) => string,
  maxLabels = 7,
): readonly { index: number; label: string }[] {
  if (count === 0) return [];
  const every = Math.max(1, Math.ceil(count / maxLabels));
  const last = count - 1;

  const picked = new Set<number>([0, last]);
  for (let i = 0; i < count; i += every) {
    if (i === 0 || last - i >= every) picked.add(i);
  }

  return [...picked]
    .sort((a, b) => a - b)
    .map((index) => ({ index, label: format(index) }));
}
