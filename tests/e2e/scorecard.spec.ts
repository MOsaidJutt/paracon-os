import { test, expect } from "@playwright/test";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
// Exercises Phase 11's critical flow: a Director assesses + locks a key-staff
// worker's monthly scorecard, and a Site Foreman (scorecard.view only) can see
// the same scorecard but cannot edit or lock it.
// Leaves a uniquely-named key-staff worker + a locked current-month StaffScore
// behind each run (by design, same convention as roles-and-permissions.spec.ts)
// rather than mutating the seeded Marcus Webb/Daniel Okafor history.

async function login(page: import("@playwright/test").Page, email: string, password = "Demo1234!") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");
}

test("Director assesses and locks a key-staff worker's monthly scorecard", async ({ page }) => {
  const unique = Date.now();
  const workerName = `Scorecard E2E Worker ${unique}`;

  await login(page, "director@paracon.com.au");

  // Add a key-staff worker so this test doesn't touch the seeded history.
  await page.goto("/labour");
  await page.getByRole("button", { name: "Add worker" }).click();
  await page.getByLabel("Name").fill(workerName);
  await page.getByLabel("Capability").click();
  await page.getByRole("option", { name: "Carpenter", exact: true }).click();
  await page.getByLabel("Employment type").click();
  await page.getByRole("option", { name: "Direct Employee" }).click();
  await page.getByLabel("Key staff").click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Worker added")).toBeVisible();

  // Assess it on the Scorecard.
  await page.goto("/scorecard");
  await page.locator("tr", { hasText: workerName }).click();
  await expect(page.getByRole("heading", { name: workerName })).toBeVisible();

  // Quality (index 0) and Safety (index 3) are MANUAL; Reliability/Productivity are AUTO and disabled.
  const sliders = page.getByRole("slider");
  await sliders.nth(0).press("End");
  await sliders.nth(3).press("End");

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Score saved")).toBeVisible();

  const sheet = page.getByRole("dialog");
  await page.getByRole("button", { name: "Lock month" }).click();
  await expect(page.getByText("Month locked")).toBeVisible();
  await expect(sheet.getByText("Locked")).toBeVisible();

  // Locked sliders become read-only and the editing controls swap for an Unlock action.
  await expect(sliders.nth(0)).toHaveAttribute("data-disabled", "");
  await expect(page.getByRole("button", { name: "Unlock to edit" })).toBeVisible();
});

test("a Site Foreman can view but not edit the Staff Scorecard", async ({ page }) => {
  await login(page, "foreman@paracon.com.au");

  await page.goto("/scorecard");
  await expect(page.getByRole("heading", { name: "Staff Scorecard" })).toBeVisible();

  // Marcus Webb is seeded as key staff with an existing (unlocked) current-month score.
  await page.locator("tr", { hasText: "Marcus Webb" }).click();
  await expect(page.getByRole("heading", { name: "Marcus Webb" })).toBeVisible();

  // No assess permission -> no Save/Lock controls, and every slider is read-only.
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Lock month" })).toHaveCount(0);
  await expect(page.getByRole("slider").first()).toHaveAttribute("data-disabled", "");
});
