/**
 * **One categorical palette for the whole analytics screen**, and the map from
 * a domain entity to its slot.
 *
 * Plain module — no `server-only`, no React. Six charts render on the server
 * and the shared hover layer is a client component; both name colours from
 * here, and a `"use client"` module's exports are client *references* a Server
 * Component cannot call (thread 59).
 *
 * ---
 *
 * **Why class names and not colour strings.** `ZONE_FILL` holds
 * `var(--zone-permitted)`, which MapLibre cannot parse and silently falls back
 * on (thread 65). Nothing here can repeat that: these are Tailwind utilities
 * written as **whole literal strings**, so the scanner sees every one of them
 * and the browser resolves the variable itself. A composed name — `` `fill-chart-${n}` ``
 * — would produce no CSS at all and, again, fail silently.
 *
 * **The colour rules this screen follows, stated once:**
 *
 * 1. *Identity* takes a categorical slot, assigned in the fixed order below and
 *    never cycled. A build type is the same colour on every chart that shows
 *    one, which is what makes the headline chart comparable to the rest.
 * 2. *Outcome* takes a status colour — `approved` and `rejected` are good and
 *    bad, not "series 1" and "series 2" — and always carries a written label,
 *    never the colour alone.
 * 3. *Magnitude* takes the sequential ramp: one hue, light to dark.
 * 4. **A chart with one series wears the app's `primary`, never a slot.** The
 *    slots mean identity, and a lone series has no identity to communicate;
 *    painting the zone bars in slot 1 would read as "these bars are
 *    commercial". `primary` is not in the categorical palette, sits ΔE 16.6
 *    from slot 1 for a full-colour reader, and clears 7:1 on both surfaces.
 *
 * **The light-mode contrast obligation.** Slots 3, 4 and 5 sit below 3:1 on
 * white — an accepted result of the palette validation, not an oversight. It
 * obligates a relief channel, so every chart that uses them carries **direct
 * labels and a table view**. That is why `ChartTable` is not optional chrome.
 */

/** A drawn colour: the three utilities a mark can need, as literal strings. */
export type Ink = {
  readonly fill: string;
  readonly stroke: string;
  readonly text: string;
  /** For the legend swatch and the tooltip dot. */
  readonly bg: string;
};

function ink(fill: string, stroke: string, text: string, bg: string): Ink {
  return { fill, stroke, text, bg };
}

/**
 * The eight slots, in their fixed order. Indexed 1–8 to match the CSS tokens
 * and the palette documentation, so a slot number in a code review means the
 * same thing in `globals.css` and here.
 */
export const SLOT: Readonly<Record<1 | 2 | 3 | 4 | 5, Ink>> = {
  1: ink("fill-chart-1", "stroke-chart-1", "text-chart-1", "bg-chart-1"),
  2: ink("fill-chart-2", "stroke-chart-2", "text-chart-2", "bg-chart-2"),
  3: ink("fill-chart-3", "stroke-chart-3", "text-chart-3", "bg-chart-3"),
  4: ink("fill-chart-4", "stroke-chart-4", "text-chart-4", "bg-chart-4"),
  5: ink("fill-chart-5", "stroke-chart-5", "text-chart-5", "bg-chart-5"),
};

/** The mark colour of a single-series chart. See rule 4 above. */
export const SOLO: Ink = ink(
  "fill-primary",
  "stroke-primary",
  "text-primary",
  "bg-primary",
);

export const STATUS = {
  good: ink(
    "fill-status-good",
    "stroke-status-good",
    "text-status-good",
    "bg-status-good",
  ),
  critical: ink(
    "fill-status-critical",
    "stroke-status-critical",
    "text-status-critical",
    "bg-status-critical",
  ),
} as const;

/**
 * Build type → slot. **The one assignment the acceptance criteria name**:
 * `self_built` is slot 2 here and therefore slot 2 everywhere.
 *
 * The order is the enum's own (`commercial`, `self_built`, `fpv`) rather than
 * "most interesting first". The headline is the *share* that is self-built or
 * FPV, and a stack whose segments reorder by prominence would make two columns
 * of the same chart incomparable.
 */
export const BUILD_TYPE_SLOT = {
  commercial: SLOT[1],
  self_built: SLOT[2],
  fpv: SLOT[3],
} as const;

