import { test, expect } from "@playwright/test";
import { resetDashboardLayout, resetKpiSlots, signIn, useFullView, useSimplifiedView } from "./helpers/view-mode";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
// The simplified dashboard composes the same server-side work the Director
// dashboard does (project health, the forecast engine, tender pipeline, alerts)
// plus the worker-KPI reads — the generous timeouts below account for that.

test("the simplified dashboard shows the three bands and never navigates away for detail", async ({ page }) => {
  test.setTimeout(150_000);
  await signIn(page, "director@paracon.com.au");
  await useSimplifiedView(page);
  await resetDashboardLayout(page, "simple");
  await resetKpiSlots(page);

  // Band A — the north-star rings. Each is a button, not a link.
  await expect(page.getByRole("button", { name: /Revenue won, open detail/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /Projects on track, open detail/ })).toBeVisible();

  // Band B — delivery.
  await expect(page.getByText("Project health")).toBeVisible();
  await expect(page.getByText("Can we take on more work?")).toBeVisible();

  // Band C — what needs attention today.
  await expect(page.getByText("My checklist")).toBeVisible();

  // A ring opens its explanation beside the page rather than routing away.
  await page.getByRole("button", { name: /Revenue won, open detail/ }).click();
  await expect(page.getByText("How this is worked out")).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL("/dashboard");
  await page.keyboard.press("Escape");

  // So does a project row, and it carries that project's inline activity trail.
  await page.getByRole("button", { name: /Riverside Quarter Fitout/ }).first().click();
  await expect(page.getByText(/Why it reads/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Activity" })).toBeVisible();
  await expect(page).toHaveURL("/dashboard");
  await page.keyboard.press("Escape");

  // A worker KPI bar opens its ranked breakdown, fetched on demand.
  await page.getByRole("button", { name: /Compliance current/ }).first().click();
  await expect(page.getByText("Ranked worst first")).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL("/dashboard");
  await page.keyboard.press("Escape");
});

test("ticking a checklist item persists across a reload", async ({ page }) => {
  test.setTimeout(150_000);
  await signIn(page, "director@paracon.com.au");
  await useSimplifiedView(page);
  await resetDashboardLayout(page, "simple");
  await resetKpiSlots(page);

  const item = page.getByRole("checkbox", { name: "Review yesterday's site updates" });
  await expect(item).toBeVisible({ timeout: 30_000 });

  const wasChecked = (await item.getAttribute("aria-checked")) === "true";
  await item.click();
  await expect(item).toHaveAttribute("aria-checked", String(!wasChecked), { timeout: 10_000 });

  await page.reload();
  const afterReload = page.getByRole("checkbox", { name: "Review yesterday's site updates" });
  await expect(afterReload).toHaveAttribute("aria-checked", String(!wasChecked), { timeout: 30_000 });

  // Put it back so a re-run starts from the same state.
  await afterReload.click();
  await expect(afterReload).toHaveAttribute("aria-checked", String(wasChecked), { timeout: 10_000 });
});

test("customising swaps a ring metric and hides a widget, and both survive a reload", async ({ page }) => {
  test.setTimeout(150_000);
  await signIn(page, "director@paracon.com.au");
  await useSimplifiedView(page);
  await resetDashboardLayout(page, "simple");
  await resetKpiSlots(page);

  await expect(page.getByRole("button", { name: "Customise" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Customise" }).click();

  // Swap ring 1 from Revenue won to Compliance current.
  await page.getByRole("combobox", { name: "Metric for ring 1" }).click();
  await page.getByRole("option", { name: "Compliance current" }).click();

  // Hide the checklist.
  await page.getByRole("button", { name: "Hide My checklist" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  // The panel closes only once both writes have landed, so its disappearance
  // is the signal that saving finished. Reloading straight after the click
  // would cancel the requests mid-flight instead of testing them.
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0, { timeout: 20_000 });

  await page.reload();
  await expect(page.getByRole("button", { name: /Compliance current, open detail/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("My checklist")).toHaveCount(0);

  // Restore the defaults so the other simplified specs see a clean layout.
  await page.getByRole("button", { name: "Customise" }).click();
  await page.getByRole("button", { name: "Reset to default" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  // The panel closes only once both writes have landed, so its disappearance
  // is the signal that saving finished. Reloading straight after the click
  // would cancel the requests mid-flight instead of testing them.
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0, { timeout: 20_000 });

  await page.reload();
  await expect(page.getByText("My checklist")).toBeVisible({ timeout: 30_000 });
});

test("the view toggle switches between the five simplified modules and the full nav", async ({ page }) => {
  test.setTimeout(150_000);
  await signIn(page, "director@paracon.com.au");

  await useSimplifiedView(page);
  await resetDashboardLayout(page, "simple");
  await resetKpiSlots(page);
  // The five modules, named as the client agreed them.
  await expect(page.getByRole("link", { name: "Pre-Construction" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Directory" })).toBeVisible();
  // Nothing built has been deleted — Finance is simply not in this view.
  await expect(page.getByRole("link", { name: "Finance" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Resource Planner" })).toHaveCount(0);

  await useFullView(page);
  await expect(page.getByRole("link", { name: "Finance" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Resource Planner" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tenders" })).toBeVisible();

  // Finance is reachable and intact from the Full view.
  await page.getByRole("link", { name: "Finance" }).click();
  await expect(page.getByRole("heading", { name: "Finance" })).toBeVisible({ timeout: 30_000 });

  // The preference survives a reload rather than resetting to the default.
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Finance" })).toBeVisible({ timeout: 30_000 });

  await useSimplifiedView(page);
  await resetDashboardLayout(page, "simple");
  await resetKpiSlots(page);
});

test("an estimator lands on the same simplified page with only the sections their role covers", async ({ page }) => {
  test.setTimeout(150_000);
  await signIn(page, "estimator@paracon.com.au");
  await useSimplifiedView(page);
  await resetDashboardLayout(page, "simple");
  await resetKpiSlots(page);

  // Tender metrics are theirs, and the ring row still fills to four by
  // back-filling from what their role covers rather than leaving gaps.
  await expect(page.getByRole("button", { name: /Revenue won, open detail/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /, open detail/ })).toHaveCount(4);

  // Labour capacity and project health are not theirs. The widgets aren't
  // rendered empty, they're absent.
  await expect(page.getByText("Can we take on more work?")).toHaveCount(0);
  await expect(page.getByText("Project health")).toHaveCount(0);
  // Nor is any labour-derived bar — the estimator holds scorecard.view, so a
  // scorecard average legitimately shows, but attendance and compliance
  // (labour.view) must not.
  await expect(page.getByText("Attendance")).toHaveCount(0);
  await expect(page.getByText("Compliance current")).toHaveCount(0);
});
