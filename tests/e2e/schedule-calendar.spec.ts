import { test, expect } from "@playwright/test";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
// Uses the Director account, which holds project.edit + program.edit + project.view.
test("director sees a project's tasks on the cross-project schedule calendar and can filter/search them", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await page.goto("/login");
  await page.getByLabel("Email").fill("director@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  // A project needs an existing client to bill against.
  await page.goto("/contacts/clients");
  await page.getByRole("button", { name: "Add client" }).click();
  await page.getByLabel("Name").fill("E2E Calendar Client");
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "Pricing" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("E2E Calendar Client")).toBeVisible({ timeout: 20_000 });

  // Create the project, dated this month so it's guaranteed visible on the
  // calendar's default (current month) view.
  await page.goto("/projects");
  await page.getByRole("button", { name: "Add project" }).click();
  await page.getByLabel("Project name").fill("E2E Calendar Project");
  await page.getByLabel("Code").fill("E2E-CAL");
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "On Track" }).click();
  await page.getByLabel("Client").click();
  await page.getByRole("option", { name: "E2E Calendar Client" }).click();
  await page.getByLabel("Value ($)").fill("180000");

  const today = new Date();
  const day = (n: number) => new Date(today.getTime() + n * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Start date").fill(day(0));
  await page.getByLabel("End date").fill(day(10));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Project created")).toBeVisible({ timeout: 20_000 });

  await page.getByText("E2E Calendar Project").click();
  await page.waitForURL(/\/projects\/.+/, { timeout: 20_000 });
  await page.getByRole("tab", { name: "Program" }).click({ timeout: 20_000 });

  await page.getByRole("button", { name: "Add activity" }).click();
  await page.getByLabel("Activity name").fill("Joinery install");
  await page.getByLabel("Trade").click();
  await page.getByRole("option", { name: "Carpenter", exact: true }).click();
  await page.getByLabel("Status", { exact: true }).click();
  await page.getByRole("option", { name: "On Track" }).click();
  await page.getByLabel("Start date").fill(day(0));
  await page.getByLabel("End date").fill(day(2));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Activity added")).toBeVisible({ timeout: 20_000 });

  // Open the cross-project schedule — defaults to the multi-project Gantt tab,
  // switch to the Calendar tab for the search/filter assertions below.
  await page.goto("/projects");
  await page.getByRole("link", { name: "Schedule calendar" }).click();
  await page.waitForURL(/\/projects\/schedule/);
  await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
  await page.getByRole("tab", { name: "Calendar" }).click();

  // The new task is visible on today's cell, coloured by project by default.
  await expect(page.getByText("Joinery install").first()).toBeVisible({ timeout: 30_000 });

  // Searching narrows the grid down to matching tasks/projects.
  await page.getByPlaceholder("Search phases or tasks...").fill("Joinery install");
  await expect(page.getByText("Joinery install").first()).toBeVisible({ timeout: 15_000 });
  await page.getByPlaceholder("Search phases or tasks...").fill("Nonexistent Task Name Xyz");
  await expect(page.getByText("Joinery install")).toHaveCount(0, { timeout: 15_000 });
  await page.getByPlaceholder("Search phases or tasks...").fill("");

  // "Joinery install" has no parent, so it's a top-level phase — the
  // tasks-only filter (which keeps only activities with a parent) hides it.
  await page.getByRole("combobox").filter({ hasText: "Phases & tasks" }).click();
  await page.getByRole("option", { name: "Tasks only" }).click();
  await expect(page.getByText("Joinery install")).toHaveCount(0, { timeout: 15_000 });
  await page.getByRole("combobox").filter({ hasText: "Tasks only" }).click();
  await page.getByRole("option", { name: "Phases & tasks" }).click();
  await expect(page.getByText("Joinery install").first()).toBeVisible({ timeout: 15_000 });

  // Month navigation moves the visible range and re-fetches the calendar.
  const monthLabel = page.locator("span.min-w-36");
  const currentMonthText = await monthLabel.textContent();
  await page.getByRole("button").filter({ has: page.locator("svg.lucide-chevron-right") }).click();
  await expect(monthLabel).not.toHaveText(currentMonthText ?? "", { timeout: 15_000 });
});
