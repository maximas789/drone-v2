import type { ZoneKindValue } from "@/lib/airspace/types";

/**
 * The one place that says what colour a zone kind is and in what order kinds
 * are painted.
 *
 * **There are two renderers, on purpose**, and this is what stops them drifting:
 *
 * - the **SVG** in `components/airspace/zone-drawing.tsx`, on the landing page,
 *   which is server-rendered and ships no JavaScript at all;
 * - the **MapLibre map** in `components/map/`, on `/zones`, which costs the
 *   better part of a megabyte of engine and earns it by panning, zooming and
 *   sitting on a real basemap.
 *
 * Keeping the SVG was a decision, not an oversight. The front door has one job
 * — explain the product before the reader leaves — and paying a map engine's
 * download for a picture nobody interacts with is the wrong trade. `/zones` is
 * where somebody has decided to actually study the airspace.
 *
 * What must never differ between them is *what the picture means*: the same
 * three colours, and the same back-to-front order so that the strictest rule is
 * the one you see. Hence this file. The colours themselves still live in
 * `globals.css` — these are the variable names, not values.
 */

/**
 * Painted back to front. A permitted carve-out drawn *over* a no-fly overlay
 * would look identical to one drawn under it and would be a different claim.
 */
export const DRAW_ORDER: readonly ZoneKindValue[] = [
  "restricted",
  "permitted",
  "no_fly",
];

/**
 * `var(--zone-*)`, ready to drop into a `style` attribute.
 *
 * The SVG and the legend use these directly. The map cannot — MapLibre does not
 * parse `oklch()` — so `color-resolve.ts` reads the *computed* value of the
 * same variables through a canvas and hands MapLibre the hex. Two consumers,
 * one definition.
 */
export const ZONE_FILL: Record<ZoneKindValue, string> = {
  permitted: "var(--zone-permitted)",
  restricted: "var(--zone-restricted)",
  no_fly: "var(--zone-no-fly)",
};
