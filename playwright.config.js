// Playwright setup: builds and serves the site locally, or tests BASE_URL when it is set
// (for example a Vercel preview URL).

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://localhost:4173";

export default defineConfig({
  testDir: "tests",
  testMatch: "*.spec.js",
  // CI renders WebGL in software, so the smoke test alone takes 50 to 60 s there.
  timeout: 120_000,
  // One worker: the perf test measures main-thread time and must not share the CPU.
  workers: 1,
  // CI runners render WebGL in software and are noisy; a real regression still fails twice.
  retries: process.env.CI ? 1 : 0,
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
