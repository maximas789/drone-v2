import { getRTLTextPluginStatus, setRTLTextPlugin } from "maplibre-gl";
import { RTL_PLUGIN_URL } from "./config";
import { setMapWorkerUrl } from "./worker-url";

/**
 * `setRTLTextPlugin`, called **exactly once per document**.
 *
 * Two failure modes this exists to prevent, and they pull in opposite
 * directions:
 *
 * 1. **Never called** — Arabic labels render with their letters disconnected
 *    and the word order reversed. Not a subtle degradation, and invisible to
 *    anyone reviewing the English build.
 * 2. **Called twice** — MapLibre throws. Which happens the moment a reader
 *    navigates from one map page to another and a second component mounts, so
 *    it is not a hypothetical: it is the default behaviour of a client-side
 *    route change without a guard.
 *
 * The module-level promise is the guard. Every caller awaits the same one, so
 * concurrent mounts on the same tick cannot race past it either — a plain
 * boolean set *after* the async call would let two mounts through.
 *
 * `lazy: false` because Arabic is the default locale: deferring the download
 * until the first RTL label is encountered would mean the first paint of the
 * primary experience is the broken one.
 *
 * **Named imports, not a default.** maplibre-gl v6 has no default export;
 * `import maplibregl from "maplibre-gl"` type-errors rather than failing at
 * runtime, which is the good version of that mistake.
 */
/**
 * The plugin is a ~130 kB same-origin file; anything past this is a failure,
 * not slowness.
 */
const PLUGIN_TIMEOUT_MS = 5000;

let pending: Promise<void> | null = null;

export function ensureRtlTextPlugin(): Promise<void> {
  /**
   * **First, and before the guard below.** Registering the plugin is a message
   * to MapLibre's worker, so this call is what brings the worker pool into
   * existence — and the pool is built once, from whatever worker URL is set at
   * that moment. Set it afterwards and it is ignored; set it never and the pool
   * is built from a 404 and silently answers nothing. This runs on every call
   * because it is an idempotent string assignment, and because a caller that
   * hits the short-circuit still needs the URL to have been pinned.
   */
  setMapWorkerUrl();

  if (pending) return pending;

  /**
   * MapLibre tracks this globally too, and its status survives a module reload
   * that our own `pending` would not — Fast Refresh in development being the
   * obvious case. Re-registering after that is the throw, so defer to
   * MapLibre's own answer before deciding this document has never called it.
   */
  if (getRTLTextPluginStatus() !== "unavailable") {
    pending = Promise.resolve();
    return pending;
  }

  /**
   * **Absolute, because the worker resolves it, not the page.**
   *
   * MapLibre loads this inside its web worker with `importScripts`, and that
   * worker is created from a blob URL — so a root-relative `/vendor/…`
   * resolves against the blob origin and fetches nothing. The symptom is not an
   * error: the promise simply never settles, which (before the timeout below)
   * meant no map was constructed at all.
   */
  const absoluteUrl = new URL(RTL_PLUGIN_URL, window.location.origin).toString();

  const load = setRTLTextPlugin(absoluteUrl, false).catch((error: unknown) => {
    /**
     * A failed load must not take the map down with it. The labels will be
     * wrong — badly wrong, in Arabic — but a map with mangled place names is
     * still a map showing where the zones are, and that is the question this
     * screen exists to answer. Clearing the guard lets a later mount retry.
     */
    pending = null;
    console.error("[map] RTL text plugin failed to load", error);
  });

  /**
   * **The map is the product; the plugin is an enhancement.** Every caller
   * awaits this before constructing a map, so a promise that never settles
   * costs the reader the entire screen rather than just its letterforms — which
   * is precisely what the worker-URL bug above did. Racing a timeout means the
   * worst case is degraded Arabic labels on a working map.
   */
  const settled = Promise.race([
    load,
    new Promise<void>((resolve) => {
      setTimeout(() => {
        if (getRTLTextPluginStatus() === "unavailable") {
          console.error("[map] RTL text plugin timed out; labels may be wrong");
        }
        resolve();
      }, PLUGIN_TIMEOUT_MS);
    }),
  ]);

  pending = settled;
  return settled;
}

/** Test seam. Never call this in application code. */
export function resetRtlTextPluginForTests(): void {
  pending = null;
}
