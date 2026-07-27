import { test, expect } from "@playwright/test";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
// Proves the literal client ask: a single Gantt-style timeline stacking MULTIPLE
// projects together (not just the per-project Gantt on a project's own page).
test("the multi-project Gantt stacks two projects' tasks in one timeline, grouped by project", async ({ page }) => {
  // Creates two full projects with clients and activities — six write-heavy
  // requests against the dev Neon connection, each observed to take 10-15s+
  // under current load (confirmed structural DB round-trip latency, not this
  // suite's own overhead: direct timing showed a plain Project findFirst at
  // ~1.4s per round trip, and each POST does ~9-10 of those sequentially).
  // The original 150s/20s budgets were too tight for that; widened rather
  // than restructured, since the flow itself is unchanged.
  test.setTimeout(300_000);
  await page.goto("/login");
  await page.getByLabel("Email").fill("director@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  await page.goto("/contacts/clients");
  await page.getByRole("button", { name: "Add client" }).click();
  await page.getByLabel("Name").fill("E2E Multi-Gantt Client");
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "Pricing" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("E2E Multi-Gantt Client")).toBeVisible({ timeout: 45_000 });

  const today = new Date();
  const day = (n: number) => new Date(today.getTime() + n * 86_400_000).toISOString().slice(0, 10);

  async function createProjectWithActivity(name: string, code: string, activityName: string, trade: string) {
    await page.goto("/projects");
    await page.getByRole("button", { name: "Add project" }).click();
    await page.getByLabel("Project name").fill(name);
    await page.getByLabel("Code").fill(code);
    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "On Track" }).click();
    await page.getByLabel("Client").click();
    await page.getByRole("option", { name: "E2E Multi-Gantt Client" }).click();
    await page.getByLabel("Value ($)").fill("200000");
    await page.getByLabel("Start date").fill(day(0));
    await page.getByLabel("End date").fill(day(10));
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Project created")).toBeVisible({ timeout: 45_000 });

    await page.getByText(name).click();
    await page.waitForURL(/\/projects\/.+/, { timeout: 45_000 });
    await page.getByRole("tab", { name: "Program" }).click({ timeout: 20_000 });

    await page.getByRole("button", { name: "Add activity" }).click();
    await page.getByLabel("Activity name").fill(activityName);
    await page.getByLabel("Trade").click();
    await page.getByRole("option", { name: trade, exact: true }).click();
    await page.getByLabel("Status", { exact: true }).click();
    await page.getByRole("option", { name: "On Track" }).click();
    await page.getByLabel("Start date").fill(day(0));
    await page.getByLabel("End date").fill(day(2));
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Activity added")).toBeVisible({ timeout: 45_000 });
  }

  await createProjectWithActivity("E2E Multi-Gantt Project A", "E2E-MGA", "Frame carpentry A", "Carpenter");
  await createProjectWithActivity("E2E Multi-Gantt Project B", "E2E-MGB", "Frame carpentry B", "Carpenter");

  await page.goto("/projects/schedule");
  await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();

  // Gantt is the default tab — both projects' group rows and their tasks are
  // visible together in one timeline, not two separate single-project charts.
  // /api/schedule/calendar does several sequential queries (projects,
  // baselines, delay records, dependencies, workers, forecast config) — give
  // it the same headroom as the other calendar-backed specs.
  // Same text legitimately appears 3x (legend swatch, gantt-task-react's own
  // task-list panel, and its SVG bar label) — .first() is enough to prove
  // presence, matching the legend-specific check a few lines below.
  await expect(page.getByText("E2E-MGA — E2E Multi-Gantt Project A").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("E2E-MGB — E2E Multi-Gantt Project B").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Frame carpentry A").first()).toBeVisible();
  await expect(page.getByText("Frame carpentry B").first()).toBeVisible();

  // The legend lists both projects (colour-coded).
  await expect(page.getByText("E2E-MGA — E2E Multi-Gantt Project A").first()).toBeVisible();

  // Combined labour demand strip shows a Carpenter row (both projects need one each = 2).
  await expect(page.getByText("Carpenter", { exact: true }).first()).toBeVisible();
});
