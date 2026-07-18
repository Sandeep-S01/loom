import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test("keeps the workspace usable without page-level horizontal overflow", async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("button", { name: "New chat" })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
