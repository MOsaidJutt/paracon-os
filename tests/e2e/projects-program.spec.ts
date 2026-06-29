import { test, expect } from "@playwright/test";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
// Uses the Director account since it holds every permission this flow touches
// (tender.edit to add a client, project.edit + program.edit for the program).
test("director can build a project's program with a critical date and weekly labour, then see it on the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("director@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  // A project needs an existing client to bill against.
  await page.goto("/contacts/clients");
  await page.getByRole("button", { name: "Add client" }).click();
  await page.getByLabel("Name").fill("E2E Program Client");
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "Pricing" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("E2E Program Client")).toBeVisible();

  // Create the project.
  await page.goto("/projects");
  await page.getByRole("button", { name: "Add project" }).click();
  await page.getByLabel("Project name").fill("E2E Fitout Project");
  await page.getByLabel("Code").fill("E2E-01");

  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "On Track" }).click();

  await page.getByLabel("Client").click();
  await page.getByRole("option", { name: "E2E Program Client" }).click();

  await page.getByLabel("Value ($)").fill("500000");

  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const end = new Date(today.getTime() + 14 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Start date").fill(start);
  await page.getByLabel("End date").fill(end);

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Project created")).toBeVisible();

  // Open the project and switch to the Program tab.
  await page.getByText("E2E Fitout Project").click();
  await page.waitForURL(/\/projects\/.+/);
  await page.getByRole("tab", { name: "Program" }).click();

  // Add a critical activity with a weekly labour requirement.
  await page.getByRole("button", { name: "Add activity" }).click();
  await page.getByLabel("Activity name").fill("Services rough-in");

  await page.getByLabel("Trade").click();
  await page.getByRole("option", { name: "Electrician", exact: true }).click();

  await page.getByLabel("Status", { exact: true }).click();
  await page.getByRole("option", { name: "On Track" }).click();

  await page.getByLabel("Start date").fill(start);
  await page.getByLabel("End date").fill(end);

  await page.getByLabel("Critical date").click();
  await page.getByLabel("Milestone type").click();
  await page.getByRole("option", { name: "Services Rough-In" }).click();

  await page.getByRole("button", { name: "Add role" }).click();
  await page.getByText("Role", { exact: true }).click();
  await page.getByRole("option", { name: "Electrician", exact: true }).click();
  await page.getByPlaceholder("Count").fill("3");

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Activity added")).toBeVisible();

  // The activity shows in the program table.
  await expect(page.getByRole("cell", { name: "Services rough-in" })).toBeVisible();

  // Its weekly crew requirement rolls up into the Labour tab.
  await page.getByRole("tab", { name: "Labour" }).click();
  await expect(page.getByRole("columnheader", { name: "Electrician" })).toBeVisible();

  // The derived critical date surfaces on the Director dashboard's next-30-days widget.
  await page.goto("/dashboard");
  await expect(page.getByText("Critical dates — next 30 days")).toBeVisible();
  await expect(page.getByText("E2E Fitout Project")).toBeVisible();
  await expect(page.getByText("Services Rough-In: Services rough-in")).toBeVisible();
});
