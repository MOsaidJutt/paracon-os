import { test, expect } from "@playwright/test";

// A full Drive connect → upload → browse → open round trip needs a real
// Google OAuth client + a real Google account and isn't something CI can run
// (no test credentials, and Google's consent screen isn't automatable). What
// IS deterministic and worth locking in here: the admin UI's "not configured"
// state (true whenever GOOGLE_CLIENT_ID etc. aren't set, including in CI),
// and that the manual paste-a-link fallback documents-linked-and-search.spec.ts
// already covers keeps working when Drive isn't connected for an org.

test("admin Google Drive settings page shows the not-configured state when env vars are unset", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("director@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  await page.goto("/admin/google-drive");
  await expect(page.getByText("Google Drive (large CAD & drawing sets)")).toBeVisible();

  // GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI/NEXT_PUBLIC_GOOGLE_API_KEY are unset
  // by default (.env.example ships them blank) — the admin can see exactly
  // what's missing instead of a button that fails silently.
  await expect(page.getByText(/Not configured yet/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Google Drive" })).toBeDisabled();
});

test("a project's Documents panel falls back to the manual Drive link button when Drive isn't connected", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("director@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  await page.goto("/projects");
  await page.getByText("Riverside Quarter Fitout").first().click();
  await page.waitForURL(/\/projects\/.+/);
  await page.getByRole("tab", { name: "Documents" }).click();

  await expect(page.getByRole("button", { name: "Add Drive link" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Google Drive" })).toHaveCount(0);
});
