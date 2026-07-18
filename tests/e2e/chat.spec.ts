import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

const messageBox = (page: Page) => page.getByRole("textbox", { name: "Message" });

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page);
});

test("switches models, sends chat, and completes conversation CRUD", async ({ page }) => {
  await page.getByRole("button", { name: "New chat" }).click();
  await page.getByLabel("Choose model").click();
  await expect(page.getByRole("button", { name: /E2E Model A/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /E2E Model B/ })).toBeVisible();
  await page.getByRole("button", { name: /E2E Model B/ }).click();

  await messageBox(page).fill("Run the deterministic E2E chat flow");
  await page.getByTitle("Send message").click();
  await expect(page.getByText("E2E response from E2E Model B.")).toBeVisible();
  await expect(page.getByText("Answered by E2E Model B")).toBeVisible();

  await page.getByRole("button", { name: "New Conversation" }).hover();
  await page.getByLabel("Rename conversation").click();
  await page.getByLabel("Conversation title").fill("Release gate conversation");
  await page.getByLabel("Save title").click();
  await expect(page.getByText("Release gate conversation")).toBeVisible();

  await page.getByRole("button", { name: "Release gate conversation" }).hover();
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("delete this conversation");
    await dialog.accept();
  });
  await page.getByLabel("Delete conversation").click();
  await expect(page.getByText("Release gate conversation")).toHaveCount(0);
});

test("fails over from the selected model and reports the actual responding model", async ({ page }) => {
  await page.getByRole("button", { name: "New chat" }).click();
  await page.getByLabel("Choose model").click();
  await page.getByRole("button", { name: /E2E Model A/ }).click();
  await messageBox(page).fill("Exercise automatic failover");
  await page.getByTitle("Send message").click();

  await expect(page.getByText("E2E response from E2E Model B.")).toBeVisible();
  await expect(page.getByText(/Response switched from E2E Model A to E2E Model B/)).toBeVisible();
  await expect(page.getByText("Answered by E2E Model B")).toBeVisible();
});
