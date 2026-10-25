// Performance budget: records a Chrome trace of load, enter, idle frames, dialog taps and the theme toggle on
// a phone profile, and fails if any main-thread task does 20 ms or more of work.
// Compositor commits are reported but not counted: in CI they wait on software WebGL (no GPU),
// which says nothing about the site's own work.
// PERF_CPU_THROTTLE=4 slows the CPU like a mid-range phone (CI runs at 1x).

import { expect, test } from "@playwright/test";

const BUDGET_MS = 20;
const THROTTLE = Number(process.env.PERF_CPU_THROTTLE ?? 1);

test("no main-thread task reaches 20 ms", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });

  // Fixed weather, so the test never depends on the network.
  await page.route("**/api.open-meteo.com/**", (route) =>
    route.fulfill({
      json: { current: { weather_code: 3, temperature_2m: 44, is_day: 0, cloud_cover: 100, wind_direction_10m: 316, wind_speed_10m: 4 } },
    })
  );
  await browser.startTracing(page, {
    categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "blink.user_timing"],
  });
  await page.goto("/");
  await page.getByRole("button", { name: "enter without sound" }).click({ timeout: 30_000 });
  await expect(page.locator(".loading-screen")).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(2000);

  const nav = page.getByRole("navigation", { name: "sections" });
  for (const name of ["work", "about", "say hey"]) {
    await nav.getByRole("button", { name }).tap();
    await page.waitForTimeout(400);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  await page.getByRole("button", { name: "night mode" }).tap();
  await page.waitForTimeout(1500);

  const events = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
  const mainThread = events.find(
    (event) => event.name === "thread_name" && event.args?.name === "CrRendererMain"
  );
  const onMain = events.filter(
    (event) => event.pid === mainThread.pid && event.tid === mainThread.tid && event.ph === "X"
  );
  const commits = onMain.filter((event) => event.name === "Commit");
  const tasks = onMain
    .filter((event) => event.name === "RunTask")
    .map((task) => {
      const commitTime = commits
        .filter((commit) => commit.ts >= task.ts && commit.ts + commit.dur <= task.ts + task.dur)
        .reduce((sum, commit) => sum + commit.dur, 0);
      return { ts: task.ts, dur: task.dur, work: (task.dur - commitTime) / 1000, commit: commitTime / 1000 };
    });
  const durations = tasks.map((task) => task.work).sort((a, b) => b - a);
  const longestCommit = Math.max(0, ...tasks.map((task) => task.commit));
  const frames = events
    .filter((event) => event.pid === mainThread.pid && event.name === "FireAnimationFrame")
    .map((event) => event.dur / 1000)
    .sort((a, b) => a - b);

  console.log(
    `cpu ${THROTTLE}x: ${tasks.length} tasks, longest work ${durations.slice(0, 3).map((d) => d.toFixed(1)).join(", ")} ms; ` +
      `${frames.length} frames, p95 ${frames[Math.floor(frames.length * 0.95)]?.toFixed(2)} ms; ` +
      `longest commit wait ${longestCommit.toFixed(1)} ms`
  );
  // Name what the three longest tasks spent their time on, so a CI failure explains itself.
  for (const task of [...tasks].sort((x, y) => y.work - x.work).slice(0, 3)) {
    const parts = onMain
      .filter((e) => e.ts >= task.ts && e.ts + e.dur <= task.ts + task.dur && e.dur > 1000)
      .filter((e) => e.name !== "RunTask" && e.name !== "Commit")
      .sort((x, y) => y.dur - x.dur)
      .slice(0, 5)
      .map((e) => `${e.name}${e.args?.data?.functionName ? `(${e.args.data.functionName})` : ""} ${(e.dur / 1000).toFixed(1)}`);
    // The last boot mark before the task names the step it belongs to.
    const step = events
      .filter((e) => e.cat?.includes("user_timing") && e.ts <= task.ts + task.dur)
      .reduce((latest, e) => (!latest || e.ts > latest.ts ? e : latest), null);
    console.log(`  ${task.work.toFixed(1)} ms: ${parts.join(", ")}${step ? ` [after mark: ${step.name}]` : ""}`);
  }

  const slow = tasks
    .filter((task) => task.work >= BUDGET_MS)
    .map((task) => `${task.work.toFixed(1)} ms at ${task.ts}`);
  expect(slow).toEqual([]);
  await context.close();
});
