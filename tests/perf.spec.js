// Performance budget: records a Chrome trace of load, enter, idle frames, the nav opening, dialogs, the
// scroll tour and the theme toggle on a phone profile, and fails if any main-thread task does 20 ms or
// more of work.
// Compositor commits and blocking waits on the GPU process are reported but not counted: in CI they
// wait on software WebGL (no GPU), which says nothing about the site's own work.
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
    categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "blink.user_timing", "gpu"],
  });
  await page.goto("/");
  await page.getByRole("button", { name: "enter without sound" }).click({ timeout: 30_000 });
  await expect(page.locator(".loading-screen")).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(2000);

  // A tap on the folded nav plays the "dynamic island" open animation.
  const navDock = page.locator(".dock-nav");
  await expect(navDock).toHaveClass(/is-collapsed/, { timeout: 8_000 });
  await navDock.locator(".island").tap();
  await page.waitForTimeout(800);

  // Clicks go straight to the buttons: the nav folds again while a dialog is open.
  const nav = page.getByRole("navigation", { name: "sections" });
  for (const name of ["work", "about", "say hey"]) {
    await nav.getByRole("button", { name }).dispatchEvent("click");
    await page.waitForTimeout(400);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  // The scroll tour: the camera flies to every stop and back to the first.
  for (const stop of [1, 2, 3, 4, 5, 0]) {
    await page.evaluate((stop) => window.scrollTo({ top: stop * window.innerHeight, behavior: "instant" }), stop);
    await page.waitForTimeout(700);
  }
  await page.getByRole("button", { name: "night mode" }).dispatchEvent("click");
  await page.waitForTimeout(1500);

  const events = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
  const mainThread = events.find(
    (event) => event.name === "thread_name" && event.args?.name === "CrRendererMain"
  );
  const onMain = events.filter(
    (event) => event.pid === mainThread.pid && event.tid === mainThread.tid && event.ph === "X"
  );
  const commits = onMain.filter((event) => event.name === "Commit");
  const inside = (event, outer) => event.ts >= outer.ts && event.ts + event.dur <= outer.ts + outer.dur;
  // Creating the WebGL context and every synchronous GL call (a query, a finish) block here
  // until the GPU process answers; with software GL that can take hundreds of milliseconds.
  const gpuWaitNames = ["CommandBufferProxyImpl::Initialize", "CommandBufferProxyImpl::WaitForGetOffset"];
  const gpuWaits = onMain.filter(
    (event) => gpuWaitNames.includes(event.name) && !commits.some((commit) => inside(event, commit))
  );
  const tasks = onMain
    .filter((event) => event.name === "RunTask")
    .map((task) => {
      const total = (list) => list.filter((event) => inside(event, task)).reduce((sum, event) => sum + event.dur, 0);
      const commitTime = total(commits);
      const gpuTime = total(gpuWaits);
      return { ts: task.ts, dur: task.dur, work: (task.dur - commitTime - gpuTime) / 1000, commit: commitTime / 1000, gpu: gpuTime / 1000 };
    });
  const durations = tasks.map((task) => task.work).sort((a, b) => b - a);
  const longestCommit = Math.max(0, ...tasks.map((task) => task.commit));
  const longestGpuWait = Math.max(0, ...tasks.map((task) => task.gpu));
  const frames = events
    .filter((event) => event.pid === mainThread.pid && event.name === "FireAnimationFrame")
    .map((event) => event.dur / 1000)
    .sort((a, b) => a - b);

  console.log(
    `cpu ${THROTTLE}x: ${tasks.length} tasks, longest work ${durations.slice(0, 3).map((d) => d.toFixed(1)).join(", ")} ms; ` +
      `${frames.length} frames, p95 ${frames[Math.floor(frames.length * 0.95)]?.toFixed(2)} ms; ` +
      `longest commit wait ${longestCommit.toFixed(1)} ms, longest GPU wait ${longestGpuWait.toFixed(1)} ms`
  );
  // Name what the three longest tasks spent their time on, so a CI failure explains itself.
  for (const task of [...tasks].sort((x, y) => y.work - x.work).slice(0, 3)) {
    const parts = onMain
      .filter((e) => e.ts >= task.ts && e.ts + e.dur <= task.ts + task.dur && e.dur > 1000)
      .filter((e) => e.name !== "RunTask" && e.name !== "Commit" && !e.cat?.includes("gpu"))
      .sort((x, y) => y.dur - x.dur)
      .slice(0, 5)
      .map((e) => `${e.name}${e.args?.data?.functionName ? `(${e.args.data.functionName})` : ""} ${(e.dur / 1000).toFixed(1)}`);
    // The last boot mark before the task names the step it belongs to.
    const step = events
      .filter((e) => e.cat?.includes("user_timing") && e.ts <= task.ts)
      .reduce((latest, e) => (!latest || e.ts > latest.ts ? e : latest), null);
    console.log(`  ${task.work.toFixed(1)} ms: ${parts.join(", ")}${step ? ` [step: ${step.name}]` : ""}`);
  }

  const slow = tasks
    .filter((task) => task.work >= BUDGET_MS)
    .map((task) => `${task.work.toFixed(1)} ms at ${task.ts}`);
  expect(slow).toEqual([]);
  await context.close();
});
