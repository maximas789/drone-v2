import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { RIYADH_ZONES } from "@/lib/seed/zones-riyadh";
import { computeBbox } from "@/lib/geo/bbox";
import { pathFor, projectionFor, unionBounds } from "@/lib/geo/project";

/**
 * What the preview card needs that the app itself never does: **fonts as
 * bytes, and colours as literal sRGB.**
 *
 * `ImageResponse` is satori — a layout engine with no browser behind it. It has
 * no CSS cascade, no custom properties, no font stack and no stylesheet. Every
 * value it is given has to already be a value.
 */

/* ------------------------------------------------------------------ colour */

/**
 * The dark palette from `globals.css`, **converted to hex once, here.**
 *
 * `globals.css` declares these as `oklch()` inside `:root` and `.dark`, and
 * satori can resolve neither the custom property nor, reliably, the colour
 * function. This is the same wall `color-resolve.ts` hit for MapLibre — thread
 * 65 — and it is worth restating why it is dangerous rather than merely
 * inconvenient: **a colour satori cannot parse does not throw.** It falls back,
 * silently, and the first evidence is a card that looks wrong in somebody
 * else's chat window.
 *
 * So the numbers are literal, and each carries the token it came from, so a
 * palette change is a diff somebody can follow rather than a mystery. They were
 * converted with the OKLab→sRGB transform and the conversion was checked
 * against known values — `oklch(1 0 0)` → `#ffffff`, `oklch(0.628 0.2577
 * 29.23)` → `#ff0000` — rather than trusted.
 *
 * **Dark, deliberately.** A preview card is shown against whatever background
 * the chat app has and cannot ask the reader's theme; a dark card with a light
 * wordmark reads on both, and the airspace it draws is a night-flying subject.
 */
export const OG = {
  /** `--background`, dark. */
  background: "#080d11",
  /** `--foreground`, dark. */
  foreground: "#f7f8fa",
  /** `--primary`, dark. */
  primary: "#5eb9d4",
  /** `--muted-foreground`, dark. */
  muted: "#9da4ac",
  /** `--accent`, dark — the hairline between the panels. */
  border: "#243036",
  /** `--zone-permitted`, dark. */
  permitted: "#4fb772",
  /** `--zone-restricted`, dark. */
  restricted: "#f2af48",
  /** `--zone-no-fly`, dark. */
  noFly: "#f05653",
} as const;

/* ------------------------------------------------------------------- fonts */

/**
 * The four vendored faces, read from disk.
 *
 * **Four, because satori resolves a glyph across every font it is handed** and
 * Fontsource ships one file per subset — the card sets `أجنحة` beside `Ajniha`,
 * so it needs the Arabic subset and the Latin one, at two weights.
 *
 * `assets/fonts/` is committed and `pnpm vendor:fonts` refreshes it;
 * `fonts.test.ts` fails if the committed bytes drift from the installed
 * package. See `scripts/vendor-fonts.mts` for why `next/font/google` cannot
 * supply these.
 */
const FONT_DIR = join(process.cwd(), "assets", "fonts");

export type OgFont = {
  name: string;
  data: Buffer;
  weight: 400 | 600;
  style: "normal";
};

export async function ogFonts(): Promise<OgFont[]> {
  const faces: { file: string; weight: 400 | 600 }[] = [
    { file: "ibm-plex-sans-arabic-arabic-400-normal.woff", weight: 400 },
    { file: "ibm-plex-sans-arabic-arabic-600-normal.woff", weight: 600 },
    { file: "ibm-plex-sans-arabic-latin-400-normal.woff", weight: 400 },
    { file: "ibm-plex-sans-arabic-latin-600-normal.woff", weight: 600 },
  ];

  return Promise.all(
    faces.map(async ({ file, weight }) => ({
      // One family name for all four: satori treats them as one font whose
      // coverage is the union of the subsets, which is the whole point.
      name: "Plex Arabic",
      data: await readFile(join(FONT_DIR, file)),
      weight,
      style: "normal" as const,
    })),
  );
}

/* ------------------------------------------------------------- the airspace */

/**
 * The seeded Riyadh zones as SVG path data — **the real authored geometry, not
 * an illustration.**
 *
 * It reads `RIYADH_ZONES` directly rather than the database. The card is
 * generated at build time, and making the one image every shared link displays
 * depend on a live query is a way to ship a blank card from a deploy whose
 * database was briefly unreachable. The seed module is the same source the
 * database is filled *from*, so the picture cannot disagree with the rows.
 *
 * Drawn in `DRAW_ORDER`: restricted underneath, permitted carve-outs over it,
 * no-fly on top. A permitted zone painted *under* a restricted one would look
 * identical and would be a different claim.
 *
 * **These are authored zones, not official GACA airspace** — the honesty rule
 * that governs every other map surface governs this one, and the card says so
 * in words as well as drawing it.
 */
export function riyadhZonePaths(width: number) {
  const zones = RIYADH_ZONES.map((zone) => ({
    kind: zone.kind,
    bbox: computeBbox(zone.geometry),
    geometry: zone.geometry,
  }));

  const bounds = unionBounds(zones.map((zone) => zone.bbox));
  if (!bounds) return null;

  const projection = projectionFor(bounds, { width, padding: 8 });

  const order = ["restricted", "permitted", "no_fly"] as const;
  const fill: Record<(typeof order)[number], string> = {
    restricted: OG.restricted,
    permitted: OG.permitted,
    no_fly: OG.noFly,
  };

  const paths = order.flatMap((kind) =>
    zones
      .filter((zone) => zone.kind === kind)
      .map((zone, index) => ({
        key: `${kind}-${index}`,
        d: pathFor(zone.geometry, projection),
        colour: fill[kind],
        // The restricted city is the ground the rest sits on, so it stays
        // faint; the carve-outs and the prohibitions are the subject.
        opacity: kind === "restricted" ? 0.22 : 0.55,
      })),
  );

  return { width: projection.width, height: projection.height, paths };
}
