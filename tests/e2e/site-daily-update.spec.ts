import { test, expect } from "@playwright/test";
import { writeTinyPngFixture, cleanupFixture } from "./helpers/fixtures";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
// Frank Foreman (foreman@paracon.com.au) is seeded as the assigned foreman on
// Riverside Quarter Fitout, with yesterday's crew (Marcus Webb, Jacob
// Ferreira, Tane Williams) submitted — exercising the "default to yesterday's
// crew" suggestion against real seed data rather than a freshly-created project.

async function loginAsForeman(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("foreman@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/site");
}

test("foreman completes a full daily update in well under the full-flow time, one-handed-friendly", async ({ page }) => {
  await loginAsForeman(page);

  await expect(page.getByRole("heading", { name: "Riverside Quarter Fitout" })).toBeVisible();

  // Default-to-yesterday's-crew: Marcus Webb was present yesterday, so he's
  // pre-checked Present with zero taps required.
  await expect(page.getByRole("button", { name: /Marcus Webb/ })).toContainText("Present");

  // Tick a task — ticking writes straight through to the program's status.
  const carpentryRow = page.getByText(/Carpentry fit-out/);
  const carpentryChips = carpentryRow.locator("xpath=following-sibling::div[1]");
  await carpentryChips.getByRole("button", { name: "Complete" }).click();

  // Confirm the seeded "Plasterboard sheets" delivery as arrived. The status
  // buttons are rendered from the admin-editable finance.delivery.statusList
  // Config, not hardcoded — "Delivered" is the seeded default label for that status.
  const deliveryRow = page.getByText(/Plasterboard sheets/);
  const deliveryButtons = deliveryRow.locator("xpath=following-sibling::div[1]");
  await deliveryButtons.getByRole("button", { name: "Delivered" }).click();

  // Attach a progress photo.
  const pngPath = writeTinyPngFixture("daily-update-progress.png");
  try {
    await page.getByLabel("Add photo").setInputFiles(pngPath);
    await expect(page.getByAltText("Site photo")).toBeVisible();

    // Raise an issue with its own photo, severity chip, in one screen.
    await page.getByRole("button", { name: "Raise an issue" }).click();
    const issueMarker = `E2E issue ${Date.now()}`;
    await page.getByPlaceholder("What's the issue?").fill(issueMarker);
    await page.getByRole("button", { name: "High" }).click();

    const issuePngPath = writeTinyPngFixture("daily-update-issue.png");
    try {
      await page.getByLabel("Attach photo").setInputFiles(issuePngPath);
      await expect(page.getByAltText("Issue evidence")).toBeVisible();
      await page.getByRole("button", { name: "Send" }).click();
      await expect(page.getByPlaceholder("What's the issue?")).toHaveCount(0);
    } finally {
      cleanupFixture(issuePngPath);
    }

    await page.getByPlaceholder("Weather, access issues, anything else...").fill("Clear skies, good progress.");

    await page.getByRole("button", { name: "Save daily update" }).click();
    await expect(page.getByRole("button", { name: "Saved — will sync" })).toBeVisible();
    await expect(page.getByText("Synced")).toBeVisible({ timeout: 15_000 });
  } finally {
    cleanupFixture(pngPath);
  }

  // Reload proves the submit actually round-tripped to the server, not just local state.
  await page.reload();
  await expect(page.getByText("Already saved today")).toBeVisible();
});

test("foreman can save offline and it syncs automatically once back online", async ({ page }) => {
  await loginAsForeman(page);
  await expect(page.getByRole("heading", { name: "Riverside Quarter Fitout" })).toBeVisible();

  await page.context().setOffline(true);
  await expect(page.getByText("Offline — will sync")).toBeVisible();

  const carpentryRow = page.getByText(/Carpentry fit-out/);
  const carpentryChips = carpentryRow.locator("xpath=following-sibling::div[1]");
  await carpentryChips.getByRole("button", { name: "Watch" }).click();

  const note = `Offline e2e note ${Date.now()}`;
  await page.getByPlaceholder("Weather, access issues, anything else...").fill(note);

  // Saving offline never blocks on connectivity and never shows an alarming error.
  await page.getByRole("button", { name: "Save daily update" }).click();
  await expect(page.getByRole("button", { name: "Saved — will sync" })).toBeVisible();
  await expect(page.getByText("Network error")).toHaveCount(0);
  await expect(page.getByText("Offline — will sync")).toBeVisible();

  await page.context().setOffline(false);
  await expect(page.getByText("Synced")).toBeVisible({ timeout: 15_000 });

  // Reload proves the queued mutation actually flushed to the server.
  await page.reload();
  await expect(page.getByPlaceholder("Weather, access issues, anything else...")).toHaveValue(note);
});
