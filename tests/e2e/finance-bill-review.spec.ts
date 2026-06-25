import { test, expect } from "@playwright/test";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
// Exercises the Phase 8 critical flow for the Project Manager: resolve a bill out of
// the Unallocated tray, then take a bill through the review checklist to Approved.
test("project manager allocates an unallocated bill, then reviews and approves a bill", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("pm@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  await page.goto("/finance");
  await expect(page.getByRole("heading", { name: "Finance" })).toBeVisible();

  // --- Unallocated tray: assign the seeded "Unknown Glazing Supplies" bill to a project.
  // It renders both in the tray (above) and in the unfiltered inbox below, so target the first match.
  await expect(page.getByText("Unallocated tray")).toBeVisible();
  await page.getByRole("cell", { name: "Unknown Glazing Supplies" }).first().click();
  await expect(page.getByRole("dialog", { name: "Allocate bill" })).toBeVisible();
  await page.getByLabel("Project").click();
  await page.getByRole("option", { name: /Riverside Quarter Fitout/ }).click();
  await page.getByRole("button", { name: "Allocate" }).click();
  await expect(page.getByText("Bill allocated")).toBeVisible();

  // --- Bill review: the seeded INV-5102 starts Under review with only "ordered" confirmed. ---
  await page.getByRole("cell", { name: "INV-5102" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Under review")).toBeVisible();

  const approveButton = sheet.getByRole("button", { name: "Approve" });
  await expect(approveButton).toBeDisabled();

  // Confirm the three remaining checklist items.
  await sheet.getByLabel("Received? (delivery match)").click();
  await sheet.getByLabel("Right quantity?").click();
  await sheet.getByLabel("Right price?").click();

  await expect(approveButton).toBeEnabled();
  await approveButton.click();
  await expect(page.getByText("Bill updated")).toBeVisible();

  // Back in the inbox, the bill now shows Approved.
  await page.getByLabel("Bills inbox status filter").click();
  await page.getByRole("option", { name: "Approved" }).click();
  await expect(page.getByRole("cell", { name: "INV-5102" })).toBeVisible();
});
