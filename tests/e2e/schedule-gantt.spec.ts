import { test, expect, type Page } from "@playwright/test";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
// Uses the Director account, which holds program.edit + project.edit.

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("director@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");
}

/** Drags a Gantt bar's body (not its resize handles) horizontally by `dx` pixels — moves the whole task. */
async function dragBarByName(page: Page, taskName: string, dx: number) {
  const barRect = page
    .locator("svg g.content g.bar")
    .locator("g", { has: page.locator(`text=${taskName}`) })
    .locator("g[tabindex='0'] rect")
    .first();
  const box = await barRect.boundingBox();
  if (!box) throw new Error(`Could not find Gantt bar for "${taskName}"`);

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY, { steps: 10 });
  await page.mouse.up();
}

test("director links two tasks with a dependency, drags the predecessor later, and confirms a delay reason", async ({
  page,
}) => {
  test.setTimeout(280_000);
  await login(page);

  // A project needs an existing client to bill against. Neon's serverless
  // connections can take several seconds to wake from idle, so creation
  // toasts get a generous timeout rather than the 5s default.
  await page.goto("/contacts/clients");
  await page.getByRole("button", { name: "Add client" }).click();
  await page.getByLabel("Name").fill("E2E Gantt Client");
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "Pricing" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("E2E Gantt Client")).toBeVisible({ timeout: 20_000 });

  // Create the project.
  await page.goto("/projects");
  await page.getByRole("button", { name: "Add project" }).click();
  await page.getByLabel("Project name").fill("E2E Gantt Project");
  await page.getByLabel("Code").fill("E2E-GANTT");
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "On Track" }).click();
  await page.getByLabel("Client").click();
  await page.getByRole("option", { name: "E2E Gantt Client" }).click();
  await page.getByLabel("Value ($)").fill("250000");

  const today = new Date();
  const day = (n: number) => new Date(today.getTime() + n * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Start date").fill(day(0));
  await page.getByLabel("End date").fill(day(30));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Project created")).toBeVisible({ timeout: 20_000 });

  await page.getByText("E2E Gantt Project").click();
  await page.waitForURL(/\/projects\/.+/, { timeout: 20_000 });
  await page.getByRole("tab", { name: "Program" }).click({ timeout: 20_000 });

  // Predecessor: Demolition, days 0-4.
  await page.getByRole("button", { name: "Add activity" }).click();
  await page.getByLabel("Activity name").fill("Demolition");
  await page.getByLabel("Trade").click();
  await page.getByRole("option", { name: "Site Labourer", exact: true }).click();
  await page.getByLabel("Status", { exact: true }).click();
  await page.getByRole("option", { name: "On Track" }).click();
  await page.getByLabel("Start date").fill(day(0));
  await page.getByLabel("End date").fill(day(4));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Activity added")).toBeVisible({ timeout: 20_000 });

  // Successor: Framing, days 5-9.
  await page.getByRole("button", { name: "Add activity" }).click();
  await page.getByLabel("Activity name").fill("Framing");
  await page.getByLabel("Trade").click();
  await page.getByRole("option", { name: "Carpenter", exact: true }).click();
  await page.getByLabel("Status", { exact: true }).click();
  await page.getByRole("option", { name: "On Track" }).click();
  await page.getByLabel("Start date").fill(day(5));
  await page.getByLabel("End date").fill(day(9));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Activity added")).toBeVisible({ timeout: 20_000 });

  // Link Framing to depend on Demolition finishing first. The predecessor
  // picker is a shadcn Select (button-based), so its placeholder is rendered
  // text, not an HTML placeholder attribute — match it by text instead.
  await page.getByRole("cell", { name: "Framing" }).click();
  await page.getByText("Depends on...", { exact: true }).click();
  await page.getByRole("option", { name: "Demolition" }).click();
  await page.getByRole("button", { name: "Add dependency" }).click();
  await expect(page.getByText("Dependency added")).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press("Escape");
  // The Sheet's exit animation still captures pointer events for a moment
  // after Escape returns — wait for it to fully unmount before dragging.
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Drag Demolition's bar one column (one week) later — pushes its finish
  // past Framing's current start, which must cascade and require a reason.
  await dragBarByName(page, "Demolition", 65);

  await expect(page.getByText("Reason for delay required")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/downstream task.*impacted/)).toBeVisible();
  await page.getByRole("button", { name: "Weather" }).click();
  await page.getByPlaceholder("Add context for this delay...").fill("Wet weather pushed demolition out.");
  await page.getByRole("button", { name: "Save new date" }).click();
  // Commit-move runs a multi-statement transaction (apply changes, write the
  // delay record, recompute critical path, sync milestones, audit log) over
  // the same slow Neon connection — give it real headroom.
  await expect(page.getByText("Date updated")).toBeVisible({ timeout: 45_000 });

  // Re-open Demolition and confirm the change history captured the slip.
  await page.getByRole("cell", { name: "Demolition" }).click();
  await expect(page.getByText("Weather", { exact: true })).toBeVisible({ timeout: 45_000 });
});

test("critical path toggle highlights tasks on the Gantt", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  await page.goto("/projects");
  await page.getByText("E2E Gantt Project").click();
  await page.waitForURL(/\/projects\/.+/, { timeout: 20_000 });
  await page.getByRole("tab", { name: "Program" }).click({ timeout: 20_000 });

  await page.getByRole("button", { name: "View" }).click();
  await expect(page.getByText("Critical path")).toBeVisible();
  // Critical path is on by default — the linked Demolition/Framing chain has zero float.
  await expect(page.locator("text=Demolition ★").or(page.locator("text=Framing ★")).first()).toBeVisible();
});
