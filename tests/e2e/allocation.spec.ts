import { test, expect } from "@playwright/test";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
// Uses the PM account, which holds allocation.edit per lib/seed-data.ts.
test("PM can open the Resource Planner, see required vs allocated, and add/block workers", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("pm@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  await page.goto("/allocation");
  await expect(page.getByRole("heading", { name: "Resource Planner" })).toBeVisible();

  // Switch to the Beacon Cove project — its Plumber trade is deliberately
  // left unstaffed because the only Plumber's compliance has expired. The
  // project switcher is identified by its own aria-label since the worker
  // pool's trade filter is also a combobox on this page, and other e2e specs
  // may have left additional projects in the shared dev database.
  const projectSwitcher = page.getByRole("combobox", { name: "Project" });
  await projectSwitcher.click();
  await page.getByRole("option", { name: /Beacon Cove Office Upgrade/ }).click();

  // Each trade now renders as two rows: a summary row (trade name + block
  // badges) and a weeks row (the actual per-week cells) right below it.
  const plumberSummaryRow = page.getByRole("row", { name: /^Plumber/ });
  await expect(plumberSummaryRow).toBeVisible();
  const plumberWeeksRow = plumberSummaryRow.locator("xpath=following-sibling::tr[1]");

  // Attempting to add the only Plumber shows the compliance block up front —
  // the candidate is listed but disabled, never silently allocatable.
  await plumberWeeksRow.getByRole("button", { name: /Add Plumber/ }).first().click();
  const sioneOption = page.getByRole("option", { name: /Sione Taufa/ });
  await expect(sioneOption).toBeVisible();
  await expect(sioneOption).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText("Compliance expired")).toBeVisible();
  await page.keyboard.press("Escape");

  // Adding the available Painter for an unallocated week succeeds. Owen's
  // seeded allocations are several weeks out, so the nearest week column
  // (index 0 of the weeks row) is guaranteed free.
  const painterSummaryRow = page.getByRole("row", { name: /^Painter/ });
  const painterWeeksRow = painterSummaryRow.locator("xpath=following-sibling::tr[1]");
  const nearestWeekCell = painterWeeksRow.locator("td").nth(0);
  await nearestWeekCell.getByRole("button", { name: /Add Painter/ }).click();
  await page.getByRole("option", { name: /Owen Fitzgerald/ }).click();
  await expect(nearestWeekCell.getByText("Owen Fitzgerald")).toBeVisible();

  // Remove it again so this spec is safe to re-run without reseeding.
  await nearestWeekCell.getByRole("button", { name: /Remove Owen Fitzgerald/ }).click();
  await expect(nearestWeekCell.getByText("Owen Fitzgerald")).toHaveCount(0);
});

test("a worker's profile shows their current and upcoming allocations", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("pm@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  await page.goto("/labour");
  await page.getByPlaceholder("Search worker name...").fill("Jacob Ferreira");
  await page.getByText("Jacob Ferreira").click();
  await page.waitForURL(/\/labour\/.+/);

  await page.getByRole("tab", { name: "Allocation" }).click();
  await expect(page.getByText("Riverside Quarter Fitout").first()).toBeVisible();
  await expect(page.getByText("Beacon Cove Office Upgrade").first()).toBeVisible();
});
