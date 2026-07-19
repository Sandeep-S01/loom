import { describe, expect, it, vi } from "vitest";
import type { EligibleModelCandidate, EligibilityResult } from "../model-eligibility/domain.js";
import type { ModelEligibilityService } from "../model-eligibility/interfaces.js";
import { createInMemoryRoutingAttemptRepository } from "./repository.js";
import { createModelRoutingService } from "./service.js";

describe("model routing service", () => {
  it("selects the first eligible model returned by eligibility and records the attempt", async () => {
    const eligibilityService = createEligibilityService({
      eligible: [
        makeCandidate({ registryModelId: "mreg_primary", priorityRank: 1 }),
        makeCandidate({ registryModelId: "mreg_secondary", priorityRank: 2 }),
      ],
      ineligible: [],
    });
    const repository = createInMemoryRoutingAttemptRepository();
    const service = createModelRoutingService({
      eligibilityService,
      attemptRepository: repository,
    });

    const result = await service.selectRoute({
      mode: "chat",
      userId: "usr_1",
      conversationId: "conv_1",
      companionAvailable: false,
      estimatedInputTokens: 100,
      requestedOutputTokens: 50,
      requestId: "route_test_1",
    });

    expect(result.model?.registryModelId).toBe("mreg_primary");
    expect(result.attempt).toMatchObject({
      requestId: "route_test_1",
      userId: "usr_1",
      conversationId: "conv_1",
      mode: "chat",
      registryModelId: "mreg_primary",
      status: "selected",
      eligibleCount: 2,
      ineligibleCount: 0,
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

  it("records a no eligible models attempt without inventing a fallback", async () => {
    const service = createModelRoutingService({
      eligibilityService: createEligibilityService({
        eligible: [],
        ineligible: [
          {
            registryModelId: "mreg_blocked",
            catalogModelId: "mcat_1",
            providerId: "prov_1",
            providerName: "OpenRouter",
            externalModelKey: "provider/model",
            displayName: "Blocked model",
            reasons: [
              {
                code: "runtime_unavailable",
                message: "Model runtime is currently unavailable.",
              },
            ],
          },
        ],
      }),
      attemptRepository: createInMemoryRoutingAttemptRepository(),
    });

    const result = await service.selectRoute({
      mode: "agent",
      userId: "usr_1",
      companionAvailable: true,
      requestId: "route_no_models",
    });

    expect(result.model).toBeNull();
    expect(result.attempt).toMatchObject({
      requestId: "route_no_models",
      mode: "agent",
      registryModelId: null,
      status: "no_eligible_models",
      eligibleCount: 0,
      ineligibleCount: 1,
      reasonCode: "runtime_unavailable",
    });
  });

  it("rejects duplicate request ids instead of writing duplicate attempts", async () => {
    const repository = createInMemoryRoutingAttemptRepository();
    const service = createModelRoutingService({
      eligibilityService: createEligibilityService({
        eligible: [makeCandidate()],
        ineligible: [],
      }),
      attemptRepository: repository,
    });

    await service.selectRoute({
      mode: "chat",
      userId: "usr_1",
      companionAvailable: false,
      requestId: "route_duplicate",
    });

    await expect(
      service.selectRoute({
        mode: "chat",
        userId: "usr_1",
        companionAvailable: false,
        requestId: "route_duplicate",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
    });
  });

  it("maps database duplicate races to a conflict", async () => {
    const service = createModelRoutingService({
      eligibilityService: createEligibilityService({
        eligible: [makeCandidate()],
        ineligible: [],
      }),
      attemptRepository: {
        list: vi.fn(),
        findByRequestId: vi.fn(async () => null),
        create: vi.fn(async () => {
          throw Object.assign(new Error("duplicate key"), { code: "23505" });
        }),
      },
    });

    await expect(
      service.selectRoute({
        mode: "chat",
        userId: "usr_1",
        companionAvailable: false,
        requestId: "route_race",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
    });
  });

  it("lists routing attempts with pagination and filters", async () => {
    const repository = createInMemoryRoutingAttemptRepository();
    const service = createModelRoutingService({
      eligibilityService: createEligibilityService({
        eligible: [makeCandidate({ registryModelId: "mreg_chat" })],
        ineligible: [],
      }),
      attemptRepository: repository,
    });

    await service.selectRoute({
      mode: "chat",
      userId: "usr_1",
      conversationId: "conv_1",
      companionAvailable: false,
      requestId: "route_chat",
    });
    await service.selectRoute({
      mode: "agent",
      userId: "usr_2",
      agentRunId: "run_1",
      companionAvailable: true,
      requestId: "route_agent",
    });

    const result = await service.listAttempts({
      userId: "usr_1",
      page: 1,
      pageSize: 10,
      sort: "createdAt",
      direction: "desc",
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      requestId: "route_chat",
      userId: "usr_1",
      mode: "chat",
    });
  });
});

function createEligibilityService(
  result: Pick<EligibilityResult, "eligible" | "ineligible">,
): ModelEligibilityService {
  return {
    evaluate: vi.fn(async (context) => ({
      ...result,
      mode: context.mode,
      purpose: context.purpose,
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
