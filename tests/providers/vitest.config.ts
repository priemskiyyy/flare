import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      src: fileURLToPath(new URL("./src", import.meta.url)),
      // The adapter supports Bugsnag's browser notifier; Node would load the
      // Node one.
      "@bugsnag/js": "@bugsnag/js/browser/notifier.js",
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    globals: false,
    environment: "node",
    testTimeout: 10_000,
    hookTimeout: 10_000,
    expect: { poll: { timeout: 5_000, interval: 10 } },
  },
});
