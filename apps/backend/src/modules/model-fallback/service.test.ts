import { describe, expect, it, vi } from "vitest";
import type { EligibleModelCandidate } from "../model-eligibility/domain.js";
import type { ModelEligibilityService } from "../model-eligibility/interfaces.js";
import { createInMemoryFallbackDecisionRepository } from "./repository.js";
import { createModelFallbackService } from "./service.js";

describe("model fallback service", () => {
  it("selects the next eligible candidate after failed models", async () => {
    const eligibilityService = createEligibilityService([
      makeCandidate({ registryModelId: "mreg_failed", priorityRank: 1 }),
      makeCandidate({ registryModelId: "mreg_next", priorityRank: 2 }),
    ]);
    const service = createModelFallbackService({
      eligibilityService,
      decisionRepository: createInMemoryFallbackDecisionRepository(),
    });

    const result = await service.selectFallback({
      mode: "chat",
      userId: "usr_1",
      conversationId: "conv_1",
      requestId: "fallback_1",
      failedRoutingAttemptId: "ratt_1",
      failedRegistryModelIds: ["mreg_failed"],
      failureCode: "provider_5xx",
      failureMessage: "Provider failed",
      companionAvailable: false,
      estimatedInputTokens: 100,
      requestedOutputTokens: 50,
    });

    expect(result.exhausted).toBe(false);
    expect(result.model?.registryModelId).toBe("mreg_next");
    expect(result.decision).toMatchObject({
      requestId: "fallback_1",
      userId: "usr_1",
      conversationId: "conv_1",
      failedRoutingAttemptId: "ratt_1",
      failedRegistryModelIds: ["mreg_failed"],
      selectedRegistryModelId: "mreg_next",
      status: "fallback_selected",
      failureCode: "provider_5xx",
      eligibleCount: 2,
      skippedFailedCount: 1,
      reasonCode: null,
    });
    expect(eligibilityService.evaluate).toHaveBeenCalledWith({
      mode: "chat",
      purpose: "routing",
      companionAvailable: false,
      estimatedInputTokens: 100,
      requestedOutputTokens: 50,
      includeIneligible: true,
    });
  });

  it("records exhaustion when no remaining eligible candidate exists", async () => {
    const service = createModelFallbackService({
      eligibilityService: {
        evaluate: vi.fn(async (context) => ({
          mode: context.mode,
          purpose: context.purpose,
          eligible: [makeCandidate({ registryModelId: "mreg_failed" })],
          ineligible: [
            {
              registryModelId: "mreg_blocked",
              catalogModelId: "mcat_blocked",
              providerId: "prov_1",
              providerName: "OpenRouter",
              externalModelKey: "provider/blocked",
              displayName: "Blocked",
              reasons: [
                {
                  code: "runtime_unavailable" as const,
                  message: "Model runtime is currently unavailable.",
                },
              ],
            },
          ],
        })),
      },
      decisionRepository: createInMemoryFallbackDecisionRepository(),
    });

    const result = await service.selectFallback({
      mode: "agent",
      userId: "usr_1",
      requestId: "fallback_exhausted",
      failedRegistryModelIds: ["mreg_failed"],
      failureCode: "rate_limited",
      companionAvailable: true,
    });

    expect(result.exhausted).toBe(true);
    expect(result.model).toBeNull();
    expect(result.decision).toMatchObject({
      status: "exhausted",
      selectedRegistryModelId: null,
      eligibleCount: 1,
      skippedFailedCount: 1,
      reasonCode: "runtime_unavailable",
    });
  });

  it("deduplicates failed model ids before making a decision", async () => {
    const service = createModelFallbackService({
      eligibilityService: createEligibilityService([
        makeCandidate({ registryModelId: "mreg_failed" }),
        makeCandidate({ registryModelId: "mreg_next" }),
      ]),
      decisionRepository: createInMemoryFallbackDecisionRepository(),
    });

    const result = await service.selectFallback({
      mode: "chat",
      userId: "usr_1",
      requestId: "fallback_deduped",
      failedRegistryModelIds: ["mreg_failed", "mreg_failed", " "],
      failureCode: "timeout",
      companionAvailable: false,
    });

    expect(result.decision.failedRegistryModelIds).toEqual(["mreg_failed"]);
    expect(result.model?.registryModelId).toBe("mreg_next");
  });

  it("rejects empty failed model inputs", async () => {
    const service = createModelFallbackService({
      eligibilityService: createEligibilityService([makeCandidate()]),
      decisionRepository: createInMemoryFallbackDecisionRepository(),
    });

    await expect(
      service.selectFallback({
        mode: "chat",
        userId: "usr_1",
        failedRegistryModelIds: [],
        failureCode: "timeout",
        companionAvailable: false,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "BAD_REQUEST",
    });
  });

  it("rejects duplicate fallback request ids", async () => {
    const repository = createInMemoryFallbackDecisionRepository();
    const service = createModelFallbackService({
      eligibilityService: createEligibilityService([
        makeCandidate({ registryModelId: "mreg_next" }),
      ]),
      decisionRepository: repository,
    });

    await service.selectFallback({
      mode: "chat",
      userId: "usr_1",
      requestId: "fallback_duplicate",
      failedRegistryModelIds: ["mreg_failed"],
      failureCode: "timeout",
      companionAvailable: false,
    });

    await expect(
      service.selectFallback({
        mode: "chat",
        userId: "usr_1",
        requestId: "fallback_duplicate",
        failedRegistryModelIds: ["mreg_failed"],
        failureCode: "timeout",
        companionAvailable: false,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
    });
  });

  it("maps repository duplicate races to a conflict", async () => {
    const service = createModelFallbackService({
      eligibilityService: createEligibilityService([
        makeCandidate({ registryModelId: "mreg_next" }),
      ]),
      decisionRepository: {
        list: vi.fn(),
        findByRequestId: vi.fn(async () => null),
        create: vi.fn(async () => {
          throw Object.assign(new Error("duplicate key"), { code: "23505" });
        }),
      },
    });

    await expect(
      service.selectFallback({
        mode: "chat",
        userId: "usr_1",
        requestId: "fallback_race",
        failedRegistryModelIds: ["mreg_failed"],
        failureCode: "timeout",
        companionAvailable: false,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
    });
  });

  it("lists fallback decisions with filters", async () => {
    const repository = createInMemoryFallbackDecisionRepository();
    const service = createModelFallbackService({
      eligibilityService: createEligibilityService([
        makeCandidate({ registryModelId: "mreg_next" }),
      ]),
      decisionRepository: repository,
    });
    await service.selectFallback({
      mode: "chat",
      userId: "usr_1",
      conversationId: "conv_1",
      requestId: "fallback_chat",
      failedRegistryModelIds: ["mreg_failed"],
      failureCode: "timeout",
      companionAvailable: false,
    });
    await service.selectFallback({
      mode: "agent",
      userId: "usr_2",
      agentRunId: "run_1",
      requestId: "fallback_agent",
      failedRegistryModelIds: ["mreg_failed"],
      failureCode: "timeout",
      companionAvailable: true,
    });

    const result = await service.listDecisions({
      userId: "usr_1",
      page: 1,
      pageSize: 10,
      sort: "createdAt",
      direction: "desc",
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      requestId: "fallback_chat",
      userId: "usr_1",
      mode: "chat",
    });
  });
});

function createEligibilityService(
  eligible: EligibleModelCandidate[],
): ModelEligibilityService {
  return {
    evaluate: vi.fn(async (context) => ({
      mode: context.mode,
      purpose: context.purpose,
      eligible,
      ineligible: [],
    })),
  };
}

function makeCandidate(
  input: Partial<EligibleModelCandidate> = {},
): EligibleModelCandidate {
  return {
    registryModelId: input.registryModelId ?? "mreg_1",
    catalogModelId: input.catalogModelId ?? "mcat_1",
    providerId: input.providerId ?? "prov_1",
    providerName: input.providerName ?? "OpenRouter",
    externalModelKey: input.externalModelKey ?? "provider/model",
    displayName: input.displayName ?? "Free model",
    capabilities: input.capabilities ?? {
      chat: true,
      agent: true,
      vision: false,
      toolUse: true,
      jsonMode: true,
    },
    contextWindow: input.contextWindow ?? 8192,
    maxOutputTokens: input.maxOutputTokens ?? 2048,
    priorityRank: input.priorityRank ?? 1,
    providerPriorityRank: input.providerPriorityRank ?? 1,
    defaultForChat: input.defaultForChat ?? false,
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
        message: "Model is eligible for this request.",
      },
    ],
  };
}
