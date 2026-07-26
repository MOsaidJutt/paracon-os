import { test, expect } from "@playwright/test";
import { usePreference } from "./helpers/view-mode";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
// Covers the Phase 13b "phone book" behaviour: every contact picker is a
// type-ahead search against the shared Contacts database, and picking an
// existing record never creates a duplicate.

test("tender form's client picker finds an existing client by partial name and reuses it (no duplicate)", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("estimator@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  // Enter once: create the client via the Contacts module.
  await page.goto("/contacts/clients");
  await page.getByRole("button", { name: "Add client" }).click();
  await page.getByLabel("Name").fill("Buildcorp Australia Pty Ltd");
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "Pricing" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Buildcorp Australia Pty Ltd")).toBeVisible();

  // /tenders now branches on view mode; force the register tab so "Add tender"
  // is on screen regardless of what a previous spec left this account on.
  await page.goto("/tenders");
  await usePreference(page, "preconstruction.view", "REGISTER");
  await page.getByRole("button", { name: "Add tender" }).click();
  await page.getByLabel("Project name").fill("E2E Autocomplete Project");

  await page.getByLabel("Client").click();
  await page.getByPlaceholder("Search clients...").fill("Buil");
  await expect(page.getByRole("option", { name: "Buildcorp Australia Pty Ltd" })).toBeVisible();
  await page.getByRole("option", { name: "Buildcorp Australia Pty Ltd" }).click();

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
  await expect(page.getByText("E2E Autocomplete Project")).toBeVisible();

  // Dedupe: picking the existing client must not have created a second one.
  await page.goto("/contacts/clients");
  await expect(page.getByText("Buildcorp Australia Pty Ltd")).toHaveCount(1);
});

test("purchase order's supplier picker finds an existing supplier by partial name and reuses it (no duplicate)", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("director@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  // Enter once: create the supplier via the Contacts module.
  await page.goto("/contacts/suppliers");
  await page.getByRole("button", { name: "Add supplier" }).click();
  await page.getByLabel("Trade").fill("Steel fixing");
  await page.getByLabel("Company").fill("Steelcraft Fabrication Pty Ltd");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Steelcraft Fabrication Pty Ltd")).toBeVisible();

  // Create a project to hang the PO off.
  await page.goto("/contacts/clients");
  await page.getByRole("button", { name: "Add client" }).click();
  await page.getByLabel("Name").fill("E2E PO Client");
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "Pricing" }).click();
  await page.getByRole("button", { name: "Save" }).click();

  await page.goto("/projects");
  await page.getByRole("button", { name: "Add project" }).click();
  await page.getByLabel("Project name").fill("E2E PO Project");
  await page.getByLabel("Code").fill("E2E-PO");
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "On Track" }).click();
  await page.getByLabel("Client").click();
  await page.getByRole("option", { name: "E2E PO Client" }).click();
  await page.getByLabel("Value ($)").fill("100000");
  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const end = new Date(today.getTime() + 14 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Start date").fill(start);
  await page.getByLabel("End date").fill(end);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Project created")).toBeVisible();

  await page.getByText("E2E PO Project").click();
  await page.waitForURL(/\/projects\/.+/);
  await page.getByRole("tab", { name: "Financials" }).click();

  // Reuse everywhere: the PO form's supplier field is a search, not a re-type.
  await page.getByRole("button", { name: "New PO" }).click();
  await page.getByLabel("Supplier").click();
  await page.getByPlaceholder("Search suppliers...").fill("Steelcraft");
  await expect(page.getByRole("option", { name: "Steelcraft Fabrication Pty Ltd" })).toBeVisible();
  await page.getByRole("option", { name: "Steelcraft Fabrication Pty Ltd" }).click();

  await page.getByPlaceholder("Description").first().fill("Structural steel supply");
  await page.getByPlaceholder("$").first().fill("50000");
  await page.getByRole("button", { name: "Create" }).click();

  // Dedupe: picking the existing supplier must not have created a second one.
  await page.goto("/contacts/suppliers");
  await expect(page.getByText("Steelcraft Fabrication Pty Ltd")).toHaveCount(1);
});
