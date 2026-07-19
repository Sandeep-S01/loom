import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.setTimeout(60_000);

test("loads protected admin data and routing diagnostics", async ({ page }) => {
  const failedResponses: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/v1/") && response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await loginAsAdmin(page);
  await page.goto("/admin");

  await page.waitForLoadState("networkidle");
  expect(failedResponses).toEqual([]);
  const adminEndpointProbe = await page.evaluate(async () => {
    const endpoints = [
      "/api/v1/dashboard",
      "/api/v1/providers",
      "/api/v1/admin/providers?pageSize=100",
      "/api/v1/admin/provider-sync-status?pageSize=100",
      "/api/v1/admin/model-catalog?pageSize=100",
      "/api/v1/admin/model-registry?pageSize=100",
      "/api/v1/admin/model-policy?pageSize=100",
      "/api/v1/admin/model-runtime-health?pageSize=100",
      "/api/v1/admin/provider-health?pageSize=100",
      "/api/v1/admin/routing-attempts?pageSize=50",
      "/api/v1/admin/model-usage/summary",
      "/api/v1/admin/model-usage/counters?granularity=day&pageSize=50",
      "/api/v1/models?includeDisabled=true",
    ];
    return Promise.all(
      endpoints.map(async (endpoint) => {
        const response = await fetch(endpoint, { credentials: "include" });
        const text = await response.text();
        return {
          endpoint,
          status: response.status,
          body: text.slice(0, 160),
        };
      }),
    );
  });
  expect(
    adminEndpointProbe.filter(
      (result) =>
        result.status !== 200 || result.body.includes("Unexpected backend failure"),
    ),
  ).toEqual([]);
  await expect(page.getByText("Unexpected backend failure")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Providers", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Providers", exact: true })).toBeVisible();
  await expect(page.getByText("Provider operations")).toBeVisible();

  await page.getByRole("button", { name: "Catalog", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catalog", exact: true })).toBeVisible();
  await expect(page.getByText("Model catalog")).toBeVisible();

  await page.getByRole("button", { name: "Models", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Models", exact: true })).toBeVisible();
  await expect(page.getByText("Model registry")).toBeVisible();

  await page.getByRole("button", { name: "Usage", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Usage", exact: true })).toBeVisible();
  await expect(page.getByText("Usage counters")).toBeVisible();

  await page.getByRole("button", { name: "Routing", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Routing", exact: true })).toBeVisible();
  await expect(page.getByText("Provider health")).toBeVisible();
});
