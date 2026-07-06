import { test, expect } from "@playwright/test";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
// Covers the demo-call ask: change history visible inline on the record
// itself (who changed what, when), not only in the central Admin > Audit log.
test("editing a project shows the change in its own inline Activity section", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/login");
  await page.getByLabel("Email").fill("director@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  // A project needs an existing client to bill against.
  await page.goto("/contacts/clients");
  await page.getByRole("button", { name: "Add client" }).click();
  await page.getByLabel("Name").fill("E2E Activity Trail Client");
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "Pricing" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("E2E Activity Trail Client")).toBeVisible({ timeout: 30_000 });

  // Create the project.
  await page.goto("/projects");
  await page.getByRole("button", { name: "Add project" }).click();
  await page.getByLabel("Project name").fill("E2E Activity Trail Project");
  await page.getByLabel("Code").fill("E2E-ACT");
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "On Track" }).click();
  await page.getByLabel("Client").click();
  await page.getByRole("option", { name: "E2E Activity Trail Client" }).click();
  await page.getByLabel("Value ($)").fill("250000");
  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const end = new Date(today.getTime() + 14 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Start date").fill(start);
  await page.getByLabel("End date").fill(end);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Project created")).toBeVisible({ timeout: 30_000 });

  await page.getByText("E2E Activity Trail Project").click();
  await page.waitForURL(/\/projects\/.+/);

  // The Activity section is collapsed by default; expanding it shows the
  // creation itself was already audited (entityType "Project").
  await page.getByRole("button", { name: "Activity" }).click();
  await expect(page.getByText("project.create")).toBeVisible({ timeout: 15_000 });

  // Edit the project — this is the change we expect to see in the trail.
  await page.getByRole("button", { name: "Edit project" }).click();
  await page.getByLabel("Value ($)").fill("275000");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Project updated")).toBeVisible({ timeout: 15_000 });

  // The Activity panel was already open through the edit — the edit
  // mutation invalidates the audit-trail query, so the new entry appears
  // without the user needing to close/reopen anything, right on the record,
  // with no navigation to /admin/audit.
  await expect(page.getByText("project.update")).toBeVisible({ timeout: 15_000 });
  await expect(page).not.toHaveURL(/admin\/audit/);
});

test("editing a program activity shows the change in its own inline Activity section", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/login");
  await page.getByLabel("Email").fill("director@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  await page.goto("/contacts/clients");
  await page.getByRole("button", { name: "Add client" }).click();
  await page.getByLabel("Name").fill("E2E Activity Task Client");
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "Pricing" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("E2E Activity Task Client")).toBeVisible({ timeout: 30_000 });

  await page.goto("/projects");
  await page.getByRole("button", { name: "Add project" }).click();
  await page.getByLabel("Project name").fill("E2E Activity Task Project");
  await page.getByLabel("Code").fill("E2E-TASK");
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "On Track" }).click();
  await page.getByLabel("Client").click();
  await page.getByRole("option", { name: "E2E Activity Task Client" }).click();
  await page.getByLabel("Value ($)").fill("250000");
  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const end = new Date(today.getTime() + 14 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Start date").fill(start);
  await page.getByLabel("End date").fill(end);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Project created")).toBeVisible({ timeout: 30_000 });

  await page.getByText("E2E Activity Task Project").click();
  await page.waitForURL(/\/projects\/.+/);
  await page.getByRole("tab", { name: "Program" }).click();

  await page.getByRole("button", { name: "Add activity" }).click();
  await page.getByLabel("Activity name").fill("E2E Task One");
  await page.getByLabel("Trade").click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Status").click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Start date").fill(start);
  await page.getByLabel("End date").fill(end);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Activity added")).toBeVisible({ timeout: 15_000 });

  // Reopen the same task — its own Activity section shows the creation.
  await page.getByText("E2E Task One").click();
  await page.getByRole("button", { name: "Activity" }).click();
  await expect(page.getByText("program_activity.create")).toBeVisible({ timeout: 15_000 });

  await page.getByLabel("Activity name").fill("E2E Task One Renamed");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Activity updated")).toBeVisible({ timeout: 15_000 });

  await page.getByText("E2E Task One Renamed").click();
  await page.getByRole("button", { name: "Activity" }).click();
  await expect(page.getByText("program_activity.update")).toBeVisible({ timeout: 15_000 });
  await expect(page).not.toHaveURL(/admin\/audit/);
});
