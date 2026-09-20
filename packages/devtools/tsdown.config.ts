import { defineConfig } from "tsdown";
import type { UserConfig } from "tsdown";

// Vite builds the core bundle first; tsdown adds its declarations and builds the wrappers.
const wrapper: UserConfig = {
  format: ["esm"],
  target: "es2022",
  platform: "neutral",
  dts: true,
  clean: false,
  sourcemap: true,
  // A wrapper imports the inspector by its package name, so every entry
  // shares one class instead of each bundling a copy.
  deps: { neverBundle: ["@priemskiyyy/flare-devtools"] },
};

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    platform: "neutral",
    dts: { emitDtsOnly: true },
    clean: false,
  },
  // A top-level `banner` reaches the declarations too, where a directive is
  // TS1036 for every consumer without skipLibCheck.
  {
    ...wrapper,
    entry: { react: "src/react.ts" },
    outputOptions: { banner: '"use client";' },
  },
  {
    ...wrapper,
    entry: {
      vue: "src/vue.ts",
      solid: "src/solid.ts",
      svelte: "src/svelte.ts",
    },
  },
]);
