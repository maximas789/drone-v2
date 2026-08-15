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
  },
});
