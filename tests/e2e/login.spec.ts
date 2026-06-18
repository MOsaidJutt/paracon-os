import { test, expect } from "@playwright/test";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
test("director can log in and reach a role-appropriate dashboard", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill("director@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL("/dashboard");
  await expect(page.getByText("Command Centre")).toBeVisible();
  await expect(page.getByText("Director", { exact: true })).toBeVisible();
});
