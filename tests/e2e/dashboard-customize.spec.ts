import { test, expect } from "@playwright/test";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
// Covers the Xero-style "edit dashboard" ask: a user can hide/show dashboard
// widgets and the choice survives a reload (the DashboardLayout table
// round-trip). Restores the Alerts widget to visible at the end of the test
// so it doesn't leave director@paracon.com.au's layout in a state that would
// break the other dashboard specs sharing that account.
test("hiding a widget in customize mode persists across reload, and can be shown again", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/login");
  await page.getByLabel("Email").fill("director@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  await expect(page.getByRole("button", { name: "Customize" })).toBeVisible({ timeout: 30_000 });

  // Hide the Alerts widget.
  await page.getByRole("button", { name: "Customize" }).click();
  const alertsWidget = page.locator('[data-widget-id="alerts"]');
  await expect(alertsWidget).toBeVisible();
  await alertsWidget.getByRole("button", { name: "Hide widget" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Customize" })).toBeVisible({ timeout: 15_000 });

  // The hide persisted server-side — a fresh page load doesn't render it.
  await page.reload();
  await expect(page.getByRole("button", { name: "Customize" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-widget-id="alerts"]')).toHaveCount(0);

  // Restore it so the rest of the suite (and re-runs) see the default layout.
  await page.getByRole("button", { name: "Customize" }).click();
  const hiddenAlertsWidget = page.locator('[data-widget-id="alerts"]');
  await expect(hiddenAlertsWidget).toBeVisible();
  await hiddenAlertsWidget.getByRole("button", { name: "Show widget" }).click();
  await page.getByRole("button", { name: "Done" }).click();

  await page.reload();
  await expect(page.locator('[data-widget-id="alerts"]')).toBeVisible({ timeout: 30_000 });
});

// Covers keyboard-accessible reordering (dnd-kit's built-in keyboard sensor).
// Rather than asserting an exact post-move grid position (dnd-kit's keyboard
// coordinate getter steps by measured rect size, which isn't stable to pin
// down across viewports/CI), this confirms the drag handle is reachable and
// operable by keyboard alone — focusable, and Space registers a pickup with
// dnd-kit's own screen-reader live-region announcement ("Draggable item ...
// was picked up"), which is the same mechanism a screen-reader user relies on.
test("a widget's drag handle is keyboard-operable while customizing", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/login");
  await page.getByLabel("Email").fill("director@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  await expect(page.getByRole("button", { name: "Customize" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Customize" }).click();

  const firstHandle = page.locator("[data-widget-id]").first().getByRole("button", { name: "Drag to reorder" });
  await firstHandle.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("status")).toContainText("Draggable item", { timeout: 10_000 });

  // Escape cancels the drag cleanly, leaving the layout untouched.
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Done" }).click();
});
