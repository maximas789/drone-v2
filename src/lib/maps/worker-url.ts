import { setWorkerUrl } from "maplibre-gl";
import { MAP_WORKER_URL } from "./config";

/**
 * Points MapLibre at the worker **we** serve, instead of the one it tries to
 * find next to itself.
 *
 * This has to happen before the worker pool is created — which is before the
 * first `Map`, and before `setRTLTextPlugin`, because registering the plugin is
 * itself a message to the worker. Getting the order wrong is not an error you
 * can see: the pool is built once from whatever URL was set at the time, and a
 * pool built from a 404 answers nothing, for ever. See `MAP_WORKER_URL` for
 * what that looks like from the outside — a blank map with no error on it.
 *
 * **Absolute, deliberately.** `setWorkerUrl` stores the string as given, and it
 * is resolved later against whatever base the resolving context has. Pinning it
 * to the page's origin here means it cannot be re-based by a `<base>` element
 * or by MapLibre's blob-worker path, which is the same trap the RTL plugin URL
 * fell into.
 *
 * Idempotent, and cheap: it assigns a string on MapLibre's own config object.
 * There is no undo, and none is needed — the URL never varies.
 */
export function setMapWorkerUrl(): void {
  setWorkerUrl(new URL(MAP_WORKER_URL, window.location.origin).toString());
}
