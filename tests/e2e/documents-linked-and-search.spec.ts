import { test, expect } from "@playwright/test";
import { createE2ETender } from "./helpers/entities";
import { usePreference } from "./helpers/view-mode";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
// Linked documents never touch storage (a saved Drive URL + metadata only), so
// this spec has no dependency on the local S3-compatible test server.

test("director adds a Google Drive link to a tender, and it's findable via global search", async ({ page }) => {
  const linkName = `E2E Drawing Set ${Date.now()}`;

  await page.goto("/login");
  await page.getByLabel("Email").fill("director@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  // A throwaway tender, not the seeded demo tender — this spec leaves no
  // teardown, and the seeded data is what a real director sees in a demo.
  const { tenderName } = await createE2ETender(page, "Link");

  // Tenders have no dedicated detail page, so the unified Documents panel
  // lives inline in the edit sheet. /tenders now branches on view mode; force
  // the register tab so the row is on screen regardless of what a previous
  // spec left this account on.
  await page.goto("/tenders");
  await usePreference(page, "preconstruction.view", "REGISTER");
  await page.getByText(tenderName).first().click();
  await expect(page.getByRole("heading", { name: "Edit tender" })).toBeVisible();

  await page.getByRole("button", { name: "Add Drive link" }).click();
  await page.getByLabel("Name", { exact: true }).fill(linkName);
  await page.getByLabel("Google Drive URL").fill("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz");
  await page.getByLabel("Kind", { exact: true }).click();
  await page.getByRole("option", { name: "Drawing Set" }).click();
  await page.getByRole("button", { name: "Add link" }).click();
  await expect(page.getByText("Drive link added")).toBeVisible();

  // Shows up in the unified panel, tagged as a Drive link (no separate workflow).
  await expect(page.getByText(linkName)).toBeVisible();
  await expect(page.getByText("Drive link").first()).toBeVisible();

  await page.keyboard.press("Escape");

  // Global search (Cmd/Ctrl+K) finds it — documents are searchable regardless of stored vs linked.
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Search projects, tenders, workers, documents...").fill(linkName);
  await expect(page.getByText("Documents", { exact: true })).toBeVisible();
  await expect(page.getByText(linkName).first()).toBeVisible();

  // Hovering reveals key fields without an extra click — the brief's "no extra clicks" rule.
  await page.getByText(linkName).first().hover();
  await expect(page.getByText("Google Drive (linked)")).toBeVisible();
});

test("global search finds a project and a tender by name with hover-preview fields", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("director@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Search projects, tenders, workers, documents...").fill("Riverside");
  await expect(page.getByText("Projects", { exact: true })).toBeVisible();
  await expect(page.getByText("Riverside Quarter Fitout").first()).toBeVisible();

  await page.getByText("Riverside Quarter Fitout").first().hover();
  await expect(page.getByText("On Track")).toBeVisible();

  await page.getByPlaceholder("Search projects, tenders, workers, documents...").fill("Yarra");
  await expect(page.getByText("Tenders", { exact: true })).toBeVisible();
  await expect(page.getByText("Yarra Quarter Stage 2 Fitout")).toBeVisible();
});
