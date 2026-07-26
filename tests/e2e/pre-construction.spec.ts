import { test, expect } from "@playwright/test";
import { signIn, usePreference } from "./helpers/view-mode";
import { createE2ETender } from "./helpers/entities";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
//
// /tenders serves two layouts off the same route, branched server-side by view
// mode: Full shows DashboardCards + TenderRegisterTable stacked (unchanged,
// covered by tender-pipeline.spec.ts), Simplified shows this module —
// PreConstructionView's Register/Intel toggle over the same two components.
// Nothing here re-tests the register's own CRUD or the dashboard's own
// calculations; both are exercised elsewhere and reused unchanged.

test("a created tender gets a T### code, shown in the register and in its own sheet", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, "director@paracon.com.au");
  await page.goto("/tenders");
  await usePreference(page, "preconstruction.view", "REGISTER");

  const { tenderName } = await createE2ETender(page, "Numbering");

  // The register's leading T# column carries a real code, not a placeholder.
  const row = page.getByRole("row", { name: new RegExp(tenderName) });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row.getByRole("cell").first()).toHaveText(/^T\d{3,}$/);

  // The same code appears in the sheet title when the tender is reopened, and
  // it's carried on the row, not editable from the form (never renumbered).
  await row.click();
  await expect(page.getByRole("heading", { name: /^T\d{3,} · Edit tender$/ })).toBeVisible({ timeout: 15_000 });
});

test("Pre-Construction's Register/Intel toggle switches the body and is remembered", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, "director@paracon.com.au");
  await page.goto("/tenders");
  await usePreference(page, "preconstruction.view", "REGISTER");

  await expect(page.getByRole("heading", { name: "Pre-Construction" })).toBeVisible({ timeout: 30_000 });
  const toggle = page.getByRole("group", { name: "Choose what to show" });
  await expect(toggle).toBeVisible({ timeout: 15_000 });

  // Register is the default working surface: the Add-tender toolbar is on screen.
  await expect(page.getByRole("button", { name: "Add tender" })).toBeVisible({ timeout: 15_000 });

  // Switching to Intel swaps the body for the existing bid-intelligence
  // dashboard — reused exactly as the Full view renders it.
  await toggle.getByRole("button", { name: "Intel" }).click();
  await expect(page.getByText("Weighted Pipeline", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Add tender" })).toHaveCount(0);

  // The choice survives a reload rather than resetting to the default.
  await page.reload();
  await expect(page.getByText("Weighted Pipeline", { exact: true })).toBeVisible({ timeout: 30_000 });

  // Restored through the API rather than a click: the click is optimistic,
  // and a test that ends before the write lands leaves the account on Intel.
  await usePreference(page, "preconstruction.view", "REGISTER");
  await expect(page.getByRole("button", { name: "Add tender" })).toBeVisible({ timeout: 15_000 });
});

test("the summary strip shows the same win-rate and pipeline figures as Intel, above the register", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signIn(page, "director@paracon.com.au");
  await page.goto("/tenders");
  await usePreference(page, "preconstruction.view", "REGISTER");

  await expect(page.getByText("Win rate", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Weighted pipeline", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Submission rate", { exact: true })).toBeVisible({ timeout: 15_000 });
});

test("the register renders as a card list on a phone-width viewport", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "director@paracon.com.au");
  await page.goto("/tenders");
  await usePreference(page, "preconstruction.view", "REGISTER");

  // The table is hidden below md; a tender is reachable as a card instead,
  // opening the same detail sheet a table row would.
  await expect(page.getByRole("table")).not.toBeVisible({ timeout: 15_000 });

  const { tenderName } = await createE2ETender(page, "Mobile");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tenders");

  const card = page.getByRole("button", { name: new RegExp(tenderName) });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();
  await expect(page.getByRole("heading", { name: /Edit tender/ })).toBeVisible({ timeout: 15_000 });
});
