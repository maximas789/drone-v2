import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Only the domain core is unit-tested — geometry, slots, codec, workflow.
 * No component tests: a `node` environment, deliberately.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    /**
     * **20 s, not vitest's default 5.**
     *
     * Several tests in this suite are deliberately expensive, and they get more
     * so every wave: three of them **scan every source file under `src/`** —
     * F15's single-renderer check, F17's ID-exposure scan and F18's
     * notification-type scan — one cross-checks Riyadh civil time against
     * `Intl` on all 365 days of a year, and one generates 100 000 Remote ID
     * codes. On a cold Windows filesystem they sit near 5 s, and which of them
     * tips over varies run to run: F18b saw three different tests time out
     * across three consecutive runs of an otherwise unchanged tree.
     *
     * A timeout is not a finding. A suite whose pass/fail depends on machine
     * load teaches everybody to re-run it until it goes green, which is exactly
     * how a real failure gets waved through. The budget is set once, here,
     * rather than being raised per test as each one flakes.
     */
    testTimeout: 20_000,
  },
});
