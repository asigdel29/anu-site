// End-to-end smoke test: the island loads, every section opens from the nav,
// Escape closes it, and the page has no script errors, console errors or failed requests.

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

  const started = Date.now();
  await page.goto("/");
  await expect(page.getByText("hey, give the petals a second")).toBeVisible();

  const enter = page.getByRole("button", { name: "enter", exact: true });
  await expect(enter).toBeEnabled({ timeout: 15_000 });
  console.log(`time until enter: ${Date.now() - started} ms`);

  await page.getByRole("button", { name: "enter without sound" }).click();
  await expect(page.locator(".loading-screen")).toHaveCount(0, {
    timeout: 10_000,
  });

  const nav = page.getByRole("navigation", { name: "sections" });

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

  await nav.getByRole("button", { name: "contact" }).click();
  const contact = page.getByRole("dialog", { name: "say hey" });
  await expect(
    contact.getByRole("link", { name: /sigdelanubhav@gmail\.com/ })
  ).toHaveAttribute("href", "mailto:sigdelanubhav@gmail.com");
  await page.keyboard.press("Escape");
  await expect(contact).toBeHidden();

  expect(problems).toEqual([]);
});
