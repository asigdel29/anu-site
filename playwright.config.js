// Playwright setup: builds and serves the site locally, or tests BASE_URL when it is set
// (for example a Vercel preview URL).

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://localhost:4173";

export default defineConfig({
  testDir: "tests",
  testMatch: "*.spec.js",
  timeout: 60_000,
  // One worker: the perf test measures main-thread time and must not share the CPU.
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { ...devices["Desktop Chrome"], baseURL },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        // CI builds in its own step, so only serve there.
        command: `${process.env.CI ? "" : "npm run build && "}npx vite preview --port 4173 --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
      },
});
