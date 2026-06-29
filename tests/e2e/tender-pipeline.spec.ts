import { test, expect } from "@playwright/test";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
test("estimator can add a client and tender, and the dashboard updates", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("estimator@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  // Starts at zero before any tenders exist.
  await page.goto("/tenders");
  await expect(page.getByText("Weighted Pipeline")).toBeVisible();
  await expect(page.getByText("$0").first()).toBeVisible();

  // Add a client so the tender form has someone to bid to.
  await page.goto("/contacts/clients");
  await page.getByRole("button", { name: "Add client" }).click();
  await page.getByLabel("Name").fill("E2E Test Client");
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "Pricing" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("E2E Test Client")).toBeVisible();

  // Add a tender against that client.
  await page.goto("/tenders");
  await page.getByRole("button", { name: "Add tender" }).click();
  await page.getByLabel("Project name").fill("E2E Test Project");

  await page.getByLabel("Client").click();
  await page.getByRole("option", { name: "E2E Test Client" }).click();

  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "In Progress" }).click();

  await page.getByLabel("Value ($)").fill("1000000");

  await page.getByLabel("Win probability").click();
  await page.getByRole("option", { name: "High" }).click();

  await page.getByLabel("Bid decision").click();
  await page.getByRole("option", { name: "Go", exact: true }).click();

  await page.getByLabel("Intent").click();
  await page.getByRole("option", { name: "Pursue" }).click();

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Tender created")).toBeVisible();

  // Register shows the new row, and the dashboard reflects the weighted pipeline.
  await expect(page.getByText("E2E Test Project")).toBeVisible();
  await expect(page.getByText("$800,000")).toBeVisible(); // 1,000,000 x High (0.8)
});
