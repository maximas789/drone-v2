/**
 * Copies the Mapbox RTL text plugin out of `node_modules` and into `public/`.
 *
 * **Why vendor it instead of pointing at a CDN.** MapLibre's own documentation
 * example loads this from unpkg, and MapLibre's worker fetches the URL with
 * `importScripts`, so it has to be a real HTTP URL rather than a bundled
 * import. But without this plugin Arabic labels render with their letters
 * disconnected and in reverse order — and Arabic is this app's *primary*
 * locale. A CDN outage would therefore break the default experience, in a way
 * that looks like a font bug rather than a network failure. Tiles we can
 * degrade around (see `tile-error.tsx`); letterforms we cannot.
 *
 * The copy is **committed**, so a fresh clone that runs `next build` directly
 * still has it, and `rtl-plugin.test.ts` asserts the committed bytes still
 * match the installed package — otherwise the vendored copy would silently rot
 * the first time the dependency was bumped.
 *
 * Run with `pnpm vendor:rtl`.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const source = join(
  root,
  "node_modules",
  "@mapbox",
  "mapbox-gl-rtl-text",
  "dist",
  "mapbox-gl-rtl-text.js",
);
const destinationDir = join(root, "public", "vendor");
const destination = join(destinationDir, "mapbox-gl-rtl-text.js");

mkdirSync(destinationDir, { recursive: true });
copyFileSync(source, destination);

console.log(`vendored ${source}\n      -> ${destination}`);
