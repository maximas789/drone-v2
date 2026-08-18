import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RTL_PLUGIN_URL } from "./config";

/**
 * The vendored RTL text plugin must match the installed package.
 *
 * `public/vendor/mapbox-gl-rtl-text.js` is a copy, committed so that a fresh
 * clone running `next build` has it without a postinstall step. A copy is a
 * thing that rots: bump the dependency and the committed bytes silently stay on
 * the old build, and the failure would show up as *Arabic labels rendering
 * subtly wrong* — which nobody reviewing an English diff would ever catch.
 *
 * So the check is mechanical. Re-run `pnpm vendor:rtl` when this fails.
 */

const root = fileURLToPath(new URL("../../..", import.meta.url));

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("vendored RTL text plugin", () => {
  it("is byte-identical to the installed package", () => {
    const installed = sha256(
      `${root}node_modules/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js`,
    );
    const vendored = sha256(`${root}public/vendor/mapbox-gl-rtl-text.js`);

    expect(
      vendored,
      "public/vendor is stale — run `pnpm vendor:rtl`",
    ).toBe(installed);
  });

  /**
   * **Same origin, not a CDN.** Arabic is this app's primary locale, and
   * without the plugin its labels render with the letters disconnected and the
   * word order reversed. A third-party outage must not be able to do that.
   */
  it("is served from our own origin", () => {
    expect(RTL_PLUGIN_URL.startsWith("/")).toBe(true);
    expect(RTL_PLUGIN_URL).not.toMatch(/^https?:/);
  });

  it("points at a file that exists", () => {
    expect(() =>
      readFileSync(`${root}public${RTL_PLUGIN_URL}`),
    ).not.toThrow();
  });

  /**
   * **The plugin must call MapLibre back**, and it does so *asynchronously*:
   * MapLibre's worker defines a global `registerRTLTextPlugin`, the downloaded
   * bundle instantiates WebAssembly, and only then invokes the callback. That
   * delay cost real time here — a first probe checked for registration
   * synchronously after `importScripts`, saw `false`, and produced a confident
   * and wrong diagnosis that the current release was incompatible. It is not;
   * given ~1.5 s both the current and previous release lines register fine.
   *
   * So this is only a source-level smoke check — the real behaviour needs a
   * browser worker and this suite is `node`. It catches a bundle that has
   * dropped the callback entirely, and nothing subtler.
   */
  it("still references the registration callback MapLibre waits for", () => {
    const source = readFileSync(`${root}public${RTL_PLUGIN_URL}`, "utf8");
    expect(source.includes("registerRTLTextPlugin")).toBe(true);
  });

});
