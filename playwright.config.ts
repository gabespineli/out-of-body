import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: { baseURL: "http://127.0.0.1:3201", browserName: "chromium", viewport: { width: 1440, height: 1100 }, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: "node scripts/serve-static.mjs", url: "http://127.0.0.1:3201", reuseExistingServer: true, timeout: 60000 },
});
