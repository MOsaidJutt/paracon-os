import { test, expect } from "@playwright/test";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
// Both seeded demo projects are assigned to pm@paracon.com.au (see prisma/seed.ts).
// The PM dashboard composes several queries server-side — a generous timeout on
// the first assertion below accounts for that, not flakiness.
test("PM sees only their own projects' look-ahead, labour, deliveries and issues", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/login");
  await page.getByLabel("Email").fill("pm@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  await expect(page.getByRole("heading", { name: "PM Dashboard" })).toBeVisible();
  await expect(page.getByText("My projects")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("3-week look-ahead")).toBeVisible();
  await expect(page.getByText("Labour required vs allocated")).toBeVisible();
  await expect(page.getByText("Delivery status")).toBeVisible();
  // exact: true — the page subtitle also mentions "...and open issues" in lowercase prose.
  await expect(page.getByText("Open issues", { exact: true })).toBeVisible();

  await expect(page.getByText("Riverside Quarter Fitout").first()).toBeVisible();
  await expect(page.getByText("Beacon Cove Office Upgrade").first()).toBeVisible();

  // CardTitle is a styled div, not a semantic heading, hence getByText.
  await expect(page.getByText("Staff Scorecard")).toBeVisible({ timeout: 15_000 });

  // Filtering to one project narrows "My projects" down to just that one.
  const projectFilter = page.getByRole("combobox", { name: "Project" });
  await projectFilter.click();
  await page.getByRole("option", { name: /Riverside Quarter Fitout/ }).click();
  await expect(page.getByText("Beacon Cove Office Upgrade")).not.toBeVisible({ timeout: 15_000 });
});
