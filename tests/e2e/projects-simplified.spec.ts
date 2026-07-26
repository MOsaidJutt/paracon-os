import { test, expect } from "@playwright/test";
import { signIn, useSimplifiedView, usePreference } from "./helpers/view-mode";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
//
// /projects serves two layouts off the same route, branched server-side by view
// mode: Full renders ProjectRegisterTable unchanged (covered by
// projects-program.spec.ts / schedule-gantt.spec.ts / multi-project-gantt.spec.ts),
// Simplified renders ProjectsView's List/Gantt toggle plus the Module 4
// additions to the multi-project Gantt (baseline vs. current, RAG status,
// delay, the 10-column task table). Nothing here re-tests the register's own
// CRUD, the single-project Gantt's drag/dependency mechanics, or the
// cross-project snowball computation itself — all covered elsewhere and
// reused unchanged; this only exercises what's new for Simplified.

test("Projects' List/Gantt toggle switches the body and is remembered", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, "director@paracon.com.au");
  await useSimplifiedView(page);
  await page.goto("/projects");
  await usePreference(page, "projects.view", "LIST");

  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible({ timeout: 30_000 });
  const toggle = page.getByRole("group", { name: "Choose what to show" });
  await expect(toggle).toBeVisible({ timeout: 15_000 });

  // List is the default working surface: the register's Add-project button is on screen.
  await expect(page.getByRole("button", { name: "Add project" })).toBeVisible({ timeout: 15_000 });

  // Switching to Gantt swaps the body for the multi-project stacked Gantt.
  await toggle.getByRole("button", { name: "Gantt" }).click();
  await expect(page.getByText("Show baseline")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Add project" })).toHaveCount(0);

  // The choice survives a reload rather than resetting to the default.
  await page.reload();
  await expect(page.getByText("Show baseline")).toBeVisible({ timeout: 30_000 });

  // Restored through the API rather than a click — see pre-construction.spec.ts for why.
  await usePreference(page, "projects.view", "LIST");
  await expect(page.getByRole("button", { name: "Add project" })).toBeVisible({ timeout: 15_000 });
});

