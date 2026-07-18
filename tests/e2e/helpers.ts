import { expect, type Page } from "@playwright/test";

export async function loginAsAdmin(page: Page) {
  await page.goto("/login?next=/chat");
  await expect(page.getByRole("heading", { name: "Sign in to Loom" })).toBeVisible();
  await page.getByLabel("Email").fill("user@clm.local");
  await page.getByLabel("Password").fill("changeme");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "New chat" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByLabel("Choose model")).toBeVisible({ timeout: 30_000 });
}

export async function loginAsCustomer(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("customer@clm.local");
  await page.getByLabel("Password").fill("changeme");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "New chat" })).toBeVisible({
    timeout: 30_000,
  });
}
