// End-to-end smoke test: the island loads, the nav folds and opens on hover, every section
// opens from the nav, Escape closes it, scrolling reaches the stick figure whose marker opens
// "about", and the page has no script errors, console errors or failed requests.

import { expect, test } from "@playwright/test";

test("island loads and every section opens from the nav", async ({ page }) => {
  const problems = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    problems.push(`failed: ${request.url()} ${request.failure()?.errorText}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      problems.push(`${response.status()} ${response.url()}`);
    }
  });

  // Fixed weather, so the test never depends on the network.
  await page.route("**/api.open-meteo.com/**", (route) =>
    route.fulfill({
      json: { current: { weather_code: 3, temperature_2m: 44, is_day: 0, cloud_cover: 100, wind_direction_10m: 316, wind_speed_10m: 4 } },
    })
  );
  const started = Date.now();
  await page.goto("/");
  await expect(page.getByText("hey, give the city a second")).toBeVisible();

  const enter = page.getByRole("button", { name: "enter", exact: true });
  await expect(enter).toBeEnabled({ timeout: 15_000 });
  console.log(`time until enter: ${Date.now() - started} ms`);

  await page.getByRole("button", { name: "enter without sound" }).click();
  await expect(page.locator(".loading-screen")).toHaveCount(0, {
    timeout: 10_000,
  });

  const nav = page.getByRole("navigation", { name: "sections" });

  // The nav and the hero card fold into capsules after five seconds; hover opens them again.
  const navDock = page.locator(".dock-nav");
  await expect(navDock).toHaveClass(/is-collapsed/, { timeout: 8_000 });
  await expect(page.locator(".dock-hero")).toHaveClass(/is-collapsed/);
  await nav.hover();
  await expect(navDock).not.toHaveClass(/is-collapsed/);

  await nav.getByRole("button", { name: "work" }).click();
  const work = page.getByRole("dialog", { name: "work" });
  await expect(work).toContainText("agent-canvas");
  await page.keyboard.press("Escape");
  // Focus is back on the nav button; Enter reopens during the close animation and must stay open.
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  await expect(work).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(work).toBeHidden();

  await nav.getByRole("button", { name: "about" }).click();
  const about = page.getByRole("dialog", { name: "about" });
  await expect(about).toContainText("building @ lora");
  await about.getByRole("button", { name: "close" }).click();
  await expect(about).toBeHidden();

  // The pointer left for the close button, so the nav folded again: hover it open, as a visitor would.
  await nav.hover();
  await nav.getByRole("button", { name: "say hey" }).click();
  const contact = page.getByRole("dialog", { name: "say hey" });
  await expect(
    contact.getByRole("link", { name: /sigdelanubhav@gmail\.com/ })
  ).toHaveAttribute("href", "mailto:sigdelanubhav@gmail.com");
  await page.keyboard.press("Escape");
  await expect(contact).toBeHidden();

  // Scroll tour: one screen of scroll reaches the stick figure, and its marker opens "about".
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight, behavior: "instant" }));
  await expect(page.locator(".tour-rail-label")).toHaveText("that's me");
  const aboutMarker = page.getByRole("button", { name: "about me" });
  await expect(aboutMarker).toBeVisible();
  await aboutMarker.click();
  await expect(about).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(about).toBeHidden();

  expect(problems).toEqual([]);
});
