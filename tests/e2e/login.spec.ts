import { test, expect } from "@playwright/test";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
// Deliberately view-agnostic: which dashboard renders depends on the account's
// stored Simplified/Full preference, which other specs set for their own
// purposes. What login owns is that the credentials work, the shell renders and
// the role is right — each dashboard spec asserts its own view's content.
test("director can log in and reach a role-appropriate dashboard", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill("director@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL("/dashboard");
  await expect(page.getByText("Director", { exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Choose how much of the app to show" })).toBeVisible();
});
