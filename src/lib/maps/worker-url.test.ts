import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAP_WORKER_URL } from "./config";

/**
 * The vendored MapLibre worker must match the installed package, and must be
 * able to find its own dependency.
 *
 * **This is the guard on open thread 53.** `maplibre-gl.mjs` locates its worker
 * from `import.meta.url`; bundled, that resolves to a path under
 * `/_next/static/chunks/` where no worker exists, and MapLibre does not listen
 * for `error` on the `Worker` it just constructed — so the failure is *silent*
 * and total. A blank map with a healthy basemap behind it and a clean console.
 *
 * Nothing else in the build can see that: `typecheck`, `lint` and `build` all
 * pass with a dead worker, and so does every test that does not open a browser.
 * These checks cover the part that *is* mechanically checkable — that the copy
 * exists, is current, and still carries the relative import it needs.
 *
 * Re-run `pnpm vendor:map` when the first one fails.
 */

const root = fileURLToPath(new URL("../../..", import.meta.url));
const vendored = `${root}public${MAP_WORKER_URL}`;

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("vendored MapLibre worker", () => {
  it("is byte-identical to the installed package", () => {
    expect(
      sha256(vendored),
      "public/vendor/maplibre is stale — run `pnpm vendor:map`",
    ).toBe(sha256(`${root}node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs`));
  });

  /**
   * The worker is a *module* worker whose first line is
   * `import … from "./maplibre-gl-shared.mjs"`. Vendoring it without its
   * neighbour produces exactly the same silent hang one directory further
   * along, so the pair is asserted together rather than separately.
   */
  it("ships beside the shared module it imports", () => {
    const source = readFileSync(vendored, "utf8");
    expect(source).toContain('from"./maplibre-gl-shared.mjs"');

    const sibling = `${dirname(vendored)}/maplibre-gl-shared.mjs`;
    expect(
      sha256(sibling),
      "public/vendor/maplibre is stale — run `pnpm vendor:map`",
    ).toBe(sha256(`${root}node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs`));
  });

  /**
   * **Not the `-dev` build.** `package.json` exports only `dist/maplibre-gl.mjs`,
   * so the main thread always runs the production build; pairing it with a
   * `-dev` worker would ship a megabyte of unminified code to every reader for
   * no benefit. Named explicitly because the two filenames differ by four
   * characters.
   */
  it("is served from our own origin, and is the production build", () => {
    expect(MAP_WORKER_URL.startsWith("/")).toBe(true);
    expect(MAP_WORKER_URL).not.toMatch(/^https?:/);
    expect(MAP_WORKER_URL).not.toMatch(/-dev\.mjs$/);
  });
});
