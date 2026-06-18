import { test, expect } from "@playwright/test";

// Requires the database to be seeded (npm run db:seed) and the dev server running.
// Exercises the Phase 1 acceptance criteria: an org admin can build a custom role
// and a user with that role sees exactly the permitted nav/admin surface.
// Note: this leaves a "Tender Only <ts>" role + deactivated user behind each run —
// users are soft-deleted only (by design, for audit-trail integrity) and a role
// can't be deleted while any user (active or not) still references it. Reset with
// a fresh `prisma/dev.db` + `npm run db:seed` between CI runs if that matters.
test("a custom role with only tender.view hides Admin nav and blocks /admin/* for that user", async ({
  page,
}) => {
  const unique = Date.now();
  const roleName = `Tender Only ${unique}`;
  const userEmail = `tender-only-${unique}@paracon.com.au`;
  const password = "Demo1234!";

  // Sign in as Director and create the custom role.
  await page.goto("/login");
  await page.getByLabel("Email").fill("director@paracon.com.au");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  await page.goto("/admin/roles");
  await page.getByRole("button", { name: "Create role" }).click();
  await page.getByLabel("Name").fill(roleName);
  await page
    .getByText("tender.view", { exact: true })
    .locator("xpath=ancestor::div[contains(@class,'justify-between')][1]")
    .getByRole("switch")
    .click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Role created")).toBeVisible();

  // Create a user with that role.
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Add user" }).click();
  await page.getByLabel("Name").fill("Tender Only User");
  await page.getByLabel("Email").fill(userEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Role").click();
  await page.getByRole("option", { name: roleName }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("User created")).toBeVisible();

  // Sign out and sign back in as the restricted user.
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL("/login");

  await page.getByLabel("Email").fill(userEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  // No admin.* permissions -> no Admin nav link.
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);

  // Direct navigation to an admin route redirects away (AdminLayout has no visible tabs for this user).
  await page.goto("/admin/users");
  await page.waitForURL("/dashboard");
});
