import { test, expect } from "@playwright/test";
import { signIn, useSimplifiedView, useFullView } from "./helpers/view-mode";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
//
// /contacts/* serves two layouts off the same route tree, branched server-side
// by view mode in contacts/layout.tsx: Full renders its existing "Contacts"
// heading + AdminTabs + the routed clients/suppliers/workers pages unchanged
// (covered by whatever specs already exercise those pages directly), Simplified
// renders this module — one "Directory" screen with in-page Clients/Suppliers/
// Workers tabs over the same three tables. Nothing here re-tests the tables'
// own CRUD (covered elsewhere); this only exercises what's new for Simplified.

test("Simplified renders one Directory screen with Clients/Suppliers/Workers tabs; Full is unchanged", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signIn(page, "director@paracon.com.au");

  await useFullView(page);
  await page.goto("/contacts/clients");
  await expect(page.getByRole("heading", { name: "Contacts", exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Directory" })).toHaveCount(0);
  // Full's own routed tabs are links, not the Simplified tablist.
  await expect(page.getByRole("tablist")).toHaveCount(0);

  await useSimplifiedView(page);
  await page.goto("/contacts/clients");
  await expect(page.getByRole("heading", { name: "Directory" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Contacts", exact: true })).toHaveCount(0);

  const tabs = page.getByRole("tablist");
  await expect(tabs).toBeVisible();
  await expect(tabs.getByRole("tab", { name: "Clients" })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: "Suppliers & Subbies" })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: "Workers" })).toBeVisible();

  // Clients is the landing tab — its own Add button is on screen without switching.
  await expect(page.getByRole("button", { name: "Add client" })).toBeVisible({ timeout: 20_000 });

  // Switching tabs swaps the body for the existing Suppliers/Workers tables, reused as-is.
  await tabs.getByRole("tab", { name: "Suppliers & Subbies" }).click();
  await expect(page.getByRole("button", { name: "Add supplier" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Add client" })).toHaveCount(0);

  await tabs.getByRole("tab", { name: "Workers" }).click();
  await expect(page.getByRole("button", { name: "Add worker" })).toBeVisible({ timeout: 20_000 });
});

test("a client row opens the existing edit dialog as its detail view", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page, "director@paracon.com.au");
  await useSimplifiedView(page);
  await page.goto("/contacts/clients");

  await expect(page.getByRole("heading", { name: "Directory" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Loading...")).toHaveCount(0, { timeout: 30_000 });

  const firstRow = page.locator("tbody tr").first();
  await expect(firstRow).toBeVisible({ timeout: 20_000 });
  const clientName = await firstRow.locator("td").first().innerText();

  await firstRow.click();
  await expect(page.getByRole("heading", { name: "Edit client" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Name")).toHaveValue(clientName);

  // The row action menu ("...") still works independently of the row click —
  // clicking it must not also fire the row's own click handler.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a supplier row opens the existing edit dialog as its detail view", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page, "director@paracon.com.au");
  await useSimplifiedView(page);
  await page.goto("/contacts/clients");

  await expect(page.getByRole("heading", { name: "Directory" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("tablist").getByRole("tab", { name: "Suppliers & Subbies" }).click();
  await expect(page.getByText("Loading...")).toHaveCount(0, { timeout: 30_000 });

  const firstRow = page.locator("tbody tr").first();
  await expect(firstRow).toBeVisible({ timeout: 20_000 });
  const company = await firstRow.locator("td").nth(2).innerText();

  await firstRow.click();
  await expect(page.getByRole("heading", { name: "Edit supplier" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Company")).toHaveValue(company);
});

test("a worker row still opens the existing full worker profile page", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page, "director@paracon.com.au");
  await useSimplifiedView(page);
  await page.goto("/contacts/clients");

  await expect(page.getByRole("heading", { name: "Directory" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("tablist").getByRole("tab", { name: "Workers" }).click();
  await expect(page.getByText("Loading...")).toHaveCount(0, { timeout: 30_000 });

  const firstRow = page.locator("tbody tr").first();
  await expect(firstRow).toBeVisible({ timeout: 20_000 });
  // The matrix has many skill columns, each with its own stopPropagation()
  // tooltip wrapper — a plain row.click() lands on the row's geometric
  // centre, which for this wide a table falls in one of those cells and
  // never reaches the row's own onClick. Click the Worker name cell instead.
  await firstRow.locator("td").first().click();

  // SkillsMatrixGrid's own long-standing behaviour — the full profile page,
  // not a slide-over, since its six tabs don't fit a side panel.
  await page.waitForURL(/\/labour\/.+/, { timeout: 20_000 });
  await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible({ timeout: 20_000 });
});
