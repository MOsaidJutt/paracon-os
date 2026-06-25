import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Creates a throwaway client + project via the real UI and returns its name.
 * Phase 6 (documents/import) specs use this instead of attaching test data to
 * the seeded demo project (e.g. "Riverside Quarter Fitout") — that project is
 * what a real director sees in a sales demo, and e2e runs leave no teardown
 * (matching every other spec in this suite), so it must stay pristine.
 */
export async function createE2EProject(page: Page, label: string): Promise<{ projectName: string }> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const clientName = `E2E ${label} Client ${suffix}`;
  const projectName = `E2E ${label} Project ${suffix}`;

  await page.goto("/tenders/clients");
  await page.getByRole("button", { name: "Add client" }).click();
  await page.getByLabel("Name").fill(clientName);
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "Pricing" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(clientName)).toBeVisible();

  await page.goto("/projects");
  await page.getByRole("button", { name: "Add project" }).click();
  await page.getByLabel("Project name").fill(projectName);
  // The leading digits of Date.now() barely change within a single test run,
  // so two tests seconds apart would otherwise collide on the same code —
  // use the trailing random component instead.
  await page.getByLabel("Code").fill(`E2E-${suffix.split("-")[1]}-${Math.random().toString(36).slice(2, 6)}`);

  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "On Track" }).click();

  await page.getByLabel("Client").click();
  await page.getByRole("option", { name: clientName }).click();

  await page.getByLabel("Value ($)").fill("250000");

  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const end = new Date(today.getTime() + 14 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Start date").fill(start);
  await page.getByLabel("End date").fill(end);

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Project created")).toBeVisible();

  return { projectName };
}

/** Creates a throwaway client + tender via the real UI and returns its name — same rationale as createE2EProject. */
export async function createE2ETender(page: Page, label: string): Promise<{ tenderName: string }> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const clientName = `E2E ${label} Client ${suffix}`;
  const tenderName = `E2E ${label} Tender ${suffix}`;

  await page.goto("/tenders/clients");
  await page.getByRole("button", { name: "Add client" }).click();
  await page.getByLabel("Name").fill(clientName);
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "Pricing" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(clientName)).toBeVisible();

  await page.goto("/tenders");
  await page.getByRole("button", { name: "Add tender" }).click();
  await page.getByLabel("Project name").fill(tenderName);

  await page.getByLabel("Client").click();
  await page.getByRole("option", { name: clientName }).click();

  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "In Progress" }).click();

  await page.getByLabel("Value ($)").fill("250000");

  await page.getByLabel("Win probability").click();
  await page.getByRole("option", { name: "High" }).click();

  await page.getByLabel("Bid decision").click();
  await page.getByRole("option", { name: "Go", exact: true }).click();

  await page.getByLabel("Intent").click();
  await page.getByRole("option", { name: "Pursue" }).click();

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Tender created")).toBeVisible();

  return { tenderName };
}
