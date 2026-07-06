import { test, expect } from "@playwright/test";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
// Covers the "per-page flexibility" ask: a register table's column show/hide
// choice persists across reload (the same DashboardLayout round-trip the
// dashboard customizer uses), not just client-side state. Restores the
// Outcome column to visible at the end so it doesn't affect other tests
// sharing the director@paracon.com.au account.
test("hiding a column on the tender register persists across reload, and can be shown again", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/login");
  await page.getByLabel("Email").fill("director@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  await page.goto("/tenders");
  await expect(page.getByRole("columnheader", { name: "Outcome" })).toBeVisible({ timeout: 20_000 });

  // Hide the Outcome column via the Columns menu.
  await page.getByRole("button", { name: "Columns" }).click();
  await page.getByRole("switch", { name: "Show Outcome column" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("columnheader", { name: "Outcome" })).toHaveCount(0, { timeout: 15_000 });

  // The hide persisted server-side — a fresh page load doesn't render it.
  await page.reload();
  await expect(page.getByRole("columnheader", { name: "Project" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("columnheader", { name: "Outcome" })).toHaveCount(0);

  // Restore it so re-runs and other specs see the default column set.
  await page.getByRole("button", { name: "Columns" }).click();
  await page.getByRole("switch", { name: "Show Outcome column" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("columnheader", { name: "Outcome" })).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(page.getByRole("columnheader", { name: "Outcome" })).toBeVisible({ timeout: 20_000 });
});
