import { defineConfig, devices } from "@playwright/test";

const backendPort = 3201;
const webPort = 3200;
const useProductionWeb = process.env.CI === "true" || process.env.E2E_PRODUCTION === "true";
const crossBrowser = process.env.E2E_CROSS_BROWSER === "true";
const reuseExistingServer = !process.env.CI && process.env.E2E_REUSE_SERVER !== "false";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm --dir apps/backend exec tsx e2e/fixture-backend.ts",
      url: `http://127.0.0.1:${backendPort}/api/v1/health/live`,
      reuseExistingServer,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: useProductionWeb
        ? `pnpm --filter @clm/web build && pnpm --filter @clm/web exec next start --port ${webPort}`
        : `pnpm --filter @clm/web exec next dev --port ${webPort}`,
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer,
      timeout: useProductionWeb ? 300_000 : 120_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        BACKEND_URL: `http://127.0.0.1:${backendPort}`,
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
    ...(crossBrowser
      ? [
          {
            name: "firefox",
            testIgnore: /mobile\.spec\.ts/,
            use: { ...devices["Desktop Firefox"] },
          },
          {
            name: "webkit",
            testIgnore: /mobile\.spec\.ts/,
            use: { ...devices["Desktop Safari"] },
          },
        ]
      : []),
  ],
});
