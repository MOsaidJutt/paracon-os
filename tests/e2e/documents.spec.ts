import { test, expect } from "@playwright/test";
import path from "path";
import { cleanupFixture, writeTinyPngFixture, writeTextFixture } from "./helpers/fixtures";
import { createE2EProject } from "./helpers/entities";

// Requires the database to be seeded (npm run db:seed), the dev server running,
// and `npm run dev:storage` (a real local S3-compatible server) reachable —
// the upload flow does a real presigned PUT, not a stub.
//
// Each test creates its own throwaway project rather than attaching to seeded
// demo data (e.g. "Riverside Quarter Fitout") — these specs leave no teardown,
// and that project is what a real director sees in a sales demo.

test.describe("Documents panel — project", () => {
  test("director uploads a document, previews it inline, and adds a new version", async ({ page }) => {
    test.setTimeout(60_000); // two real uploads + a presigned round-trip per upload — slower than typical UI-only flows
    const pngPath = writeTinyPngFixture();
    const newVersionPath = writeTinyPngFixture("e2e-test-image-v2.png");
    const uploadedFileName = path.basename(pngPath);
    const newVersionFileName = path.basename(newVersionPath);

    try {
      await page.goto("/login");
      await page.getByLabel("Email").fill("director@paracon.com.au");
      await page.getByLabel("Password").fill("Demo1234!");
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL("/dashboard");

      const { projectName } = await createE2EProject(page, "Upload");
      await page.getByText(projectName).first().click();
      await page.waitForURL(/\/projects\/.+/);

      await page.getByRole("tab", { name: "Documents" }).click();
      await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();

      // Upload into the Site File category — scaffolded from the master project template.
      await page.getByRole("button", { name: "Upload" }).click();
      await page.getByLabel("File").setInputFiles(pngPath);
      await page.getByLabel("Category").click();
      await page.getByRole("option", { name: "Site File" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Upload", exact: true }).click();
      await expect(page.getByText("Document uploaded")).toBeVisible();

      // Shows up under the Site File section.
      await expect(page.getByText(uploadedFileName)).toBeVisible();

      const docRow = page.locator("div.flex.items-center.justify-between", { hasText: uploadedFileName });

      // Inline preview renders an actual <img>, not just a download link.
      await docRow.getByText(uploadedFileName).click();
      const previewImg = page.locator(`img[alt="${uploadedFileName}"]`);
      await expect(previewImg).toBeVisible();
      await page.keyboard.press("Escape");

      // New version — bumps to v2 and keeps the original retrievable via history.
      await docRow.getByTitle("Version history").click();
      await expect(page.getByText(`Version history — ${uploadedFileName}`)).toBeVisible();
      await page.getByLabel("New version file").setInputFiles(newVersionPath);
      await page.getByRole("button", { name: "New version", exact: true }).click();
      await expect(page.getByText("New version uploaded")).toBeVisible();
      await expect(page.getByText("v1")).toBeVisible(); // the superseded version now in history
      await page.keyboard.press("Escape");

      await expect(page.getByText(newVersionFileName)).toBeVisible();
    } finally {
      cleanupFixture(pngPath);
      cleanupFixture(newVersionPath);
    }
  });

  test("a non-previewable file type falls back to a download link instead of erroring", async ({ page }) => {
    const txtPath = writeTextFixture();
    const uploadedFileName = path.basename(txtPath);

    try {
      await page.goto("/login");
      await page.getByLabel("Email").fill("director@paracon.com.au");
      await page.getByLabel("Password").fill("Demo1234!");
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL("/dashboard");

      const { projectName } = await createE2EProject(page, "Preview");
      await page.getByText(projectName).first().click();
      await page.waitForURL(/\/projects\/.+/);
      await page.getByRole("tab", { name: "Documents" }).click();

      await page.getByRole("button", { name: "Upload" }).click();
      await page.getByLabel("File").setInputFiles(txtPath);
      await page.getByRole("dialog").getByRole("button", { name: "Upload", exact: true }).click();
      await expect(page.getByText("Document uploaded")).toBeVisible();

      await page.getByText(uploadedFileName).click();
      await expect(page.getByText("No inline preview available for this file type.")).toBeVisible();
      await expect(page.getByRole("link", { name: "Download to view" })).toBeVisible();
    } finally {
      cleanupFixture(txtPath);
    }
  });
});
