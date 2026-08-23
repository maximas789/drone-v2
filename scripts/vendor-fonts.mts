/**
 * Copies the four font files the **preview card** needs out of `node_modules`
 * and into `assets/fonts/`, because the card is drawn by a renderer that cannot
 * use a stylesheet.
 *
 * **Why any of this is necessary.** `opengraph-image.tsx` renders through
 * `ImageResponse`, which is satori — a layout engine with no browser, no CSS
 * cascade and no font stack. It draws only the fonts handed to it as **bytes**,
 * and a glyph it has no font for is rendered as an empty box. The card's
 * headline is Arabic, so getting this wrong does not degrade the card; it
 * produces a rectangle of tofu on the one image every shared link displays.
 *
 * **`next/font/google` cannot supply them.** It downloads the faces at build
 * time into `.next/static/media` under content-hashed names — nothing in the
 * app knows which hash is which face — and it stores **WOFF2**, which satori
 * does not read. Both halves of that are disqualifying on their own.
 *
 * **Four files, not one.** satori resolves a glyph across every font it is
 * given, and Fontsource ships one file per subset. The card says
 * `أجنحة` and `Ajniha` side by side, so it needs the Arabic subset *and* the
 * Latin one; at two weights, because the wordmark is heavier than the sentence
 * under it. The other subsets this family ships — Cyrillic, Latin-Ext — are
 * left behind: nothing on the card is written in them, and a font file is
 * ~45 KB of bytes travelling into every build for nothing.
 *
 * **WOFF, not WOFF2.** satori reads TTF, OTF and WOFF. Fontsource ships both
 * WOFF and WOFF2 side by side under names differing by one character, and
 * picking the wrong one fails at *render* time, inside an image route, with no
 * type error and no build failure.
 *
 * **Not in `public/`.** These bytes are read by the server while drawing an
 * image; nothing in a browser ever requests them. `public/vendor/` is where the
 * *map's* worker assets go precisely because those must be reachable over HTTP,
 * and putting fonts beside them would publish 127 KB the app never serves.
 *
 * The copies are **committed**, so a fresh clone that runs `next build`
 * directly still has them, and `assets/fonts/fonts.test.ts` asserts the
 * committed bytes still match the installed package — otherwise a vendored copy
 * would silently rot the first time the dependency was bumped, and the failure
 * mode is a preview card full of boxes that nobody looks at until it has been
 * shared.
 *
 * `LICENSE` travels with them: IBM Plex is under the SIL Open Font License 1.1,
 * which permits redistribution and **requires the licence to accompany the
 * files**. Copying the bytes and leaving the licence behind is the one way to
 * get this wrong that has nothing to do with rendering.
 *
 * Run with `pnpm vendor:fonts`.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const pkg = join(root, "node_modules", "@fontsource", "ibm-plex-sans-arabic");
const dest = join(root, "assets", "fonts");

/**
 * **Deliberately not exported.** The test that guards these copies restates the
 * paths instead of importing them: this module copies at import time, so a test
 * that imported it would repair the staleness it exists to detect, and then
 * pass. The same call `vendor-map-assets.mts` made, for the same reason.
 */
const files = [
  "ibm-plex-sans-arabic-arabic-400-normal.woff",
  "ibm-plex-sans-arabic-arabic-600-normal.woff",
  "ibm-plex-sans-arabic-latin-400-normal.woff",
  "ibm-plex-sans-arabic-latin-600-normal.woff",
];

mkdirSync(dest, { recursive: true });

for (const file of files) {
  const from = join(pkg, "files", file);
  const to = join(dest, file);
  copyFileSync(from, to);
  console.log(`vendored ${file}`);
}

copyFileSync(join(pkg, "LICENSE"), join(dest, "LICENSE"));
console.log("vendored LICENSE (SIL OFL 1.1 — required to accompany the fonts)");