export type BuildType = keyof typeof BUILD_TYPE_SLOT;

/** The order build types stack and legend in. Never sorted by value. */
export const BUILD_TYPES: readonly BuildType[] = [
  "commercial",
  "self_built",
  "fpv",
];

/**
 * Who resolved a Remote ID. Slots 4 and 5 rather than 1 and 2, so that no
 * colour on this page carries two meanings: blue is `commercial` on the
 * headline chart and must not also be `public` two charts below it.
 *
 * **`public` and `staff`, where F25's spec says "anonymous / reviewer".** The
 * spec names two of the five values `remote_id_scan.viewer_level` actually
 * takes, and the other three — `pilot`, `owner`, `admin` — are not nothing:
 * they are 26 of the 30 scans in this database. Charting only two of five
 * would draw a total that is not the total, and a chart that quietly omits
 * rows is the kind of thing this screen exists to make impossible. The split
 * the spec is *asking* for is "is the enforcement side being used", so it is
 * drawn as the public (anonymous, pilot, owner) against staff (reviewer,
 * admin), and every scan lands in exactly one of them.
 */
export const RESOLVER_SLOT = {
  public: SLOT[4],
  staff: SLOT[5],
} as const;

export type Resolver = keyof typeof RESOLVER_SLOT;

export const RESOLVERS: readonly Resolver[] = ["public", "staff"];

/**
 * The sequential ramp, lightest (near zero) to darkest, as background
 * utilities — a heatmap cell is a `<rect>`, so it takes `fill-*`.
 *
 * Six steps and not a continuous interpolation, because a reader compares
 * *cells*, not shades: discrete steps are what make "this hour is busier than
 * that one" answerable without a colour picker. The legend prints each step's
 * range, and the cell carries its count as a title, so the ramp is never the
 * only route to the number.
 */
export const SEQUENTIAL: readonly string[] = [
  "fill-seq-1",
  "fill-seq-2",
  "fill-seq-3",
  "fill-seq-4",
  "fill-seq-5",
  "fill-seq-6",
];

/** The background twin of `SEQUENTIAL`, for the legend swatches. */
export const SEQUENTIAL_BG: readonly string[] = [
  "bg-seq-1",
  "bg-seq-2",
  "bg-seq-3",
  "bg-seq-4",
  "bg-seq-5",
  "bg-seq-6",
];

/**
 * **How many steps a ramp should actually use, given its maximum.**
 *
 * Six shades over a maximum of one is six shades that all mean "1", and the
 * legend prints the same number beside each of them — which is what the
 * utilisation heatmap did on real data, and it looks like a rendering fault
 * rather than a young platform. A ramp never has more steps than it has
 * distinguishable values.
 */
export function sequentialSteps(max: number): number {
  return Math.max(1, Math.min(SEQUENTIAL.length, Math.floor(max)));
}

/**
 * Which step a value falls in. **Zero is not step 0** — it returns `null`, and
 * the caller draws the empty-cell treatment instead. A busy hour and a
 * completely unused one must not differ by one shade of the same blue; on a
 * utilisation grid, "nobody has ever flown here" is a different kind of fact
 * from "one person did".
 *
 * The returned index is into the **darkest `sequentialSteps(max)` entries** of
 * the ramp, so a collapsed ramp still ends at the darkest shade for the busiest
 * cell — the top of the scale means the maximum whatever the maximum is.
 */
export function sequentialStep(value: number, max: number): number | null {
  if (value <= 0 || max <= 0) return null;
  const steps = sequentialSteps(max);
  const rank = Math.ceil((value / max) * steps);
  const within = Math.min(steps - 1, Math.max(0, rank - 1));
  return SEQUENTIAL.length - steps + within;
}

/** The upper bound of a step, for the legend. Mirrors `sequentialStep`. */
export function sequentialStepMax(index: number, max: number): number {
  const steps = sequentialSteps(max);
  const within = index - (SEQUENTIAL.length - steps);
  return Math.ceil((max * (within + 1)) / steps);
}

/** The ramp indices actually in use, darkest last — what the legend iterates. */
export function sequentialScale(max: number): readonly number[] {
  const steps = sequentialSteps(max);
  return Array.from(
    { length: steps },
    (_, i) => SEQUENTIAL.length - steps + i,
  );
}
