import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EligibleModelCandidate } from "../model-eligibility/domain.js";
import type { ModelRoutingService } from "../model-routing/interfaces.js";
import type { ModelFallbackService } from "../model-fallback/interfaces.js";
import type { ModelUsageService } from "../model-usage/interfaces.js";
import type { AuditService } from "../audit/interfaces.js";
import { createInMemoryConversationRepository } from "../conversations/repository.js";
import {
  createChatService,
  type ProviderCandidate,
  type ProviderInvoker,
} from "./service.js";
import {
  createInMemoryChatIdempotencyStore,
  createInMemoryConcurrencyLimiter,
  createInMemoryFixedWindowRateLimiter,
} from "./load-control.js";

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
    expect(response.assistantMessage?.content[0]).toMatchObject({
      type: "text",
      text: "Here is the likely cause.",
    });
    expect(response.provider?.modelId).toBe("mdl_qwen3_30b_free");
  });

  it("uses routing-selected registry models and records usage plus audit", async () => {
    const conversation = await conversations.createForUser(userId, "New Conversation");
    const usageService = createMockUsageService();
    const auditService = createMockAuditService();
    const routingService = createMockRoutingService(makeEligibleModel());
    let invokedCandidate: ProviderCandidate | null = null;

    const service = createChatService({
      conversationRepository: conversations,
      providerCandidates: [
        {
          providerId: "prov_1",
          providerName: "OpenRouter",
          modelId: "mdl_runtime",
          modelName: "Runtime Model",
          externalModelKey: "provider/model",
        },
      ],
      modelRoutingService: routingService,
      modelUsageService: usageService,
      auditService,
      invokeProvider: async (candidate) => {
        invokedCandidate = candidate;
        return {
          ok: true,
          text: "routed reply",
          usage: {
            inputTokens: 12,
            outputTokens: 8,
            totalTokens: 20,
          },
        };
      },
    });

    const response = await service.sendMessage({
      userId,
      conversationId: conversation.id,
      content: [{ type: "text", text: "Use the registry route" }],
    });

    expect(response.capacityBlocked).toBe(false);
    expect(invokedCandidate).toMatchObject({
      modelId: "mdl_runtime",
      registryModelId: "mreg_1",
    });
    expect(routingService.selectRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "chat",
        userId,
        conversationId: conversation.id,
        requestId: expect.stringMatching(/^route_/),
      }),
    );
    expect(usageService.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        registryModelId: "mreg_1",
        providerId: "prov_1",
        status: "success",
        inputTokens: 12,
        outputTokens: 8,
        totalTokens: 20,
      }),
    );
    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        eventType: "chat_request_completed",
        subjectType: "conversation",
        subjectId: conversation.id,
      }),
    );
  });

  it("records registry model ids without writing them to legacy model columns", async () => {
    const conversation = await conversations.createForUser(userId, "New Conversation");
    const recordProviderAttempt = vi.fn();
    const onProviderSuccess = vi.fn();

    const service = createChatService({
      conversationRepository: conversations,
      providerCandidates: [
        {
          providerId: "prov_1",
          providerName: "OpenRouter",
          modelId: "mreg_1",
          legacyModelId: null,
          registryModelId: "mreg_1",
          catalogModelId: "mcat_1",
          modelName: "Registry Model",
          externalModelKey: "provider/model",
        },
      ],
      modelRoutingService: createMockRoutingService(makeEligibleModel()),
      recordProviderAttempt,
      onProviderSuccess,
      invokeProvider: async () => ({
        ok: true,
        text: "registry reply",
      }),
    });

    const response = await service.sendMessage({
      userId,
      conversationId: conversation.id,
      content: [{ type: "text", text: "Use registry model" }],
    });
    const messages = await conversations.listMessages(conversation.id);

    expect(response.provider?.modelId).toBe("mreg_1");
    expect(response.assistantMessage?.modelId).toBeNull();
    expect(response.assistantMessage?.registryModelId).toBe("mreg_1");
    expect(messages.at(-1)?.modelId).toBeNull();
    expect(messages.at(-1)?.registryModelId).toBe("mreg_1");
    expect(recordProviderAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: null,
        registryModelId: "mreg_1",
        status: "success",
      }),
    );
    expect(onProviderSuccess).not.toHaveBeenCalled();
  });

  it("uses fallback service decisions after a routed model fails", async () => {
    const conversation = await conversations.createForUser(userId, "New Conversation");
    const usageService = createMockUsageService();
    const fallbackService = createMockFallbackService(makeEligibleModel({
      registryModelId: "mreg_2",
      catalogModelId: "mcat_2",
      externalModelKey: "provider/fallback",
      displayName: "Fallback Model",
    }));
    const invokedModelIds: string[] = [];

    const service = createChatService({
      conversationRepository: conversations,
      providerCandidates: [
        {
          providerId: "prov_1",
          providerName: "OpenRouter",
          modelId: "mdl_primary",
          modelName: "Primary Model",
          externalModelKey: "provider/model",
        },
        {
          providerId: "prov_1",
          providerName: "OpenRouter",
          modelId: "mdl_fallback",
          modelName: "Fallback Model",
          externalModelKey: "provider/fallback",
        },
      ],
      modelRoutingService: createMockRoutingService(makeEligibleModel()),
      modelFallbackService: fallbackService,
      modelUsageService: usageService,
      invokeProvider: async (candidate) => {
        invokedModelIds.push(candidate.modelId);
        if (candidate.modelId === "mdl_primary") {
          return { ok: false, failureCode: "provider_5xx" };
        }
        return { ok: true, text: "fallback reply" };
      },
    });

    const response = await service.sendMessage({
      userId,
      conversationId: conversation.id,
      content: [{ type: "text", text: "Try fallback" }],
    });

    expect(invokedModelIds).toEqual(["mdl_primary", "mdl_fallback"]);
    expect(response.provider?.modelId).toBe("mdl_fallback");
    expect(fallbackService.selectFallback).toHaveBeenCalledWith(
      expect.objectContaining({
        failedRegistryModelIds: ["mreg_1"],
        failureCode: "provider_5xx",
      }),
    );
    expect(usageService.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        registryModelId: "mreg_2",
        status: "success",
        usedFallback: true,
      }),
    );
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
    expect(response.error).toMatchObject({
      code: "provider_rate_limited",
      requestId: expect.stringMatching(/^route_/),
    });
  });

  it("prioritizes the explicitly selected model for a chat request", async () => {
    const conversation = await conversations.createForUser(userId, "New Conversation");
    const invokedModelIds: string[] = [];

    const providerCandidates: ProviderCandidate[] = [
      {
        providerId: "prv_openrouter",
        modelId: "mdl_qwen3_30b_free",
        modelName: "Qwen3 30B A3B (Free)",
        providerPriority: 1,
        modelPriority: 1,
      },
      {
        providerId: "prv_gemini",
        modelId: "mdl_gemini_2_flash",
        modelName: "Gemini 2.0 Flash",
        providerPriority: 2,
        modelPriority: 1,
      },
    ];

    const invokeProvider: ProviderInvoker = async (candidate) => {
      invokedModelIds.push(candidate.modelId);

      return {
        ok: true,
        text: `reply from ${candidate.modelName}`,
      };
    };

    const service = createChatService({
      conversationRepository: conversations,
      providerCandidates,
      invokeProvider,
    });

    const response = await service.sendMessage({
      userId,
      conversationId: conversation.id,
      selectedModelId: "mdl_gemini_2_flash",
      content: [{ type: "text", text: "Which model are you?" }],
    });

    expect(invokedModelIds).toEqual(["mdl_gemini_2_flash"]);
    expect(response.provider?.modelId).toBe("mdl_gemini_2_flash");
    expect(response.assistantMessage?.modelId).toBe("mdl_gemini_2_flash");
  });

  it("skips text-only models for image requests and uses the first vision-capable model", async () => {
    const conversation = await conversations.createForUser(userId, "New Conversation");
    const invokedModelIds: string[] = [];

    const providerCandidates: ProviderCandidate[] = [
      {
        providerId: "prv_openrouter",
        modelId: "mdl_deepseek_chat_free",
        modelName: "DeepSeek Chat (Free)",
        supportsVision: false,
      },
      {
        providerId: "prv_gemini",
        modelId: "mdl_gemini_15_flash",
        modelName: "Gemini 1.5 Flash",
        supportsVision: true,
      },
    ];

    const invokeProvider: ProviderInvoker = async (candidate) => {
      invokedModelIds.push(candidate.modelId);

      return {
        ok: true,
        text: "This image shows a workspace screenshot.",
      };
    };

    const service = createChatService({
      conversationRepository: conversations,
      providerCandidates,
      invokeProvider,
    });

    const response = await service.sendMessage({
      userId,
      conversationId: conversation.id,
      selectedModelId: "mdl_deepseek_chat_free",
      content: [
        { type: "text", text: "Analyze this image" },
        {
          type: "image",
          data: "aW1hZ2U=",
          filename: "screen.png",
          mimeType: "image/png",
          size: 5,
        },
      ],
    });

    expect(invokedModelIds).toEqual(["mdl_gemini_15_flash"]);
    expect(response.provider?.modelId).toBe("mdl_gemini_15_flash");
  });

  it("rejects image metadata that does not match the decoded payload", async () => {
    const conversation = await conversations.createForUser(userId, "New Conversation");
    const service = createChatService({
      conversationRepository: conversations,
      providerCandidates: [],
      invokeProvider: async () => ({ ok: true, text: "unused" }),
    });

    await expect(
      service.sendMessage({
        userId,
        conversationId: conversation.id,
        content: [
          {
            type: "image",
            data: "aW1hZ2U=",
            filename: "screen.png",
            mimeType: "image/png",
            size: 999,
          },
        ],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("returns a clear vision error when no vision-capable model is available", async () => {
    const conversation = await conversations.createForUser(userId, "New Conversation");

    const service = createChatService({
      conversationRepository: conversations,
      providerCandidates: [
        {
          providerId: "prv_openrouter",
          modelId: "mdl_qwen3_30b_free",
          modelName: "Qwen3 30B A3B (Free)",
          supportsVision: false,
        },
      ],
      invokeProvider: async () => ({
        ok: true,
        text: "should not be called",
      }),
    });

    const response = await service.sendMessage({
      userId,
      conversationId: conversation.id,
      content: [
        { type: "text", text: "Analyze this image" },
        {
          type: "image",
          data: "aW1hZ2U=",
          filename: "screen.png",
          mimeType: "image/png",
          size: 5,
        },
      ],
    });

    expect(response.capacityBlocked).toBe(true);
    expect(response.error).toMatchObject({
      code: "VISION_MODEL_UNAVAILABLE",
      message:
        "No vision-capable model is available right now. Enable or wait for a Gemini/vision model, then try again.",
      requestId: expect.stringMatching(/^route_/),
    });
  });

  it("returns a clear vision exhaustion error when vision-capable models fail", async () => {
    const conversation = await conversations.createForUser(userId, "New Conversation");

    const service = createChatService({
      conversationRepository: conversations,
      providerCandidates: [
        {
          providerId: "prv_gemini",
          modelId: "mdl_gemini_15_flash",
          modelName: "Gemini 1.5 Flash",
          supportsVision: true,
        },
      ],
      invokeProvider: async () => ({
        ok: false,
        failureCode: "rate_limited_transient",
      }),
    });

    const response = await service.sendMessage({
      userId,
      conversationId: conversation.id,
      content: [
        { type: "text", text: "Analyze this image" },
        {
          type: "image",
          data: "aW1hZ2U=",
          filename: "screen.png",
          mimeType: "image/png",
          size: 5,
        },
      ],
    });

    expect(response.capacityBlocked).toBe(true);
    expect(response.error).toMatchObject({
      code: "VISION_MODELS_EXHAUSTED",
      message:
        "Vision-capable models are currently unavailable or rate-limited. Try again shortly or choose another vision model.",
      requestId: expect.stringMatching(/^route_/),
    });
  });

  it("falls back from the selected model and reports the switch when it fails", async () => {
    const conversation = await conversations.createForUser(userId, "New Conversation");
    const invokedModelIds: string[] = [];

    const providerCandidates: ProviderCandidate[] = [
      {
        providerId: "prv_openrouter",
        modelId: "mdl_qwen3_30b_free",
        modelName: "Qwen3 30B A3B (Free)",
        providerPriority: 1,
        modelPriority: 1,
      },
      {
        providerId: "prv_gemini",
        modelId: "mdl_gemini_2_flash",
        modelName: "Gemini 2.0 Flash",
        providerPriority: 2,
        modelPriority: 1,
      },
    ];

    const invokeProvider: ProviderInvoker = async (candidate) => {
      invokedModelIds.push(candidate.modelId);

      if (candidate.modelId === "mdl_qwen3_30b_free") {
        return {
          ok: false,
          failureCode: "provider_5xx",
        };
      }

      return {
        ok: true,
        text: "fallback reply",
      };
    };

    const service = createChatService({
      conversationRepository: conversations,
      providerCandidates,
      invokeProvider,
    });

    const response = await service.sendMessage({
      userId,
      conversationId: conversation.id,
      selectedModelId: "mdl_qwen3_30b_free",
      content: [{ type: "text", text: "Try the selected model first" }],
    });

    expect(invokedModelIds).toEqual([
      "mdl_qwen3_30b_free",
      "mdl_gemini_2_flash",
    ]);
    expect(response.provider?.modelId).toBe("mdl_gemini_2_flash");
    expect(response.providerSwitched).toEqual({
      switched: true,
      fromModelId: "mdl_qwen3_30b_free",
      fromModelName: "Qwen3 30B A3B (Free)",
      toModelId: "mdl_gemini_2_flash",
      toModelName: "Gemini 2.0 Flash",
      reason: "provider_5xx",
    });
  });

  it("falls back when the selected model times out", async () => {
    const conversation = await conversations.createForUser(userId, "New Conversation");
    const invokedModelIds: string[] = [];

    const service = createChatService({
      conversationRepository: conversations,
      providerCandidates: [
        {
          providerId: "prv_openrouter",
          modelId: "mdl_qwen3_30b_free",
          modelName: "Qwen3 30B A3B (Free)",
          providerPriority: 1,
          modelPriority: 1,
        },
        {
          providerId: "prv_gemini",
          modelId: "mdl_gemini_2_flash",
          modelName: "Gemini 2.0 Flash",
          providerPriority: 2,
          modelPriority: 1,
        },
      ],
      invokeProvider: async (candidate) => {
        invokedModelIds.push(candidate.modelId);

        if (candidate.modelId === "mdl_qwen3_30b_free") {
          return {
            ok: false,
            failureCode: "provider_timeout",
          };
        }

        return { ok: true, text: "fallback after timeout" };
      },
    });

    const response = await service.sendMessage({
      userId,
      conversationId: conversation.id,
      selectedModelId: "mdl_qwen3_30b_free",
      content: [{ type: "text", text: "Try selected first" }],
    });

    expect(invokedModelIds).toEqual([
      "mdl_qwen3_30b_free",
      "mdl_gemini_2_flash",
    ]);
    expect(response.provider?.modelId).toBe("mdl_gemini_2_flash");
    expect(response.providerSwitched?.reason).toBe("provider_timeout");
  });

  it("does not fall back when the request context is too large", async () => {
    const conversation = await conversations.createForUser(userId, "New Conversation");
    const invokedModelIds: string[] = [];

    const service = createChatService({
      conversationRepository: conversations,
      providerCandidates: [
        {
          providerId: "prv_openrouter",
          modelId: "mdl_qwen3_30b_free",
          modelName: "Qwen3 30B A3B (Free)",
          providerPriority: 1,
          modelPriority: 1,
        },
        {
          providerId: "prv_gemini",
          modelId: "mdl_gemini_2_flash",
          modelName: "Gemini 2.0 Flash",
          providerPriority: 2,
          modelPriority: 1,
        },
      ],
      invokeProvider: async (candidate) => {
        invokedModelIds.push(candidate.modelId);
        return {
          ok: false,
          failureCode: "context_too_large",
        };
      },
    });

    const response = await service.sendMessage({
      userId,
      conversationId: conversation.id,
      selectedModelId: "mdl_qwen3_30b_free",
      content: [{ type: "text", text: "Summarize this large context" }],
    });

    expect(invokedModelIds).toEqual(["mdl_qwen3_30b_free"]);
    expect(response.capacityBlocked).toBe(true);
    expect(response.error).toMatchObject({
      code: "context_too_large",
      requestId: expect.stringMatching(/^route_/),
    });
  });

  it("returns a safe request id when all providers fail", async () => {
    const conversation = await conversations.createForUser(userId, "New Conversation");

    const service = createChatService({
      conversationRepository: conversations,
      providerCandidates: [
        {
          providerId: "prv_openrouter",
          modelId: "mdl_qwen3_30b_free",
          modelName: "Qwen3 30B A3B (Free)",
        },
      ],
      invokeProvider: async () => ({
        ok: false,
        failureCode: "provider_5xx",
      }),
    });

    const response = await service.sendMessage({
      userId,
      conversationId: conversation.id,
      content: [{ type: "text", text: "Explain this error" }],
    });

    expect(response.capacityBlocked).toBe(true);
    expect(response.error).toMatchObject({
      code: "provider_5xx",
      requestId: expect.stringMatching(/^route_/),
    });
    expect(response.error?.message).not.toContain("Error:");
    expect(response.error?.message).not.toContain("stack");
  });

  it("returns a routing trace id for observability", async () => {
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
      text: "traceable reply",
    });

    const service = createChatService({
      conversationRepository: conversations,
      providerCandidates,
      invokeProvider,
    });

    const response = await service.sendMessage({
      userId,
      conversationId: conversation.id,
      content: [{ type: "text", text: "Trace this request" }],
    });

    expect(response.routingTraceId).toMatch(/^route_/);
  });

  it("returns the stored response for duplicate idempotency keys without calling the provider twice", async () => {
    const conversation = await conversations.createForUser(userId, "New Conversation");
    const idempotencyStore = createInMemoryChatIdempotencyStore();
    let providerCalls = 0;

    const service = createChatService({
      conversationRepository: conversations,
      idempotencyStore,
      providerCandidates: [
        {
          providerId: "prv_openrouter",
          modelId: "mdl_qwen3_30b_free",
          modelName: "Qwen3 30B A3B (Free)",
        },
      ],
      invokeProvider: async () => {
        providerCalls += 1;
        return { ok: true, text: "idempotent reply" };
      },
    });

    const firstResponse = await service.sendMessage({
      userId,
      conversationId: conversation.id,
      idempotencyKey: "idem_1",
      content: [{ type: "text", text: "Run once" }],
    });
    const secondResponse = await service.sendMessage({
      userId,
      conversationId: conversation.id,
      idempotencyKey: "idem_1",
      content: [{ type: "text", text: "Run once" }],
    });

    expect(providerCalls).toBe(1);
    expect(secondResponse).toEqual(firstResponse);
    await expect(conversations.listMessages(conversation.id)).resolves.toHaveLength(2);
  });

  it("rejects requests before appending messages when chat send rate limit is exceeded", async () => {
    const conversation = await conversations.createForUser(userId, "New Conversation");
    const chatRateLimiter = createInMemoryFixedWindowRateLimiter();
    let providerCalls = 0;

    const service = createChatService({
      conversationRepository: conversations,
      chatRateLimiter,
      chatRequestsPerMinuteLimit: 1,
      providerCandidates: [
        {
          providerId: "prv_openrouter",
          modelId: "mdl_qwen3_30b_free",
          modelName: "Qwen3 30B A3B (Free)",
        },
      ],
      invokeProvider: async () => {
        providerCalls += 1;
        return { ok: true, text: "allowed" };
      },
    });

    await service.sendMessage({
      userId,
      conversationId: conversation.id,
      content: [{ type: "text", text: "first" }],
    });
    const rejected = await service.sendMessage({
      userId,
      conversationId: conversation.id,
      content: [{ type: "text", text: "second" }],
    });

    expect(providerCalls).toBe(1);
    expect(rejected.capacityBlocked).toBe(true);
    expect(rejected.error?.code).toBe("chat_rate_limited");
    await expect(conversations.listMessages(conversation.id)).resolves.toHaveLength(2);
  });

  it("rejects concurrent requests above the per-conversation limit before calling providers", async () => {
    const conversation = await conversations.createForUser(userId, "New Conversation");
    const concurrencyLimiter = createInMemoryConcurrencyLimiter({
      maxGlobal: 1,
      maxPerConversation: 1,
    });
    let releaseProvider: () => void = () => undefined;
    let providerCalls = 0;

    const service = createChatService({
      conversationRepository: conversations,
      concurrencyLimiter,
      providerCandidates: [
        {
          providerId: "prv_openrouter",
          modelId: "mdl_qwen3_30b_free",
          modelName: "Qwen3 30B A3B (Free)",
        },
      ],
      invokeProvider: async () => {
        providerCalls += 1;
        await new Promise<void>((resolve) => {
          releaseProvider = resolve;
        });
        return { ok: true, text: "slow reply" };
      },
    });

    const firstRequest = service.sendMessage({
      userId,
      conversationId: conversation.id,
      content: [{ type: "text", text: "first" }],
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const rejected = await service.sendMessage({
      userId,
      conversationId: conversation.id,
      content: [{ type: "text", text: "second" }],
    });
    releaseProvider();
    await firstRequest;

    expect(providerCalls).toBe(1);
    expect(rejected.capacityBlocked).toBe(true);
    expect(rejected.error?.code).toBe("request_concurrency_limited");
  });

  it("skips a model when its rpm guard is exceeded and uses the next eligible model", async () => {
    const conversation = await conversations.createForUser(userId, "New Conversation");
    const modelRateLimiter = createInMemoryFixedWindowRateLimiter();
    const invokedModelIds: string[] = [];

    const service = createChatService({
      conversationRepository: conversations,
      modelRateLimiter,
      providerCandidates: [
        {
          providerId: "prv_openrouter",
          modelId: "mdl_fast",
          modelName: "Fast Model",
          requestsPerMinuteLimit: 1,
          modelPriority: 1,
        },
        {
          providerId: "prv_gemini",
          modelId: "mdl_backup",
          modelName: "Backup Model",
          requestsPerMinuteLimit: 10,
          modelPriority: 2,
        },
      ],
      invokeProvider: async (candidate) => {
        invokedModelIds.push(candidate.modelId);
        return { ok: true, text: `reply from ${candidate.modelName}` };
      },
    });

    await service.sendMessage({
      userId,
      conversationId: conversation.id,
      selectedModelId: "mdl_fast",
      content: [{ type: "text", text: "first" }],
    });
    const secondResponse = await service.sendMessage({
      userId,
      conversationId: conversation.id,
      selectedModelId: "mdl_fast",
      content: [{ type: "text", text: "second" }],
    });

    expect(invokedModelIds).toEqual(["mdl_fast", "mdl_backup"]);
    expect(secondResponse.provider?.modelId).toBe("mdl_backup");
  });

  it("loads only the configured recent history window for provider calls", async () => {
    const conversation = await conversations.createForUser(userId, "New Conversation");
    for (let index = 0; index < 8; index += 1) {
      await conversations.appendMessage({
        conversationId: conversation.id,
        role: "user",
        content: [{ type: "text", text: `previous ${index}` }],
      });
    }

    let priorHistoryLength = 0;
    const service = createChatService({
      conversationRepository: conversations,
      maxProviderHistoryMessages: 3,
      providerCandidates: [
        {
          providerId: "prv_openrouter",
          modelId: "mdl_qwen3_30b_free",
          modelName: "Qwen3 30B A3B (Free)",
        },
      ],
      invokeProvider: async (_candidate, history) => {
        priorHistoryLength = history.filter((message) =>
          message.content.some(
            (item) => item.type === "text" && item.text.startsWith("previous"),
          ),
        ).length;
        return { ok: true, text: "bounded" };
      },
    });

    await service.sendMessage({
      userId,
      conversationId: conversation.id,
      content: [{ type: "text", text: "current" }],
    });

    expect(priorHistoryLength).toBe(2);
  });

  it("passes assembled workspace context to the provider and returns safe context metadata", async () => {
    const conversation = await conversations.createForUser(userId, "New Conversation");
    let providerPromptText = "";

    const service = createChatService({
      conversationRepository: conversations,
      providerCandidates: [
        {
          providerId: "prv_openrouter",
          modelId: "mdl_qwen3_30b_free",
          modelName: "Qwen3 30B A3B (Free)",
          providerName: "OpenRouter",
          contextWindow: 512,
        },
      ],
      invokeProvider: async (_candidate, prompt) => {
        providerPromptText = JSON.stringify(prompt);
        return { ok: true, text: "context-aware reply" };
      },
    });

    const response = await service.sendMessage({
      userId,
      conversationId: conversation.id,
      workspaceId: "wks_123",
      content: [{ type: "text", text: "Review this file" }],
      contextBlocks: [
        {
          sourceType: "selected_file",
          path: "src/safe.ts",
          language: "ts",
          content: "export const safe = true;",
          priority: 1,
        },
        {
          sourceType: "selected_file",
          path: ".env",
          content: "OPENROUTER_API_KEY=secret-value",
          priority: 2,
        },
      ],
    });

    expect(providerPromptText).toContain("src/safe.ts");
    expect(providerPromptText).not.toContain("secret-value");
    expect(response.context).toMatchObject({
      workspaceContextUsed: true,
      includedContextCount: 1,
      excludedContextCount: 1,
      truncatedContext: false,
      requestId: expect.stringMatching(/^route_/),
    });
    expect(JSON.stringify(response.context)).not.toContain("secret-value");
  });

  it("returns context_too_large without calling a provider when the user message cannot fit", async () => {
    const conversation = await conversations.createForUser(userId, "New Conversation");
    let providerCalls = 0;

    const service = createChatService({
      conversationRepository: conversations,
      maxUserMessageContextTokens: 8,
      providerCandidates: [
        {
          providerId: "prv_openrouter",
          modelId: "mdl_small",
          modelName: "Small Model",
          contextWindow: 120,
        },
      ],
      invokeProvider: async () => {
        providerCalls += 1;
        return { ok: true, text: "should not happen" };
      },
    });

    const response = await service.sendMessage({
      userId,
      conversationId: conversation.id,
      content: [{ type: "text", text: "too large ".repeat(50) }],
    });

    expect(providerCalls).toBe(0);
    expect(response.capacityBlocked).toBe(true);
    expect(response.error).toMatchObject({
      code: "context_too_large",
      requestId: expect.stringMatching(/^route_/),
    });
  });
});

function createMockRoutingService(model: EligibleModelCandidate | null): ModelRoutingService {
  return {
    selectRoute: vi.fn(async (input) => {
      if (model) {
        return {
          attempt: {
            id: "ratt_1",
            requestId: input.requestId ?? "route_test",
            userId: input.userId,
            conversationId: input.conversationId ?? null,
            agentRunId: input.agentRunId ?? null,
            mode: input.mode,
            registryModelId: model.registryModelId,
            status: "selected" as const,
            eligibleCount: 1,
            ineligibleCount: 0,
            reasonCode: null,
            reasonMessage: null,
            metadata: null,
            createdAt: "2026-07-19T10:00:00.000Z",
          },
          model,
          eligibleCount: 1,
          ineligibleCount: 0,
        };
      }
      return {
        attempt: {
          id: "ratt_1",
          requestId: input.requestId ?? "route_test",
          userId: input.userId,
          conversationId: input.conversationId ?? null,
          agentRunId: input.agentRunId ?? null,
          mode: input.mode,
          registryModelId: null,
          status: "no_eligible_models" as const,
          eligibleCount: 0,
          ineligibleCount: 1,
          reasonCode: "policy_disabled",
          reasonMessage: "No eligible models are available.",
          metadata: null,
          createdAt: "2026-07-19T10:00:00.000Z",
        },
        model: null,
        eligibleCount: 0,
        ineligibleCount: 1,
      };
    }),
    listAttempts: vi.fn(),
  };
}

function createMockFallbackService(model: EligibleModelCandidate | null): ModelFallbackService {
  return {
    selectFallback: vi.fn(async (input) => {
      if (model) {
        return {
          decision: {
            id: "fbk_1",
            requestId: input.requestId ?? "fallback_test",
            userId: input.userId,
            conversationId: input.conversationId ?? null,
            agentRunId: input.agentRunId ?? null,
            mode: input.mode,
            failedRoutingAttemptId: input.failedRoutingAttemptId ?? null,
            failedRegistryModelIds: input.failedRegistryModelIds,
            selectedRegistryModelId: model.registryModelId,
            status: "fallback_selected" as const,
            failureCode: input.failureCode,
            failureMessage: input.failureMessage ?? null,
            eligibleCount: 1,
            skippedFailedCount: input.failedRegistryModelIds.length,
            reasonCode: null,
            reasonMessage: null,
            metadata: null,
            createdAt: "2026-07-19T10:00:00.000Z",
          },
          model,
          exhausted: false as const,
        };
      }
      return {
        decision: {
          id: "fbk_1",
          requestId: input.requestId ?? "fallback_test",
          userId: input.userId,
          conversationId: input.conversationId ?? null,
          agentRunId: input.agentRunId ?? null,
          mode: input.mode,
          failedRoutingAttemptId: input.failedRoutingAttemptId ?? null,
          failedRegistryModelIds: input.failedRegistryModelIds,
          selectedRegistryModelId: null,
          status: "exhausted" as const,
          failureCode: input.failureCode,
          failureMessage: input.failureMessage ?? null,
          eligibleCount: 0,
          skippedFailedCount: input.failedRegistryModelIds.length,
          reasonCode: "fallback_exhausted",
          reasonMessage: "No fallback is available.",
          metadata: null,
          createdAt: "2026-07-19T10:00:00.000Z",
        },
        model: null,
        exhausted: true as const,
      };
    }),
    listDecisions: vi.fn(),
  };
}

function createMockUsageService(): ModelUsageService {
  return {
    recordUsage: vi.fn(async () => ({ counters: [] })),
    listCounters: vi.fn(),
    getSummary: vi.fn(),
  };
}

function createMockAuditService(): AuditService {
  return {
    recordEvent: vi.fn(async (input) => ({
      id: "aud_1",
      userId: input.userId,
      deviceId: input.deviceId ?? null,
      eventType: input.eventType,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      payload: input.payload ?? null,
      createdAt: input.createdAt ?? new Date("2026-07-19T10:00:00.000Z"),
    })),
    getEvent: vi.fn(),
    listEvents: vi.fn(),
  };
}

function makeEligibleModel(
  input: Partial<EligibleModelCandidate> = {},
): EligibleModelCandidate {
  return {
    registryModelId: input.registryModelId ?? "mreg_1",
    catalogModelId: input.catalogModelId ?? "mcat_1",
    providerId: input.providerId ?? "prov_1",
    providerName: input.providerName ?? "OpenRouter",
    externalModelKey: input.externalModelKey ?? "provider/model",
    displayName: input.displayName ?? "Primary Model",
    capabilities: input.capabilities ?? {
      chat: true,
      agent: false,
      vision: false,
      toolUse: false,
      jsonMode: true,
    },
    contextWindow: input.contextWindow ?? 8192,
    maxOutputTokens: input.maxOutputTokens ?? 2048,
    priorityRank: input.priorityRank ?? 1,
    providerPriorityRank: input.providerPriorityRank ?? 1,
    defaultForChat: input.defaultForChat ?? true,
    defaultForAgent: input.defaultForAgent ?? false,
    requiresCompanion: input.requiresCompanion ?? false,
    requestsPerMinuteLimit: input.requestsPerMinuteLimit ?? null,
    tokensPerDayLimit: input.tokensPerDayLimit ?? null,
    tokensPerRequestLimit: input.tokensPerRequestLimit ?? null,
    runtimeStatus: input.runtimeStatus ?? "healthy",
    providerHealthStatus: input.providerHealthStatus ?? "healthy",
    reasons: input.reasons ?? [
      {
        code: "eligible",
        message: "Model is eligible.",
      },
    ],
  };
}
