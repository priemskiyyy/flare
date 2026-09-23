import { defineConfig, devices } from "@playwright/test";

// `pnpm lint:typescript` typechecks the examples, so here they are only built.
const preview = (name: string, port: number) => ({
  command: `pnpm --filter example-${name} exec vite build && pnpm --filter example-${name} exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
  cwd: "..",
  url: `http://127.0.0.1:${port}`,
  reuseExistingServer: process.env.CI === undefined,
  timeout: 120_000,
});

export default defineConfig({
  testDir: ".",
  testMatch: ["ledger.spec.ts", "frameworks.spec.ts"],
  outputDir: "../.artifacts/example-results",
  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env.CI !== undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4390",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium" }],
  webServer: [
    preview("react", 4390),
    preview("vue", 4391),
    preview("solid", 4392),
    preview("svelte", 4393),
  ],
});
