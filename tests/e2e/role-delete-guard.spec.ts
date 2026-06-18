import { test, expect } from "@playwright/test";

// A role with a pending (unaccepted) invite must not be deletable until that
// invite is cancelled — Invite.roleId is FK-cascaded at the DB level, but the
// app layer must block the delete with a clear 400 *before* that, and the
// "Delete" action must read as disabled rather than failing silently.
test("role with a pending invite blocks delete until the invite is cancelled", async ({ page }) => {
  const unique = Date.now();
  const roleName = `Audit Guard Role ${unique}`;
  const inviteEmail = `audit-guard-${unique}@paracon.com.au`;

  await page.goto("/login");
  await page.getByLabel("Email").fill("director@paracon.com.au");
  await page.getByLabel("Password").fill("Demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");

  await page.goto("/admin/roles");
  await page.getByRole("button", { name: "Create role" }).click();
  await page.getByLabel("Name").fill(roleName);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Role created")).toBeVisible();

  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Invite user" }).click();
  await page.getByLabel("Email").fill(inviteEmail);
  await page.getByLabel("Role").click();
  await page.getByRole("option", { name: roleName }).click();
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page.getByText(inviteEmail)).toBeVisible();

  await page.goto("/admin/roles");
  const roleRow = page.getByRole("row", { name: new RegExp(roleName) });
  await roleRow.getByRole("button", { name: `Actions for ${roleName}` }).click();
  await expect(page.getByRole("menuitem", { name: "Delete" })).toBeDisabled();
  await page.keyboard.press("Escape");

  await page.goto("/admin/users");
  await page
    .getByText(inviteEmail)
    .locator("xpath=ancestor::div[contains(@class,'justify-between')][1]")
    .getByRole("button", { name: "Cancel" })
    .click();
  await expect(page.getByText("Invite cancelled")).toBeVisible();

  await page.goto("/admin/roles");
  await roleRow.getByRole("button", { name: `Actions for ${roleName}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByText("Role deleted")).toBeVisible();
});
