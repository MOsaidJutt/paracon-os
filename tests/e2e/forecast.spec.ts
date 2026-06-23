import { test, expect } from "@playwright/test";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
test("director can open the forecast page and see the matrix, heatmap and capacity headroom", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("director@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  await page.goto("/forecast");
  await expect(page.getByRole("heading", { name: "Forecast & Capacity" })).toBeVisible();

  await expect(page.getByText("Can we take on more work?")).toBeVisible();
  await expect(page.getByText("Forecast matrix — demand vs supply by trade")).toBeVisible();
  await expect(page.getByText("Capacity heatmap — trade x week")).toBeVisible();

  // The matrix renders at least one trade row with a RAG status badge.
  await expect(page.getByRole("table").first().getByText(/Covered|Short/).first()).toBeVisible();

  // Manual recompute round-trips without an error toast.
  await page.getByRole("button", { name: "Recompute forecast" }).click();
  await expect(page.getByText("Forecast recomputed")).toBeVisible();
});
