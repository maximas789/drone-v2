import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **The vendored fonts must still match the installed package.**
 *
 * `assets/fonts/` holds four faces copied out of `@fontsource/ibm-plex-sans-arabic`
 * by `pnpm vendor:fonts`, because the preview card is drawn by satori — which
 * has no stylesheet, no font stack and no browser, and renders a glyph it has no
 * font for as an empty box.
 *
 * A vendored copy rots the first time its dependency is bumped, silently. The
 * failure mode here is the whole point: **a stale or missing font file does not
 * throw.** It produces a card of tofu on the one image every shared link
 * displays, and nobody looks at that image until after they have shared it.
 *
 * The paths are **restated** rather than imported from `scripts/vendor-fonts.mts`:
 * that module copies at import time, so a test that imported it would repair the
 * staleness it exists to detect and then pass. The same call
 * `vendor-map-assets.mts` made, for the same reason.
 */

const VENDORED = join("assets", "fonts");
const INSTALLED = join(
  "node_modules",
  "@fontsource",
  "ibm-plex-sans-arabic",
  "files",
);

/**
 * Four, because satori resolves a glyph across every font it is handed and
 * Fontsource ships one file per subset: the card sets Arabic beside Latin, at
 * two weights.
 */
const FACES = [
  "ibm-plex-sans-arabic-arabic-400-normal.woff",
  "ibm-plex-sans-arabic-arabic-600-normal.woff",
  "ibm-plex-sans-arabic-latin-400-normal.woff",
  "ibm-plex-sans-arabic-latin-600-normal.woff",
];

describe("the vendored preview-card fonts", () => {
  it.each(FACES)("%s matches the installed package", async (face) => {
    const [vendored, installed] = await Promise.all([
      readFile(join(VENDORED, face)),
      readFile(join(INSTALLED, face)),
    ]);
    expect(
      vendored.equals(installed),
      `${face} is stale — run \`pnpm vendor:fonts\``,
    ).toBe(true);
  });

  /**
   * **WOFF, not WOFF2.** satori reads TTF, OTF and WOFF. Fontsource ships both
   * side by side under names differing by one character, and picking the wrong
   * one fails at *render* time, inside an image route, with no type error and no
   * build failure. `wOF2` is the WOFF2 signature; `wOFF` is WOFF's.
   */
  it.each(FACES)("%s really is WOFF, not WOFF2", async (face) => {
    const bytes = await readFile(join(VENDORED, face));
    expect(bytes.subarray(0, 4).toString("latin1")).toBe("wOFF");
  });

  /**
   * IBM Plex is under the SIL Open Font License 1.1, which permits
   * redistribution and **requires the licence to travel with the files**.
   * Copying the bytes and leaving the licence behind is the one way to get this
   * wrong that has nothing to do with rendering.
   */
  it("ships the licence beside them", async () => {
    const licence = await readFile(join(VENDORED, "LICENSE"), "utf8");
    expect(licence).toContain("SIL Open Font License");
  });
});