test("Responsible defaults to the project's PM, is editable, and the Simplified Gantt table shows baseline vs. current and delay", async ({
  page,
}) => {
  // /api/schedule/calendar now does several extra sequential Neon round trips
  // per Module 4 (baselines, delay records, dependencies, on top of the
  // existing project/worker/conflict queries) — observed 5-10s+ per query on
  // this dev connection, so the whole route can take well over 30s. This is
  // the last, heaviest step in an already multi-step test, so both the test
  // and its final assertion get generous headroom rather than the suite's
  // usual default.
  test.setTimeout(240_000);
  await signIn(page, "director@paracon.com.au");
  await useSimplifiedView(page);

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const clientName = `E2E Responsible Client ${suffix}`;
  const projectName = `E2E Responsible Project ${suffix}`;

  await page.goto("/contacts/clients");
  await page.getByRole("button", { name: "Add client" }).click();
  await page.getByLabel("Name").fill(clientName);
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "Pricing" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(clientName)).toBeVisible({ timeout: 20_000 });

  // Create the project with a PM assigned — Responsible has nothing meaningful
  // to default to otherwise.
  await usePreference(page, "projects.view", "LIST");
  await page.goto("/projects");
  await page.getByRole("button", { name: "Add project" }).click();
  await page.getByLabel("Project name").fill(projectName);
  await page.getByLabel("Code").fill(`E2E-${suffix.split("-")[1]}`);
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "On Track" }).click();
  await page.getByLabel("Client").click();
  await page.getByRole("option", { name: clientName }).click();
  await page.getByLabel("Project manager").click();
  const pmOption = page.getByRole("option").first();
  const pmName = (await pmOption.textContent())?.trim() ?? "";
  await pmOption.click();
  await page.getByLabel("Value ($)").fill("250000");

  const today = new Date();
  const day = (n: number) => new Date(today.getTime() + n * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Start date").fill(day(0));
  await page.getByLabel("End date").fill(day(20));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Project created")).toBeVisible({ timeout: 20_000 });

  await page.getByText(projectName).click();
  await page.waitForURL(/\/projects\/.+/, { timeout: 20_000 });
  await page.getByRole("tab", { name: "Program" }).click({ timeout: 20_000 });

  // Add an activity — Responsible is pre-filled with the PM's name without typing anything.
  // Trade is picked dynamically (not a hardcoded name like "Electrician")
  // because the trade list is a Config-driven, org-editable list — asserting
  // its exact membership isn't this test's job.
  await page.getByRole("button", { name: "Add activity" }).click();
  await page.getByLabel("Activity name").fill("Services rough-in");
  await page.getByLabel("Trade").click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Status", { exact: true }).click();
  await page.getByRole("option", { name: "On Track" }).click();
  await expect(page.getByLabel("Responsible")).toHaveValue(pmName);
  await page.getByLabel("Start date").fill(day(0));
  await page.getByLabel("End date").fill(day(5));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Activity added")).toBeVisible({ timeout: 20_000 });

  // Save a baseline capturing today's dates (Finish = day(5)).
  await page.getByRole("button", { name: "Save as baseline" }).click();
  await page.getByLabel("Name").fill("Original plan");
  await page.getByRole("button", { name: "Save baseline" }).click();
  await expect(page.getByText("Baseline saved")).toBeVisible({ timeout: 20_000 });

  // Push the finish date later (no dependency yet, so this is a plain save —
  // no delay-reason dialog) and hand the activity to a different tradesperson.
  await page.getByRole("cell", { name: "Services rough-in" }).click();
  await page.getByLabel("Responsible").fill("Jake - Lead Carpenter");
  await page.getByLabel("End date").fill(day(10));
  // Save is a PATCH, then the activities list re-fetches in the background —
  // reopening the row immediately after the toast would race that refetch and
  // could still read the pre-edit cache. Wait on the PATCH response itself.
  const [patchResponse] = await Promise.all([
    page.waitForResponse((res) => /\/api\/projects\/.+\/activities\/.+$/.test(res.url()) && res.request().method() === "PATCH"),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  expect(patchResponse.ok(), `activity update failed with ${patchResponse.status()}`).toBe(true);
  await expect(page.getByText("Activity updated")).toBeVisible({ timeout: 20_000 });
  // The tab is client-side state (not in the URL), so a reload lands back on Overview.
  await page.reload();
  await page.getByRole("tab", { name: "Program" }).click({ timeout: 20_000 });

  // Reopen it: Responsible persisted the edit rather than resetting to the PM default.
  await page.getByRole("cell", { name: "Services rough-in" }).click();
  await expect(page.getByLabel("Responsible")).toHaveValue("Jake - Lead Carpenter");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // The Simplified Gantt table (Module 4's new work): baseline vs. current
  // and the delay it produced, sourced from the same activity — not recomputed.
  // Set the preference without usePreference's own reload — we're still on
  // the (request-heavy) project detail page here, and the page.goto below is
  // already a full navigation that will pick up the fresh value; reloading
  // this page first only adds an unnecessary, slow extra page load.
  const prefOk = await page.evaluate(async () => {
    const res = await fetch("/api/preferences/projects.view", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "GANTT" }),
    });
    return res.ok;
  });
  expect(prefOk, "failed to set projects.view preference").toBe(true);
  await page.goto("/projects");
  await expect(page.getByRole("columnheader", { name: "Baseline Start" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("columnheader", { name: "Baseline Finish" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Current Start" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Current Finish" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Status" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Delay" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Impact Reason" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Linked Predecessor" })).toBeVisible();

  const row = page.getByRole("row", { name: /Services rough-in/ });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row.getByText("Jake - Lead Carpenter")).toBeVisible();
  // Baseline Finish (captured before the push) and Current Finish (after) now
  // read as two different dates, and the delay column encodes the 5-day slip
  // between them — read from the same activity, not recomputed independently.
  await expect(row.getByText("+5d")).toBeVisible();

  await usePreference(page, "projects.view", "LIST");
});

test("Financials becomes a Variations tab in Simplified, reusing the existing register", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, "director@paracon.com.au");
  await useSimplifiedView(page);

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const clientName = `E2E Variations Client ${suffix}`;
  const projectName = `E2E Variations Project ${suffix}`;

  await page.goto("/contacts/clients");
  await page.getByRole("button", { name: "Add client" }).click();
  await page.getByLabel("Name").fill(clientName);
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "Pricing" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(clientName)).toBeVisible({ timeout: 20_000 });

  await usePreference(page, "projects.view", "LIST");
  await page.goto("/projects");
  await page.getByRole("button", { name: "Add project" }).click();
  await page.getByLabel("Project name").fill(projectName);
  await page.getByLabel("Code").fill(`E2E-${suffix.split("-")[1]}`);
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "On Track" }).click();
  await page.getByLabel("Client").click();
  await page.getByRole("option", { name: clientName }).click();
  await page.getByLabel("Value ($)").fill("250000");
  const today = new Date();
  const day = (n: number) => new Date(today.getTime() + n * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Start date").fill(day(0));
  await page.getByLabel("End date").fill(day(20));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Project created")).toBeVisible({ timeout: 20_000 });

  await page.getByText(projectName).click();
  await page.waitForURL(/\/projects\/.+/, { timeout: 20_000 });

  // Simplified shows "Variations", not "Financials" — and the tab renders
  // VariationsRegister untouched, not the full FinancialsTab.
  await expect(page.getByRole("tab", { name: "Variations" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("tab", { name: "Financials" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Variations" }).click();
  await expect(page.getByText("No variations yet")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Approved variations")).toHaveCount(0);
});
