import { defineConfig, devices } from "@playwright/test";

// Isolated frontend contract checks. Every /api request is intercepted by
// the spec, so no emails, registrations or other real mutations are sent.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "public-redesign.spec.js",
  workers: 1,
  timeout: 60000,
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure", serviceWorkers: "block" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: {
    command: "npm run dev:frontend -- --host 127.0.0.1 --open false",
    url: "http://127.0.0.1:5173/app/",
    reuseExistingServer: true,
  },
});
