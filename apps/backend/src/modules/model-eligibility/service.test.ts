import { describe, expect, it, vi } from "vitest";
import type { EligibilitySourceModel } from "./domain.js";
import {
  createInMemoryEligibilitySourceReader,
  createStaticProviderHealthReader,
  createStaticRuntimeHealthReader,
} from "./repository.js";
import { createModelEligibilityService } from "./service.js";

describe("model eligibility service", () => {
  it("returns eligible models sorted by policy and provider priority", async () => {
    const service = createModelEligibilityService({
      sourceReader: createInMemoryEligibilitySourceReader([
        makeSourceModel({
          registryModelId: "mreg_slow",
          displayName: "Slow Model",
          providerPriorityRank: 20,
          policy: makePolicy({ priorityRank: 20 }),
        }),
        makeSourceModel({
          registryModelId: "mreg_fast",
          displayName: "Fast Model",
          providerPriorityRank: 10,
          policy: makePolicy({ priorityRank: 10, defaultForChat: true }),
        }),
      ]),
      runtimeHealthReader: createStaticRuntimeHealthReader(),
      providerHealthReader: createStaticProviderHealthReader(),
    });

    const result = await service.evaluate({
      mode: "chat",
      purpose: "routing",
      companionAvailable: false,
      includeIneligible: true,
    });

    expect(result.eligible.map((item) => item.registryModelId)).toEqual([
      "mreg_fast",
      "mreg_slow",
    ]);
    expect(result.eligible[0]?.defaultForChat).toBe(true);
    expect(result.ineligible).toEqual([]);
  });

  it("requires explicit policy and does not store or decide routing", async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const service = createModelEligibilityService({
      sourceReader: createInMemoryEligibilitySourceReader([
        makeSourceModel({ registryModelId: "mreg_without_policy", policy: null }),
      ]),
      runtimeHealthReader: createStaticRuntimeHealthReader(),
      providerHealthReader: createStaticProviderHealthReader(),
      logger,
    });

    const result = await service.evaluate({
      mode: "chat",
      purpose: "selector",
      companionAvailable: false,
      includeIneligible: true,
    });

    expect(result.eligible).toEqual([]);
    expect(result.ineligible[0]?.reasons).toEqual([
      expect.objectContaining({ code: "policy_missing" }),
    ]);
    expect(result).not.toHaveProperty("selectedModelId");
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "model_eligibility.evaluated",
        eligibleCount: 0,
        ineligibleCount: 1,
      }),
      "Model eligibility evaluated",
    );
  });

  it("explains policy, mode, companion, and token exclusions", async () => {
    const service = createModelEligibilityService({
      sourceReader: createInMemoryEligibilitySourceReader([
        makeSourceModel({
          registryModelId: "mreg_agent",
          capabilities: {
            chat: false,
            agent: true,
            vision: false,
            toolUse: true,
            jsonMode: true,
          },
          contextWindow: 1_000,
          maxOutputTokens: 500,
          policy: makePolicy({
            requiresCompanion: true,
            tokensPerRequestLimit: 500,
          }),
        }),
      ]),
      runtimeHealthReader: createStaticRuntimeHealthReader(),
      providerHealthReader: createStaticProviderHealthReader(),
    });

    const result = await service.evaluate({
      mode: "chat",
      purpose: "selector",
      companionAvailable: false,
      estimatedInputTokens: 600,
      requestedOutputTokens: 600,
      includeIneligible: true,
    });

    expect(result.ineligible[0]?.reasons.map((reason) => reason.code)).toEqual([
      "unsupported_mode",
      "companion_required",
      "context_window_exceeded",
      "output_token_limit_exceeded",
      "request_token_limit_exceeded",
    ]);
  });

  it("excludes disabled providers and unavailable health snapshots", async () => {
    const service = createModelEligibilityService({
      sourceReader: createInMemoryEligibilitySourceReader([
        makeSourceModel({ providerStatus: "disabled" }),
        makeSourceModel({
          registryModelId: "mreg_unavailable",
          providerId: "prv_down",
        }),
        makeSourceModel({
          registryModelId: "mreg_limited",
        }),
        makeSourceModel({
          registryModelId: "mreg_cooling",
        }),
      ]),
      runtimeHealthReader: createStaticRuntimeHealthReader([
        {
          registryModelId: "mreg_limited",
          status: "rate_limited",
          cooldownUntil: null,
          checkedAt: null,
          reason: "rate limit",
        },
        {
          registryModelId: "mreg_cooling",
          status: "healthy",
          cooldownUntil: new Date(Date.now() + 60_000),
          checkedAt: null,
          reason: "cooldown",
        },
      ]),
      providerHealthReader: createStaticProviderHealthReader([
        {
          providerId: "prv_down",
          status: "unavailable",
          checkedAt: null,
          reason: "maintenance",
        },
      ]),
    });

    const result = await service.evaluate({
      mode: "chat",
      purpose: "routing",
      companionAvailable: false,
      includeIneligible: true,
    });

    expect(result.eligible).toEqual([]);
    expect(result.ineligible.map((item) => item.reasons[0]?.code)).toEqual([
      "provider_disabled",
      "provider_unavailable",
      "runtime_unavailable",
      "runtime_unavailable",
    ]);
  });

  it("hides selector-only models without blocking routing diagnostics", async () => {
    const source = makeSourceModel({
      policy: makePolicy({ visibleInSelector: false }),
    });
    const service = createModelEligibilityService({
      sourceReader: createInMemoryEligibilitySourceReader([source]),
      runtimeHealthReader: createStaticRuntimeHealthReader(),
      providerHealthReader: createStaticProviderHealthReader(),
    });

    const selector = await service.evaluate({
      mode: "chat",
      purpose: "selector",
      companionAvailable: false,
      includeIneligible: true,
    });
    const routing = await service.evaluate({
      mode: "chat",
      purpose: "routing",
      companionAvailable: false,
      includeIneligible: true,
    });

    expect(selector.ineligible[0]?.reasons[0]?.code).toBe("hidden_from_selector");
    expect(routing.eligible[0]?.registryModelId).toBe(source.registryModelId);
  });
});

function makeSourceModel(
  input: Partial<EligibilitySourceModel> = {},
): EligibilitySourceModel {
  return {
    registryModelId: "mreg_deepseek",
    registryStatus: "registered",
    registryArchivedAt: null,
    catalogModelId: "mcat_deepseek",
    providerId: "prv_openrouter",
    providerName: "OpenRouter",
    providerStatus: "active",
    providerPriorityRank: 100,
    externalModelKey: "deepseek/deepseek-chat",
    displayName: "DeepSeek Chat",
    capabilities: {
      chat: true,
      agent: false,
      vision: false,
      toolUse: true,
      jsonMode: true,
    },
    contextWindow: 65_536,
    maxOutputTokens: 8_192,
    costTier: "free",
    policy: makePolicy(),
    ...input,
  };
}

function makePolicy(input: Partial<EligibilitySourceModel["policy"]> = {}) {
  return {
    enabled: true,
    visibleInSelector: true,
    priorityRank: 100,
    defaultForChat: false,
    defaultForAgent: false,
    requiresCompanion: false,
    requestsPerMinuteLimit: null,
    tokensPerDayLimit: null,
    tokensPerRequestLimit: null,
    ...input,
  };
}
