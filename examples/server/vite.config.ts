import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "src/main.ts",
    outDir: "dist",
    target: "node22",
  },
  resolve: {
    alias: {
      src: fileURLToPath(new URL("./src", import.meta.url)),
      "examples/shared": fileURLToPath(new URL("../shared", import.meta.url)),
    },
  },
});
