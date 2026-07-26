import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { DASHBOARD_WIDGETS, type DashboardKey } from "../../../lib/dashboard/widget-registry";
import { DEFAULT_KPI_SLOTS, RING_SLOT_COUNT } from "../../../lib/dashboard/kpi-slots";

/**
 * The Simplified/Full switch persists per user, so a spec that leaves an
 * account in one view would decide what the next spec sees. Every spec that
 * cares therefore sets its own view at the start rather than relying on the
 * default or on cleanup — that keeps the suite order-independent even when an
 * earlier test fails partway through.
 */
async function switchTo(page: Page, label: "Simplified" | "Full") {
  const toggle = page.getByRole("group", { name: "Choose how much of the app to show" });
  await expect(toggle).toBeVisible({ timeout: 30_000 });

  const button = toggle.getByRole("button", { name: label });
  if ((await button.getAttribute("aria-pressed")) === "true") return;

  // aria-pressed is optimistic by design — the segment moves the instant it's
  // clicked so the control feels immediate, well before the preference has
  // been written. Waiting on the write itself is the only signal that the
  // server will now render the new view; reloading on the optimistic state
  // races the request and re-renders the old one.
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("/api/preferences/view-mode") && res.request().method() === "PUT",
      { timeout: 20_000 }
    ),
    button.click(),
  ]);
  expect(response.ok(), `view-mode save failed with ${response.status()}`).toBe(true);

  // Now a reload is guaranteed to render the stored preference.
  await page.reload();

  // Park the pointer away from the content. Clicking leaves the cursor where it
  // landed, and the re-layout underneath it is enough to open a hover card on
  // whatever ends up under the mouse — which then looks like content that was
  // already revealed.
  await page.mouse.move(0, 0);
}

/** Puts the signed-in user into the Full view — every screen built through phases 0-18. */
export async function useFullView(page: Page) {
  await switchTo(page, "Full");
}

/** Puts the signed-in user into the Simplified view — the five-module default. */
export async function useSimplifiedView(page: Page) {
  await switchTo(page, "Simplified");
}

/** Signs in and lands on the dashboard. Every dashboard spec starts this way. */
export async function signIn(page: Page, email: string, password = "Demo1234!") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");
}

/**
 * Puts a dashboard's widget layout back to the registry default for the
 * signed-in user.
 *
 * Call this at the START of any spec that hides a widget, not only at the end.
 * A layout lives in the database against the shared demo account, so a spec
 * that fails partway through leaves a widget hidden for every run afterwards —
 * which is precisely how three passing specs turned red once one customise
 * test aborted before its restore step. Cleaning up on the way out only works
 * when nothing goes wrong; resetting on the way in works regardless.
 *
 * Writes through the same /api/dashboard/layout endpoint the UI uses, so it
 * exercises the real contract rather than reaching past it into the database.
 */
export async function resetDashboardLayout(page: Page, dashboardKey: DashboardKey) {
  const widgets = DASHBOARD_WIDGETS[dashboardKey].map((widget) => ({
    id: widget.id,
    visible: widget.defaultVisible ?? true,
  }));

  const ok = await page.evaluate(
    async ({ key, defaults }) => {
      const res = await fetch("/api/dashboard/layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboardKey: key, widgets: defaults }),
      });
      return res.ok;
    },
    { key: dashboardKey, defaults: widgets }
  );

  expect(ok, `failed to reset the "${dashboardKey}" dashboard layout`).toBe(true);
  await page.reload();
}

/**
 * Puts the four north-star ring slots back to their defaults for the
 * signed-in user. Same rationale as resetDashboardLayout: a spec that swaps a
 * ring and fails before restoring would otherwise change what every later run
 * sees.
 *
 * Reads `available` from the API first and intersects with the defaults,
 * because a restricted role can't be assigned a metric its permissions don't
 * cover — the endpoint rejects it, correctly.
 */
export async function resetKpiSlots(page: Page) {
  const ok = await page.evaluate(
    async ({ defaults, ringCount }) => {
      const listed = await fetch("/api/dashboard/kpi-slots");
      if (!listed.ok) return false;
      const { available } = (await listed.json()) as { available: { id: string }[] };

      const allowed = available.map((slot) => slot.id);
      const slots = [...defaults.filter((id) => allowed.includes(id)), ...allowed]
        .filter((id, index, all) => all.indexOf(id) === index)
        .slice(0, ringCount);
      if (slots.length === 0) return true;

      const saved = await fetch("/api/dashboard/kpi-slots", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
      });
      return saved.ok;
    },
    { defaults: DEFAULT_KPI_SLOTS as string[], ringCount: RING_SLOT_COUNT }
  );

  expect(ok, "failed to reset the KPI ring slots").toBe(true);
  await page.reload();
}
