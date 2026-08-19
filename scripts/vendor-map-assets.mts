/**
 * Copies the map's worker-loaded assets out of `node_modules` and into
 * `public/`, because **neither of them can go through the bundler.**
 *
 * Two files, one reason. MapLibre runs its parsing off the main thread, and the
 * worker is created from a URL, not from an import — so anything the worker
 * needs has to exist as a real HTTP path on our own origin.
 *
 * **1 — MapLibre's own worker.** `maplibre-gl.mjs` derives its worker URL from
 * `import.meta.url`, expecting `maplibre-gl-worker.mjs` to sit beside it. After
 * bundling it does not: the module becomes a hashed chunk, so the computed URL
 * is `/_next/static/chunks/maplibre-gl-worker.mjs`, which 404s. MapLibre
 * attaches no error handler to the `Worker` it just constructed, so nothing is
 * thrown and nothing is logged — **every request to the worker simply never
 * answers.** The GeoJSON source stays mid-update forever, `style.loaded()` is
 * therefore false forever, MapLibre never completes a render pass, and the
 * screen stays blank with a perfectly healthy basemap behind it. That was open
 * thread 53, and it cost a session. `setWorkerUrl` points at the copy made
 * here, which takes the bundler out of the path entirely. The worker imports
 * `./maplibre-gl-shared.mjs` relatively, so **both files travel together and
 * must stay in the same directory.**
 *
 * **2 — The Mapbox RTL text plugin.** MapLibre's worker fetches this with
 * `importScripts`, so it likewise has to be a real URL rather than a bundled
 * import. MapLibre's own documentation loads it from unpkg; without it Arabic
 * labels render with their letters disconnected and in reverse order, and
 * Arabic is this app's *primary* locale — a CDN outage would break the default
 * experience in a way that looks like a font bug rather than a network failure.
 * Tiles we can degrade around (`FALLBACK_STYLE`); letterforms we cannot.
 *
 * The copies are **committed**, so a fresh clone that runs `next build`
 * directly still has them, and the tests beside `src/lib/maps/` assert the
 * committed bytes still match the installed packages — otherwise a vendored
 * copy would silently rot the first time its dependency was bumped, and the
 * failure mode of a stale *worker* is a blank map.
 *
 * Run with `pnpm vendor:map`.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const modules = join(root, "node_modules");
const vendor = join(root, "public", "vendor");

/**
 * Source → destination.
 *
 * **Deliberately not exported.** The test that guards these copies restates the
 * paths instead of importing them: this module copies at import time, so a test
 * that imported it would repair the staleness it exists to detect and then pass.
 */
const assets: readonly { from: string; to: string }[] = [
  {
    from: join(modules, "@mapbox", "mapbox-gl-rtl-text", "dist", "mapbox-gl-rtl-text.js"),
    to: join(vendor, "mapbox-gl-rtl-text.js"),
  },
  {
    from: join(modules, "maplibre-gl", "dist", "maplibre-gl-worker.mjs"),
    to: join(vendor, "maplibre", "maplibre-gl-worker.mjs"),
  },
  /**
   * Not optional and not an optimisation: `maplibre-gl-worker.mjs` opens with
   * `import … from "./maplibre-gl-shared.mjs"`. Vendoring the worker alone
   * gives a module worker that fails to resolve its own dependency — the same
   * silent hang, one directory further along.
   */
  {
    from: join(modules, "maplibre-gl", "dist", "maplibre-gl-shared.mjs"),
    to: join(vendor, "maplibre", "maplibre-gl-shared.mjs"),
  },
];

for (const { from, to } of assets) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`vendored ${from}\n      -> ${to}`);
}
