import { expect, test } from "@playwright/test";

test.setTimeout(90_000);

test("rejects invalid credentials and establishes a secure browser session", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  await expect(
    page.getByRole("heading", { name: /Chat with your models, files, and workspaces in one place/i }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Sign in" }).first().click();

  await page.getByLabel("Email").fill("user@clm.local");
  await page.getByLabel("Password").fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Invalid email or password.")).toBeVisible();

  await page.getByLabel("Password").fill("changeme");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Admin Console")).toBeVisible({ timeout: 60_000 });

  const sessionCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "loom_session",
  );
  expect(sessionCookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
});

test("registers a customer and opens the workspace settings page", async ({ page }) => {
  const email = `customer.${Date.now()}@example.com`;

  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Create your Loom account" })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByLabel("Name").fill("Beta Customer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("strongpass");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
  await expect(page.getByRole("heading", { name: /Welcome back, Beta/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "New chat", exact: true })).toBeVisible({
    timeout: 30_000,
  });

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator(`input[value="${email}"]`)).toBeVisible();

  await page.getByLabel("Display Name").fill("Beta Customer Updated");
  await page.getByRole("button", { name: "Save Preferences" }).click();
  await expect(page.getByText("Preferences saved successfully")).toBeVisible();
});
