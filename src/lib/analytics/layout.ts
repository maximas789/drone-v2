/**
 * The pixel box every chart on `/admin/analytics` is drawn in.
 *
 * **One set of numbers, shared by the server-rendered SVG and the client hover
 * overlay.** The overlay is an absolutely-positioned element sitting on top of
 * the `<svg>`; if it thought the plot started at a different x than the marks
 * do, the tooltip would report the neighbouring column and nothing would look
 * wrong. Two copies of these constants is exactly how that happens, so there is
 * one copy and both import it.
 *
 * **The SVG is drawn at its intrinsic size and scrolls, rather than scaling to
 * the container.** A `viewBox` that scales also scales the type: a 12 px axis
 * label in a 640 px design is under 7 px on a 360 px phone, which is not a
 * small label, it is an unreadable one. Fixed pixels keep the text at the size
 * it was chosen at, keep the hover overlay aligned to the mark under it, and
 * put the overflow in a container that scrolls — never on the page body.
 *
 * Pure. No React, no `server-only`.
 */

export type ChartBox = {
  readonly width: number;
  readonly height: number;
  readonly top: number;
  readonly end: number;
  readonly bottom: number;
  readonly start: number;
  /** Drawable width, margins removed. */
  readonly plotWidth: number;
  /** Drawable height, margins removed. */
  readonly plotHeight: number;
};

function box(
  width: number,
  height: number,
  margin: { top: number; end: number; bottom: number; start: number },
): ChartBox {
  return {
    width,
    height,
    ...margin,
    plotWidth: width - margin.start - margin.end,
    plotHeight: height - margin.top - margin.bottom,
  };
}

/**
 * The default frame. The bottom margin carries one line of date labels; the
 * start margin carries a count axis of up to four digits **plus** the direct
 * labels a stacked chart writes at the end of its series, which is why it is
 * not symmetric.
 *
 * `start`/`end` rather than `left`/`right` for the same reason the CSS rule
 * exists — but note that here they are *not* direction-aware: SVG coordinates
 * ignore `direction`, the plot is deliberately not mirrored in Arabic, and
 * `start` always means the left edge. The names are kept so nobody reading
 * this file has to hold two vocabularies at once.
 */
export const CHART = box(680, 220, { top: 12, end: 76, bottom: 30, start: 44 });

/** The headline chart is taller — it is meant to be looked at first and longest. */
export const HEADLINE = box(680, 300, {
  top: 12,
  end: 76,
  bottom: 30,
  start: 44,
});

/**
 * The horizontal bar chart. Its start margin holds full Arabic zone names, and
 * its height grows with the number of bars rather than being fixed — eight
 * zones squeezed into 220 px would put 27 px between baselines and set the
 * names in something nobody would read.
 */
export const BAR_ROW_HEIGHT = 34;

export function zoneBarBox(rows: number): ChartBox {
  return box(680, Math.max(rows, 1) * BAR_ROW_HEIGHT + 34, {
    top: 8,
    end: 56,
    bottom: 26,
    start: 200,
  });
}

/** Type sizes, in the SVG's own pixels. Axis labels sit at the app's `text-xs`. */
export const AXIS_FONT_SIZE = 11;
export const LABEL_FONT_SIZE = 12;

/** A 2 px ring in the surface colour, between touching fills and over crossing lines. */
export const SURFACE_GAP = 2;

/** Stroke width for a line series. Thin marks; the data is the ink. */
export const LINE_WIDTH = 2;

/** Minimum diameter of a hoverable point marker. */
export const MARKER_SIZE = 8;

/**
 * The widest a single bar may be drawn.
 *
 * A band scale gives each bucket an equal share of the plot, which is right
 * until there is one bucket: the "all" range on this database produced a single
 * month of decisions and drew it as a 200 px slab of colour that read as a
 * background, not a bar. The cap turns a lone bucket into a bar with space
 * around it, which is what it is.
 */
export const MAX_BAR_WIDTH = 44;

// --- Text anchoring under RTL ---------------------------------------------

/**
 * **SVG's `text-anchor` is direction-relative, not geometric**, and this is the
 * single thing about drawing charts in an Arabic page that will catch anybody
 * who has not been caught by it before.
 *
 * `start` and `end` mean the start and end of the *inline base direction*. On
 * an Arabic page the whole SVG inherits `direction: rtl`, so `text-anchor="end"`
 * anchors a label by its **left** edge, not its right. Every y-axis tick on
 * this page was therefore anchored backwards and printed into the plot area,
 * with `lint`, `typecheck` and 960 tests green. It was found by reading the
 * labels' `getBoundingClientRect()` out of the page — a screenshot at chart
 * scale does not make a six-pixel numeral's overhang obvious.
 *
 * These two say what they mean in the coordinate system the chart is actually
 * authored in, which is fixed left-to-right because the plot is deliberately
 * not mirrored. Note the deliberate absence of a `dir="ltr"` fix: putting that
 * on the SVG would repair the anchors and simultaneously reorder every Arabic
 * date label on the category axis into `2026 أغسطس`, which is a defect only a
 * screenshot catches because `textContent` stays correct.
 */
export function anchorAtMinX(rtl: boolean): "start" | "end" {
  return rtl ? "end" : "start";
}

export function anchorAtMaxX(rtl: boolean): "start" | "end" {
  return rtl ? "start" : "end";
}
