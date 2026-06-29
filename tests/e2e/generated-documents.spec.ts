import { test, expect } from "@playwright/test";
import { createE2EProject } from "./helpers/entities";

// Requires the database to be seeded (npm run db:seed) and the dev server running —
// same preconditions as documents.spec.ts. Each test creates its own throwaway
// project rather than touching seeded demo data.

test.describe("Generated documents — Variation & Progress Claim", () => {
  test("enters trade packages once, generates a Variation, changes its status, previews it, then generates a Progress Claim off the same trade packages", async ({
    page,
  }) => {
    test.setTimeout(90_000); // PDF + Excel rendering on the server per generate/regenerate call, twice

    // createE2EProject needs /contacts/clients to create the throwaway client first —
    // project-manager doesn't have tender.view, so this uses director (matches
    // documents.spec.ts's convention for the same reason).
    await page.goto("/login");
    await page.getByLabel("Email").fill("director@paracon.com.au");
    await page.getByLabel("Password").fill("Demo1234!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("/dashboard");

    const { projectName } = await createE2EProject(page, "Docs");
    await page.getByText(projectName).first().click();
    await page.waitForURL(/\/projects\/.+/);

    await page.getByRole("tab", { name: "Documents" }).click();
    await expect(page.getByText("Trade Packages")).toBeVisible();

    // Enter once: the trade breakdown is set here, then reused by both the
    // Variation's project context and the Progress Claim's Contract Work rows.
    await page.getByRole("button", { name: "Add trade" }).click();
    await page.getByLabel("Trade").fill("Partitions");
    await page.getByLabel("Contract value ($)").fill("200000");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Trade packages saved")).toBeVisible();

    // Generate a Variation — Company is pre-filled from the project's client,
    // never retyped.
    await page.getByRole("button", { name: "New Variation" }).click();
    await expect(page.getByRole("dialog", { name: "Generate Variation Quotation" })).toBeVisible();
    await expect(page.getByLabel("Company")).not.toHaveValue("");
    await page.getByLabel("Attention").fill("Site Manager");
    await page.getByLabel("From").fill("E2E Test PM");
    await page.getByLabel("Line 1 description").fill("Additional patch and paint works");
    await page.getByLabel("Line 1 amount").fill("4500");
    await page.getByLabel("Sign-off name").fill("E2E Test PM");
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await expect(page.getByText("Variation generated")).toBeVisible({ timeout: 15_000 }); // real PDF + Excel render + storage round-trip

    // Auto-numbered VQ-01, defaults to Issued.
    await expect(page.getByText("VQ-01")).toBeVisible();
    const statusBadge = page.getByRole("button", { name: "Issued" });
    await expect(statusBadge).toBeVisible();

    // Status is a real, settable field — not folder-name encoded.
    await statusBadge.click();
    await page.getByRole("menuitem", { name: "Mark as Withdrawn" }).click();
    await expect(page.getByText("Status updated")).toBeVisible();
    await expect(page.getByRole("button", { name: "Withdrawn" })).toBeVisible();

    // Inline preview reuses the existing Documents panel's PDF viewer.
    await page.getByTitle("Preview").click();
    const previewDialog = page.getByRole("dialog").filter({ hasText: "VQ-01" });
    await expect(previewDialog).toBeVisible();
    await expect(page.locator("iframe").first()).toBeVisible();
    await previewDialog.getByRole("button", { name: "Close" }).click();
    await expect(previewDialog).toBeHidden();

    // Progress Claim reads the same Contract Work line — no re-entry.
    await page.getByRole("button", { name: "New Progress Claim" }).click();
    await expect(page.getByRole("dialog", { name: "Generate Progress Claim" })).toBeVisible();
    await expect(page.getByText("Partitions")).toBeVisible();
    await expect(page.getByText("$200,000")).toBeVisible();
    await page.getByLabel("Partitions percent complete").fill("50");
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await expect(page.getByText("Progress claim generated")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Claim #1")).toBeVisible();
  });
});
