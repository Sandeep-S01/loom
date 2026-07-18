import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./repository.js", () => ({
  listProviderCatalog: vi.fn(),
}));

vi.mock("../../redis/dashboard.js", () => ({
  listProviderCooldownKeys: vi.fn(),
}));

import { listProviderCatalog } from "./repository.js";
import { listProviderCooldownKeys } from "../../redis/dashboard.js";
import { getProvidersStatus } from "./service.js";
import { redisKeys } from "../../redis/keys.js";

describe("providers service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  it("builds grouped provider status with key and cooldown metadata", async () => {
    process.env.OPENROUTER_API_KEY = "or-key";

    vi.mocked(listProviderCatalog).mockResolvedValue([
      {
        providerId: "prv_openrouter",
        providerName: "OpenRouter",
        providerBaseType: "openrouter",
        providerStatus: "active",
        modelId: "mdl_qwen3_30b_free",
        modelName: "Qwen3 30B A3B (Free)",
        active: true,
        supportsChat: true,
        supportsAgent: true,
      },
      {
        providerId: "prv_gemini",
        providerName: "Google Gemini",
        providerBaseType: "gemini",
        providerStatus: "active",
        modelId: "mdl_gemini_2_flash",
        modelName: "Gemini 2.0 Flash",
        active: true,
        supportsChat: true,
        supportsAgent: false,
      },
    ]);
    vi.mocked(listProviderCooldownKeys).mockResolvedValue([
      redisKeys.providerCooldown("mdl_qwen3_30b_free"),
    ]);

    const response = await getProvidersStatus();

    expect(response).toEqual({
      providers: [
        {
          id: "prv_openrouter",
          name: "OpenRouter",
          baseType: "openrouter",
          status: "connected",
          keyConfigured: true,
          keyState: "configured",
          lastCheckedAt: null,
          models: [
            {
              id: "mdl_qwen3_30b_free",
              name: "Qwen3 30B A3B (Free)",
              active: true,
              supportsChat: true,
              supportsAgent: true,
              eligible: false,
              inCooldown: true,
              cooldownUntil: null,
              availabilityReason: "rate_limited",
            },
          ],
        },
        {
          id: "prv_gemini",
          name: "Google Gemini",
          baseType: "gemini",
          status: "missing_key",
          keyConfigured: false,
          keyState: "missing_key",
          lastCheckedAt: null,
          models: [
            {
              id: "mdl_gemini_2_flash",
              name: "Gemini 2.0 Flash",
              active: true,
              supportsChat: true,
              supportsAgent: false,
              eligible: false,
              inCooldown: false,
              cooldownUntil: null,
              availabilityReason: "missing_key",
            },
          ],
        },
      ],
    });
  });
});
