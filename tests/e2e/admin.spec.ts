import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.setTimeout(60_000);

test("loads protected admin data and routing diagnostics", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin");

  await expect(page.getByText("Admin Console")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.getByRole("button", { name: "Failover Logs", exact: true }).click();
  await expect(page.getByText("Routing Diagnostics")).toBeVisible();
});
