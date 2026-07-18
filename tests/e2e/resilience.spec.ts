import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page);
});

test("preserves the prompt during full outage and recovers on a later send", async ({ page }) => {
  const created = await page.request.post("/api/v1/conversations", {
    data: { title: "Outage recovery", mode: "chat" },
  });
  expect(created.status()).toBe(201);
  const conversationId = (await created.json()).conversation.id as string;

  const outage = await page.request.post(`/api/v1/conversations/${conversationId}/messages`, {
    data: {
      content: [{ type: "text", text: "[OUTAGE] preserve this request" }],
      modelId: "mdl_e2e_a",
      idempotencyKey: "outage-once",
    },
  });
  expect(outage.status()).toBe(200);
  expect(await outage.json()).toMatchObject({ capacityBlocked: true, assistantMessage: null });

  const afterOutage = await page.request.get(`/api/v1/conversations/${conversationId}/messages`);
  expect((await afterOutage.json()).messages).toHaveLength(1);

  const recovery = await page.request.post(`/api/v1/conversations/${conversationId}/messages`, {
    data: {
      content: [{ type: "text", text: "[RECOVERY] answer after recovery" }],
      modelId: "mdl_e2e_a",
      idempotencyKey: "recovery-once",
    },
  });
  expect(recovery.status()).toBe(200);
  expect(await recovery.json()).toMatchObject({
    capacityBlocked: false,
    provider: { modelId: "mdl_e2e_a", modelName: "E2E Model A" },
  });

  const afterRecovery = await page.request.get(`/api/v1/conversations/${conversationId}/messages`);
  expect((await afterRecovery.json()).messages).toHaveLength(3);
});

test("deduplicates repeated HTTP sends with the same idempotency key", async ({ page }) => {
  const created = await page.request.post("/api/v1/conversations", {
    data: { title: "Idempotency verification", mode: "chat" },
  });
  const conversationId = (await created.json()).conversation.id as string;
  const request = {
    content: [{ type: "text", text: "Return exactly one assistant response" }],
    modelId: "mdl_e2e_b",
    idempotencyKey: "same-http-request",
  };

  const first = await page.request.post(`/api/v1/conversations/${conversationId}/messages`, { data: request });
  const second = await page.request.post(`/api/v1/conversations/${conversationId}/messages`, { data: request });
  expect(await second.json()).toEqual(await first.json());

  const messages = await page.request.get(`/api/v1/conversations/${conversationId}/messages`);
  expect((await messages.json()).messages).toHaveLength(2);
});
