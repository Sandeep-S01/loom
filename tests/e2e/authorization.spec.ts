import { expect, test } from "@playwright/test";
import { loginAsCustomer } from "./helpers";

test("prevents a customer from entering the admin console", async ({ page }) => {
  await loginAsCustomer(page);
  const response = await page.request.get("/api/v1/admin/failover-attempts");
  expect(response.status()).toBe(403);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin access required" })).toBeVisible();
  await expect(page.getByText(/does not have permission/)).toBeVisible();
});
