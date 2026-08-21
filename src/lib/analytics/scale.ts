/**
 * The geometry under every chart on `/admin/analytics` — scales, ticks and path
 * builders, and nothing else.
 *
 * **Pure, and no React.** Same rule as `src/lib/airspace/evaluate.ts`: no `db`,
 * no `server-only`, no `next-intl`. Every chart in this build renders on the
 * server, but the shared hover layer is a client component that has to convert a
 * pointer position back into a data index using the *same* band scale the server
 * drew with. Two implementations of that arithmetic would put the tooltip on the
 * wrong column, and the drift would be invisible to every check we run.
 *
 * **Nothing here formats anything.** A tick is a `number`; turning it into
 * `1٬234` or `1,234` is `src/lib/format.ts`'s job and only its job (rule 6).
 *
 * **Nothing here is mirrored for Arabic.** The plot area runs left→right in
 * both locales — see the note on the analytics page itself. SVG's coordinate
 * system ignores `direction` anyway, which is why this file can be locale-blind.
 */

/** A left→right, top→bottom pixel box. `y` grows downward, as SVG does. */
export type Plot = {
  readonly width: number;
  readonly height: number;
};

// --- Linear scales --------------------------------------------------------

/**
 * Value → pixel, with the range given **outputs-first** so a downward y axis
 * reads as what it is: `linearScale(0, max, height, 0)` puts zero at the bottom.
 */
export function linearScale(
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
): (value: number) => number {
  const span = domainMax - domainMin;
  // A flat series (every value identical, including all-zero) has no span to
  // divide by. Collapsing it to the range floor draws a line on the baseline,
  // which is the truth, rather than NaN, which is an empty <svg>.
  if (span === 0) return () => rangeMin;
  return (value) =>
    rangeMin + ((value - domainMin) / span) * (rangeMax - rangeMin);
}

/**
 * A "nice" upper bound and its ticks, for a count axis that always starts at 0.
 *
 * A count axis that starts anywhere else exaggerates the change — the first
 * entry in the anti-pattern catalogue — so the floor is not a parameter.
 *
 * The step is snapped to 1, 2, 5 or 10 × a power of ten so the labels read as
 * round numbers, and the top tick is the axis maximum, so no mark ever floats
 * above the last gridline.
 *
 * **The step never goes below 1**, and that is not a rounding convenience.
 * Every axis on this page counts things — registrations, decisions, bookings,
 * scans — and the no-show chart is drawn as whole percentage points for the
 * same reason. Left unguarded, a maximum of 1 produced ticks at 0, 0.5 and 1,
 * and the axis of the platform's most important chart offered to measure half
 * an aircraft. It was a unit test that said so, not the screen.
 */
export function niceTicks(max: number, target = 4): readonly number[] {
  // An empty range still needs an axis to hang the empty state on.
  if (!Number.isFinite(max) || max <= 0) return [0, 1];

  const rawStep = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalised = rawStep / magnitude;
  const step = Math.max(
    1,
    (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) *
      magnitude,
  );

  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  // Accumulating with a counter rather than `+= step` keeps 0.1-sized steps
  // from drifting into 0.30000000000000004 and printing it on the axis.
  for (let i = 0; i * step <= top + step / 2; i += 1) {
    ticks.push(Number((i * step).toPrecision(12)));
  }
  return ticks;
}

/** The axis maximum implied by `niceTicks` — its last tick. */
export function axisMax(max: number, target = 4): number {
  const ticks = niceTicks(max, target);
  return ticks[ticks.length - 1] ?? 1;
}

// --- Band scales ----------------------------------------------------------

export type Band = {
  /** Distance between the starts of two neighbouring bands. */
  readonly step: number;
  /** Drawn width of one band, padding already removed. */
  readonly width: number;
  /** Left edge of band `i`. */
  readonly at: (index: number) => number;
  /** Centre of band `i` — where a line vertex or a direct label sits. */
  readonly centre: (index: number) => number;
  /** Which band a pixel offset falls in, clamped. The hover layer's inverse. */
  readonly indexAt: (offset: number) => number;
};

/**
 * `count` equal slots across `width`, with `padding` (0–1) of each step given
 * back as gap.
 *
 * The 2 px surface gap the mark spec asks for between adjacent fills is *not*
 * done here — it is a stroke in the surface colour on the mark itself, because
 * a gap cut out of the band would also move the band's centre, and the centre
 * is where the hover layer and the direct labels both aim.
 */
export function bandScale(count: number, width: number, padding = 0.2): Band {
  const safeCount = Math.max(count, 1);
  const step = width / safeCount;
  const bandWidth = step * (1 - padding);
  const inset = (step - bandWidth) / 2;
  return {
    step,
    width: bandWidth,
    at: (index) => index * step + inset,
    centre: (index) => index * step + step / 2,
    indexAt: (offset) =>
      Math.min(safeCount - 1, Math.max(0, Math.floor(offset / step))),
  };
}

/**
 * Evenly spaced *points* rather than bands — the x positions of a line or area
 * chart, where the first and last vertices sit on the plot edges rather than
 * inset by half a band.
 */
export function pointScale(count: number, width: number): Band {
  const safeCount = Math.max(count, 1);
  const step = safeCount === 1 ? width : width / (safeCount - 1);
  return {
    step,
    width: 0,
    at: (index) => (safeCount === 1 ? width / 2 : index * step),
    centre: (index) => (safeCount === 1 ? width / 2 : index * step),
    indexAt: (offset) =>
      Math.min(safeCount - 1, Math.max(0, Math.round(offset / step))),
  };
}

// --- Paths ----------------------------------------------------------------

export type Point = { readonly x: number; readonly y: number };

/** `M x y L x y …` — a polyline. Empty input yields `""`, not `"M"`. */
export function linePath(points: readonly Point[]): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)} ${round(p.y)}`)
    .join(" ");
}

/**
 * A closed band between an upper and a lower edge — one stacked area segment.
 * The lower edge is walked backwards so the outline never crosses itself.
 */
export function areaPath(
  upper: readonly Point[],
  lower: readonly Point[],
): string {
  if (upper.length === 0 || lower.length === 0) return "";
  const forward = upper
    .map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)} ${round(p.y)}`)
    .join(" ");
  const back = [...lower]
    .reverse()
    .map((p) => `L${round(p.x)} ${round(p.y)}`)
    .join(" ");
  return `${forward} ${back} Z`;
}

/**
 * Two decimals is under a thousandth of a pixel at any size this app draws at,
 * and it keeps the server-rendered markup — which ships in the RSC payload of
 * every analytics request — from carrying seventeen digits per vertex.
 */
function round(value: number): number {
  return Number(value.toFixed(2));
}

// --- Stacking -------------------------------------------------------------

/**
 * Cumulative tops for one row of a stacked chart, in the order given.
 *
 * The order is the caller's and is never sorted here: a stack whose segments
 * reorder between two columns is unreadable, and sorting by value would do
 * exactly that.
 */
export function stackRow(values: readonly number[]): readonly number[] {
  const tops: number[] = [];
  let running = 0;
  for (const value of values) {
    running += value;
    tops.push(running);
  }
  return tops;
}

/** The tallest column of a stack — the domain maximum of a stacked chart. */
export function stackMax(rows: readonly (readonly number[])[]): number {
  return rows.reduce(
    (max, row) => Math.max(max, row.reduce((sum, v) => sum + v, 0)),
    0,
  );
}
