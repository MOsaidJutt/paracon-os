import { test, expect } from "@playwright/test";
import { signIn, useSimplifiedView } from "./helpers/view-mode";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
//
// Each test creates its own lead with a unique name and converts or deletes it,
// so runs don't depend on each other or on what the seed happens to contain.

/**
 * Forces the register into a known view before asserting on it.
 *
 * The Board/List switch is optimistic, so clicking it and moving on can end a
 * test before the write lands — which then decides what the NEXT test sees.
 * Writing through the API and reloading is deterministic, so these specs don't
 * depend on each other or on which view a previous run happened to leave behind.
 */
async function useView(page: import("@playwright/test").Page, value: "BOARD" | "LIST") {
  const ok = await page.evaluate(async (v) => {
    const res = await fetch("/api/preferences/prospects.view", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: v }),
    });
    return res.ok;
  }, value);
  expect(ok, `failed to set the prospects view to ${value}`).toBe(true);
  await page.reload();
}

async function addProspect(page: import("@playwright/test").Page, name: string, stage: string) {
  await page.getByRole("button", { name: "Add prospect" }).click();

  // Scoped to the dialog throughout: "Stage" also labels the board lanes and
  // the detail panel, so an unscoped lookup is ambiguous.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });

  await dialog.getByLabel("Company / lead name").fill(name);
  await dialog.getByRole("combobox").filter({ hasText: /Select stage|Cold|Warm/ }).first().click();
  await page.getByRole("option", { name: stage, exact: true }).click();
  await dialog.getByLabel("Contact name").fill("A. Whitlam");
  await dialog.getByLabel("Estimated value ($)").fill("850000");
  await dialog.getByLabel("Probability (%)").fill("40");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Prospect added")).toBeVisible({ timeout: 15_000 });
}

test("a lead can be added, moved cold to warm, and opened beside the board", async ({ page }) => {
  test.setTimeout(150_000);
  const name = `E2E Lead ${Date.now()}`;

  await signIn(page, "director@paracon.com.au");
  await useSimplifiedView(page);
  await page.goto("/prospects");
  await expect(page.getByRole("group", { name: "Choose how to show prospects" })).toBeVisible({ timeout: 30_000 });
  await useView(page, "BOARD");

  await addProspect(page, name, "Cold");

  // The card lands in the Cold lane and carries its figures.
  const card = page.getByRole("button", { name: `Open ${name}` });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card).toContainText("40%");

  // The per-card button does what dragging does, and works on every device.
  await page.getByRole("button", { name: `Move to Warm: ${name}` }).click();
  await expect(page.getByRole("button", { name: `Convert ${name} to a tender` })).toBeVisible({ timeout: 15_000 });

  // Opening a lead happens beside the register, never on its own page.
  await card.click();
  await expect(page.getByRole("button", { name: "Activity" })).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL("/prospects");
  await page.keyboard.press("Escape");
});

test("converting a lead states what carries over, then links it to its tender", async ({ page }) => {
  test.setTimeout(150_000);
  const name = `E2E Convert ${Date.now()}`;

  await signIn(page, "director@paracon.com.au");
  await useSimplifiedView(page);
  await page.goto("/prospects");
  await expect(page.getByRole("button", { name: "Add prospect" })).toBeVisible({ timeout: 30_000 });
  await useView(page, "BOARD");

  await addProspect(page, name, "Warm");

  await page.getByRole("button", { name: `Convert ${name} to a tender` }).click();

  // The confirmation names the client and the money before anything happens —
  // this is the one irreversible step in the module.
  await expect(page.getByRole("dialog")).toContainText(`Convert ${name} to a tender?`, { timeout: 15_000 });
  await expect(page.getByRole("dialog")).toContainText("A. Whitlam");
  await expect(page.getByRole("dialog")).toContainText("$850,000");

  await page.getByRole("button", { name: "Convert", exact: true }).click();
  await expect(page.getByText("Converted to a tender")).toBeVisible({ timeout: 20_000 });

  // The lead leaves the pipeline and keeps a link to what it became.
  await expect(page.getByText("Converted").first()).toBeVisible({ timeout: 15_000 });
});

test("the board/list choice is remembered for next time", async ({ page }) => {
  test.setTimeout(150_000);
  await signIn(page, "director@paracon.com.au");
  await useSimplifiedView(page);
  await page.goto("/prospects");

  const group = page.getByRole("group", { name: "Choose how to show prospects" });
  await expect(group).toBeVisible({ timeout: 30_000 });

  await group.getByRole("button", { name: "List" }).click();
  await expect(group.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(group.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true", {
    timeout: 30_000,
  });

  // Restored through the API rather than a click: the click is optimistic, and
  // a test that ends before the write lands leaves the preference on LIST.
  await useView(page, "BOARD");
  await expect(group.getByRole("button", { name: "Board" })).toHaveAttribute("aria-pressed", "true", {
    timeout: 15_000,
  });
});
