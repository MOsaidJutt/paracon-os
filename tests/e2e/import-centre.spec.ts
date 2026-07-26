import { test, expect } from "@playwright/test";
import {
  cleanupFixture,
  writeBulkDocsZipFixture,
  writeTenderTrackerFixture,
  writeZztakeoffFixture,
} from "./helpers/fixtures";
import { createE2EProject, createE2ETender } from "./helpers/entities";
import { usePreference } from "./helpers/view-mode";

// Requires the database to be seeded (npm run db:seed), the dev server running,
// and `npm run dev:storage` reachable — every importer stages its upload in
// real storage before parsing, even when its commit is DB-only.
//
// Tests that need an existing project/tender target create their own
// throwaway one rather than attaching to seeded demo data — these specs
// leave no teardown, and the seeded data is what a real director sees in a
// sales demo.

async function loginAsDirector(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("director@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");
}

test("tender-tracker import: preview, commit, then a repeat run is an idempotent no-op", async ({ page }) => {
  const projectName = `E2E Import Tender ${Date.now()}`;
  const clientName = `E2E Import Client ${Date.now()}`;
  const fixturePath = writeTenderTrackerFixture(projectName, clientName);

  try {
    await loginAsDirector(page);
    await page.goto("/import");

    await page.getByRole("button").filter({ hasText: "Tender Tracker workbook" }).click();
    await page.getByLabel("Choose file to import").setInputFiles(fixturePath);
    await page.getByRole("button", { name: "Preview" }).click();

    await expect(page.getByText("Review & commit")).toBeVisible();
    await page.getByRole("button", { name: "Confirm commit" }).click();
    await expect(page.getByText("Import committed")).toBeVisible();
    await expect(page.getByText("Import report")).toBeVisible();

    // The tender + client really landed in the register, not just a fake
    // report. /tenders now branches on view mode; force the register tab.
    await page.goto("/tenders");
    await usePreference(page, "preconstruction.view", "REGISTER");
    await expect(page.getByText(projectName)).toBeVisible();
    await page.goto("/contacts/clients");
    await expect(page.getByText(clientName)).toBeVisible();

    // Re-running the exact same file is a safe, idempotent no-op — not a duplicate row.
    await page.goto("/import");
    await page.getByRole("button").filter({ hasText: "Tender Tracker workbook" }).click();
    await page.getByLabel("Choose file to import").setInputFiles(fixturePath);
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByText("Already imported")).toBeVisible();
  } finally {
    cleanupFixture(fixturePath);
  }
});

test("bulk document zip import attaches a matched file to the right project's Documents panel", async ({ page }) => {
  await loginAsDirector(page);
  const { projectName } = await createE2EProject(page, "Zip");

  const entryFileName = `VQ-99 Test Variation ${Date.now()}.txt`;
  const fixturePath = writeBulkDocsZipFixture(projectName, entryFileName);

  try {
    await page.goto("/import");

    await page.getByRole("button").filter({ hasText: "Bulk document zip" }).click();
    await page.getByLabel("Choose file to import").setInputFiles(fixturePath);
    await page.getByRole("button", { name: "Preview" }).click();

    await expect(page.getByText("Review & commit")).toBeVisible();
    await expect(page.getByText(/matchedProjects: 1/)).toBeVisible();
    // Per-row breakdown lets the user verify exactly what will attach before committing.
    await expect(page.getByText(entryFileName)).toBeVisible();
    await expect(page.getByText(new RegExp(`Project: ${projectName}`))).toBeVisible();
    await page.getByRole("button", { name: "Confirm commit" }).click();
    await expect(page.getByText("Import committed")).toBeVisible();

    await page.goto("/projects");
    await page.getByText(projectName).first().click();
    await page.waitForURL(/\/projects\/.+/);
    await page.getByRole("tab", { name: "Documents" }).click();
    await expect(page.getByText(entryFileName)).toBeVisible();
  } finally {
    cleanupFixture(fixturePath);
  }
});

test("ZZTakeoff import: map columns, pick a target tender, and create estimate line items", async ({ page }) => {
  await loginAsDirector(page);
  const { tenderName } = await createE2ETender(page, "Takeoff");

  const fixturePath = writeZztakeoffFixture();

  try {
    await page.goto("/import");

    await page.getByRole("button").filter({ hasText: "ZZTakeoff quantity export" }).click();
    await page.getByLabel("Choose file to import").setInputFiles(fixturePath);
    await page.getByRole("button", { name: "Preview" }).click();

    await expect(page.getByText("Map columns & choose a target")).toBeVisible();

    await page.locator("#column-map-description").click();
    await page.getByRole("option", { name: "Description", exact: true }).click();
    await page.locator("#column-map-quantity").click();
    await page.getByRole("option", { name: "Quantity", exact: true }).click();
    await page.locator("#column-map-unit").click();
    await page.getByRole("option", { name: "UoM", exact: true }).click();
    await page.locator("#column-map-unitRate").click();
    await page.getByRole("option", { name: "Unit Rate", exact: true }).click();
    await page.locator("#column-map-amount").click();
    await page.getByRole("option", { name: "Amount", exact: true }).click();
    await page.locator("#column-map-remarks").click();
    await page.getByRole("option", { name: "Remarks", exact: true }).click();

    await page.locator("#import-target-type").click();
    await page.getByRole("option", { name: "Tender", exact: true }).click();
    await page.locator("#import-target-id").click();
    await page.getByRole("option", { name: tenderName }).click();

    await page.getByRole("button", { name: "Apply mapping" }).click();
    await expect(page.getByText("Review & commit")).toBeVisible();

    await page.getByRole("button", { name: "Confirm commit" }).click();
    await expect(page.getByText("Import committed")).toBeVisible();
    await expect(page.getByText(/created: 2/)).toBeVisible();
  } finally {
    cleanupFixture(fixturePath);
  }
});
