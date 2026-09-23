import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["ledger.spec.ts"],
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
  webServer: {
    command:
      "pnpm --filter example-react build && pnpm --filter example-react exec vite preview --host 127.0.0.1 --port 4390 --strictPort",
    cwd: "..",
    url: "http://127.0.0.1:4390",
    reuseExistingServer: process.env.CI === undefined,
    timeout: 120_000,
  },
});
