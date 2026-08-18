/**
 * Turns a CSS custom property into a concrete colour MapLibre will accept.
 *
 * **Why this has to exist.** The zone colours are defined once, in
 * `globals.css`, as `oklch()` — so a zone is the same green on the map as on
 * its status badge, and a designer changing one changes both. MapLibre's style
 * spec parses a fixed set of colour notations and **`oklch()` is not among
 * them**; handing it the raw token value paints nothing and logs nothing
 * useful. So the browser is asked to do the conversion.
 *
 * **The canvas round-trip — and it reads the pixel, not the string.**
 *
 * The obvious version of this is to assign the colour to `ctx.fillStyle` and
 * read the property back, on the assumption that the browser normalises it to
 * `#rrggbb`. **It does not, any more.** Chrome now serialises an `oklch()`
 * input as `lab(72.0461 18.396 61.7206)`, which MapLibre rejects just as firmly
 * as it rejected `oklch()` — the style validator says *"color expected"* and
 * every zone layer fails to add. Found by opening the page: the map came up as
 * an empty grey rectangle with nine validator errors behind it.
 *
 * So instead the colour is **painted** to a 1×1 canvas and the RGBA bytes are
 * read back with `getImageData`. Pixels are pixels; that cannot drift with a
 * browser's preferred serialisation. It still needs no colour-space maths of
 * our own, and it still tracks a theme change automatically, because the
 * *computed* value is what gets painted.
 *
 * **No hex literals in map code.** The fallbacks below are the single exception
 * and they are deliberately not a palette: they exist so that a browser too old
 * for `oklch()`, or a canvas context that could not be created, still draws
 * zones in *distinguishable* colours rather than three identical black
 * polygons. They approximate the tokens; the tokens remain authoritative.
 */

import type { ZoneKindValue } from "@/lib/airspace/types";

/**
 * Last-resort approximations of the `:root` tokens in `globals.css`. If these
 * are ever what a user sees, something is wrong — but "wrong and readable"
 * beats "wrong and monochrome" on a screen whose entire job is telling green
 * from red.
 */
const FALLBACK: Record<ZoneKindValue, string> = {
  permitted: "#3f9e63",
  restricted: "#d7a03f",
  no_fly: "#d1503f",
};

const CSS_VARIABLE: Record<ZoneKindValue, string> = {
  permitted: "--zone-permitted",
  restricted: "--zone-restricted",
  no_fly: "--zone-no-fly",
};

export type ZoneColors = Record<ZoneKindValue, string>;

/**
 * Reads a custom property off an element and normalises it through a canvas.
 *
 * Returns `null` rather than throwing on every failure path, so the caller
 * falls back per-colour instead of losing the whole palette to one bad token.
 */
export function resolveCssColor(
  variable: string,
  element: HTMLElement,
): string | null {
  const raw = getComputedStyle(element).getPropertyValue(variable).trim();
  if (!raw) return null;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    /**
     * `fillStyle` **silently ignores** a value it cannot parse and keeps its
     * previous one, so a sentinel goes in first: if the property still reads
     * back as the sentinel, the browser rejected `raw` and painting it would
     * just reproduce the sentinel's pixels.
     */
    const sentinel = "#010203";
    context.fillStyle = sentinel;
    context.fillStyle = raw;
    if (context.fillStyle === sentinel) return null;

    context.clearRect(0, 0, 1, 1);
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;

    // Fully transparent means nothing was painted — treat as unresolved rather
    // than handing MapLibre an invisible colour it would draw without warning.
    if (a === 0) return null;

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } catch {
    return null;
  }
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, "0");
}

/**
 * The three zone colours as MapLibre can use them.
 *
 * Pass the element the tokens are in scope on — normally the map container, so
 * that a `.dark` ancestor is taken into account. Resolving against a detached
 * node would read the light palette on a dark page.
 */
export function resolveZoneColors(element: HTMLElement): ZoneColors {
  const resolved = {} as ZoneColors;
  for (const kind of Object.keys(CSS_VARIABLE) as ZoneKindValue[]) {
    resolved[kind] = resolveCssColor(CSS_VARIABLE[kind], element) ?? FALLBACK[kind];
  }
  return resolved;
}

/** Exposed for the test, which asserts the fallbacks stay distinguishable. */
export const ZONE_COLOR_FALLBACK = FALLBACK;
export const ZONE_COLOR_VARIABLE = CSS_VARIABLE;
