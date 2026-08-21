"use client";

import { useState } from "react";
import { bandScale, pointScale } from "@/lib/analytics/scale";
import type { ChartBox } from "@/lib/analytics/layout";

/**
 * **The only client component on the analytics screen.**
 *
 * Six of the seven charts render entirely on the server — the marks, the axes,
 * the direct labels and the table are all in the HTML, and a reader with
 * JavaScript disabled loses nothing but the tooltip. This one overlay adds the
 * hover layer the `dataviz` conventions ask for on every plotted form, once,
 * for all of them.
 *
 * **It reads the same scales the server drew with**, from
 * `@/lib/analytics/scale` — a plain module precisely so both sides can. A
 * second implementation of `indexAt` living in here would put the tooltip on
 * the column next to the one under the pointer, and no check in this build
 * would notice.
 *
 * **Every string arriving here is already formatted.** The values are strings,
 * not numbers, and the labels are strings, not dates. Rule 6's choke point is
 * `src/lib/format.ts`, which is server-side here; a number crossing into this
 * component and being rendered raw inside an ICU message would print
 * Arabic-Indic digits under `ar` (thread 22), and neither ESLint nor the i18n
 * check can see that route.
 */

export type HoverSeries = {
  readonly label: string;
  /** One pre-formatted string per category, same length and order as `labels`. */
  readonly values: readonly string[];
  /** A `bg-*` utility, written as a whole literal so Tailwind's scanner sees it. */
  readonly swatch: string;
};

export function ChartHover({
  box,
  mode,
  labels,
  series,
}: {
  box: ChartBox;
  /** `band` for bars and columns, `point` for lines and areas. */
  mode: "band" | "point";
  readonly labels: readonly string[];
  readonly series: readonly HoverSeries[];
}) {
  const [active, setActive] = useState<number | null>(null);

  const scale =
    mode === "band"
      ? bandScale(labels.length, box.plotWidth)
      : pointScale(labels.length, box.plotWidth);

  function onMove(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    /*
      `clientX - rect.left` and **not** an RTL-aware offset. The plot is
      deliberately not mirrored, so the leftmost pixel is index 0 in Arabic
      exactly as it is in English; a direction-aware read here would silently
      reverse the tooltip under `ar` while looking correct under `en`.
    */
    setActive(scale.indexAt(event.clientX - rect.left));
  }

  const x = active === null ? 0 : scale.centre(active);
  // Flip the tooltip to the other side of the crosshair near the end of the
  // plot, so it is never clipped by the scroll container.
  const flip = x > box.plotWidth - 130;

  return (
    <div
      className="absolute"
      style={{
        insetInlineStart: "unset",
        left: box.start,
        top: box.top,
        width: box.plotWidth,
        height: box.plotHeight,
      }}
      /*
        The overlay is the hit target and it is the whole plot area — bigger
        than any mark in it, which is what makes a 2 px line hoverable at all.
        `touch-action: none` is deliberately NOT set: this must not swallow the
        horizontal scroll gesture on a narrow screen.
      */
      onPointerMove={onMove}
      onPointerLeave={() => setActive(null)}
    >
      {active === null ? null : (
        <>
          <div
            aria-hidden
            className="bg-border pointer-events-none absolute top-0 h-full w-px"
            style={{ left: x }}
          />
          <div
            className="bg-popover text-popover-foreground pointer-events-none absolute top-0 z-10 flex min-w-32 flex-col gap-1 rounded-md border p-2 text-xs shadow-md"
            style={flip ? { right: box.plotWidth - x + 8 } : { left: x + 8 }}
            role="status"
          >
            <span className="text-muted-foreground">
              <bdi>{labels[active]}</bdi>
            </span>
            {series.map((s) => (
              <span key={s.label} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={`inline-block size-2 shrink-0 rounded-[2px] ${s.swatch}`}
                />
                <span className="text-muted-foreground">{s.label}</span>
                <span className="ms-auto font-medium">
                  <bdi>{s.values[active]}</bdi>
                </span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
