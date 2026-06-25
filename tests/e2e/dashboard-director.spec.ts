import { test, expect } from "@playwright/test";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
// The Director dashboard composes several queries server-side (project health,
// milestones, the forecast engine, tender pipeline, alerts) into one response —
// generous timeouts on the first assertions below account for that, not flakiness.
test("director sees the Command Centre with health, critical dates, capacity, pipeline and alerts", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/login");
  await page.getByLabel("Email").fill("director@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  await expect(page.getByRole("heading", { name: "Command Centre" })).toBeVisible();
  await expect(page.getByText("At-risk projects")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Critical dates — next 30 days")).toBeVisible();
  await expect(page.getByText("Pipeline snapshot")).toBeVisible();
  await expect(page.getByText("Can we take on more work?")).toBeVisible();
  await expect(page.getByText("Alerts").first()).toBeVisible();

  // Seeded demo projects are visible with a health badge each (a Critical
  // project's name appears in both the health list and the at-risk panel).
  await expect(page.getByText("Riverside Quarter Fitout").first()).toBeVisible();
  await expect(page.getByText("Beacon Cove Office Upgrade").first()).toBeVisible();

  // The staff scorecard gauge panel renders below the dashboard cards
  // (CardTitle is a styled div, not a semantic heading, hence getByText).
  await expect(page.getByText("Staff Scorecard")).toBeVisible({ timeout: 15_000 });

  // The project filter narrows the dashboard down to a single project.
  const projectFilter = page.getByRole("combobox", { name: "Project" });
  await projectFilter.click();
  await page.getByRole("option", { name: /Riverside Quarter Fitout/ }).click();
  await expect(page.getByText("Beacon Cove Office Upgrade")).not.toBeVisible({ timeout: 15_000 });
});
