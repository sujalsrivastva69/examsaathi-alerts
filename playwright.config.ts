import { defineConfig, devices } from "@playwright/test";

const remoteBaseUrl = process.env.E2E_BASE_URL;
if (
  remoteBaseUrl &&
  !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(remoteBaseUrl) &&
  process.env.E2E_ALLOW_REMOTE !== "true"
) {
  throw new Error("Set E2E_ALLOW_REMOTE=true only when targeting a disposable staging project.");
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: remoteBaseUrl ?? "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: remoteBaseUrl
    ? undefined
    : {
        command: "npm run dev:client -- --host 127.0.0.1",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
