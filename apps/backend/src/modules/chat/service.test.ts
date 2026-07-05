import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryConversationRepository } from "../conversations/repository.js";
import {
  createChatService,
  type ProviderCandidate,
  type ProviderInvoker,
} from "./service.js";

describe("chat service", () => {
  const userId = "usr_seeded";
  let conversations = createInMemoryConversationRepository();

  beforeEach(() => {
    conversations = createInMemoryConversationRepository();
  });

  it("persists the user message and assistant message on success", async () => {
    const conversation = await conversations.createForUser(userId, "New Conversation");

    const providerCandidates: ProviderCandidate[] = [
      {
        providerId: "prv_openrouter",
        modelId: "mdl_qwen3_30b_free",
        modelName: "Qwen3 30B A3B (Free)",
      },
    ];

    const invokeProvider: ProviderInvoker = async () => ({
      ok: true,
      text: "Here is the likely cause.",
    });

    const service = createChatService({
      conversationRepository: conversations,
      providerCandidates,
      invokeProvider,
    });

    const response = await service.sendMessage({
      userId,
      conversationId: conversation.id,
      content: [{ type: "text", text: "Explain this error" }],
    });

    expect(response.capacityBlocked).toBe(false);
    expect(response.assistantMessage?.content[0]?.text).toBe(
      "Here is the likely cause.",
    );
    expect(response.provider?.modelId).toBe("mdl_qwen3_30b_free");
  });

  it("preserves the user message when all providers are exhausted", async () => {
    const conversation = await conversations.createForUser(userId, "New Conversation");

    const providerCandidates: ProviderCandidate[] = [
      {
        providerId: "prv_openrouter",
        modelId: "mdl_deepseek_chat_free",
        modelName: "DeepSeek Chat (Free)",
      },
    ];

    const invokeProvider: ProviderInvoker = async () => ({
      ok: false,
      failureCode: "quota_exhausted",
    });

    const service = createChatService({
      conversationRepository: conversations,
      providerCandidates,
      invokeProvider,
    });

    const response = await service.sendMessage({
      userId,
      conversationId: conversation.id,
      content: [{ type: "text", text: "Explain this error" }],
    });

    expect(response.capacityBlocked).toBe(true);
    expect(response.assistantMessage).toBeNull();
    expect(response.error?.code).toBe("CAPACITY_EXHAUSTED");
  });
});
