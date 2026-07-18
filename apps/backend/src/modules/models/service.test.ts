import { beforeEach, describe, expect, it } from "vitest";
import {
  createInMemoryModelRegistryService,
  type CreateModelInput,
} from "./service.js";

function makeCreateInput(overrides: Partial<CreateModelInput> = {}): CreateModelInput {
  return {
    providerId: "prv_openrouter",
    providerModelId: "qwen/qwen3-30b-a3b",
    displayName: "Qwen 3 30B",
    priorityRank: 1,
    supportsChat: true,
    supportsAgent: true,
    supportsVision: false,
    adminStatus: "active",
    ...overrides,
  };
}

describe("model registry service", () => {
  beforeEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.TEST_PROVIDER_KEY;
  });

  it("lists only active eligible models in the chat selector", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const service = createInMemoryModelRegistryService({
      providers: [
        {
          id: "prv_openrouter",
          name: "OpenRouter",
          baseType: "openrouter",
          driverKey: "openrouter",
          status: "active",
          priorityRank: 1,
          defaultSecretRef: "OPENROUTER_API_KEY",
        },
      ],
      models: [
        {
          id: "mdl_qwen",
          providerId: "prv_openrouter",
          externalModelKey: "qwen/qwen3-30b-a3b",
          name: "Qwen 3 30B",
          priorityRank: 1,
          supportsChat: true,
          supportsAgent: true,
          supportsVision: false,
          adminStatus: "active",
          runtimeStatus: "healthy",
          deletedAt: null,
          cooldownUntil: null,
        },
        {
          id: "mdl_disabled",
          providerId: "prv_openrouter",
          externalModelKey: "deepseek/deepseek-chat",
          name: "Disabled Model",
          priorityRank: 2,
          supportsChat: true,
          supportsAgent: false,
          supportsVision: false,
          adminStatus: "disabled",
          runtimeStatus: "healthy",
          deletedAt: null,
          cooldownUntil: null,
        },
      ],
    });

    const selector = await service.listSelectorModels("chat");

    expect(selector).toEqual([
      expect.objectContaining({
        id: "mdl_qwen",
        displayName: "Qwen 3 30B",
        providerName: "OpenRouter",
        effectiveStatus: "active",
      }),
    ]);
  });

  it("rejects duplicate provider and provider-model combinations", async () => {
    const service = createInMemoryModelRegistryService({
      providers: [
        {
          id: "prv_openrouter",
          name: "OpenRouter",
          baseType: "openrouter",
          driverKey: "openrouter",
          status: "active",
          priorityRank: 1,
          defaultSecretRef: "OPENROUTER_API_KEY",
        },
      ],
      models: [
        {
          id: "mdl_qwen",
          providerId: "prv_openrouter",
          externalModelKey: "qwen/qwen3-30b-a3b",
          name: "Qwen 3 30B",
          priorityRank: 1,
          supportsChat: true,
          supportsAgent: true,
          supportsVision: false,
          adminStatus: "active",
          runtimeStatus: "healthy",
          deletedAt: null,
          cooldownUntil: null,
        },
      ],
    });

    await expect(service.createModel(makeCreateInput())).rejects.toThrow(
      "Model already exists for this provider.",
    );
  });

  it("refuses to delete the last active chat-capable model", async () => {
    const service = createInMemoryModelRegistryService({
      providers: [
        {
          id: "prv_openrouter",
          name: "OpenRouter",
          baseType: "openrouter",
          driverKey: "openrouter",
          status: "active",
          priorityRank: 1,
          defaultSecretRef: "OPENROUTER_API_KEY",
        },
      ],
      models: [
        {
          id: "mdl_qwen",
          providerId: "prv_openrouter",
          externalModelKey: "qwen/qwen3-30b-a3b",
          name: "Qwen 3 30B",
          priorityRank: 1,
          supportsChat: true,
          supportsAgent: true,
          supportsVision: false,
          adminStatus: "active",
          runtimeStatus: "healthy",
          deletedAt: null,
          cooldownUntil: null,
        },
      ],
    });

    await expect(service.deleteModel("mdl_qwen")).rejects.toThrow(
      "At least one active chat model must remain.",
    );
  });

  it("marks missing provider keys as missing_key and excludes those models from routing", async () => {
    const service = createInMemoryModelRegistryService({
      providers: [
        {
          id: "prv_openrouter",
          name: "OpenRouter",
          baseType: "openrouter",
          driverKey: "openrouter",
          status: "active",
          priorityRank: 1,
          defaultSecretRef: "OPENROUTER_API_KEY",
        },
      ],
      models: [
        {
          id: "mdl_qwen",
          providerId: "prv_openrouter",
          externalModelKey: "qwen/qwen3-30b-a3b",
          name: "Qwen 3 30B",
          priorityRank: 1,
          supportsChat: true,
          supportsAgent: true,
          supportsVision: false,
          adminStatus: "active",
          runtimeStatus: "healthy",
          deletedAt: null,
          cooldownUntil: null,
        },
      ],
    });

    await expect(service.listRoutingCandidates("chat")).resolves.toEqual([]);
    await expect(service.listSelectorModels("chat")).resolves.toEqual([]);
    await expect(service.getProvidersStatus()).resolves.toEqual({
      providers: [
        expect.objectContaining({
          id: "prv_openrouter",
          status: "missing_key",
          keyState: "missing_key",
          keyConfigured: false,
          models: [
            expect.objectContaining({
              id: "mdl_qwen",
              eligible: false,
              availabilityReason: "missing_key",
            }),
          ],
        }),
      ],
    });
  });

  it("marks auth-invalid models as invalid_key and keeps secrets out of safe status payloads", async () => {
    process.env.TEST_PROVIDER_KEY = "sk-secret-value";
    const service = createInMemoryModelRegistryService({
      providers: [
        {
          id: "prv_openrouter",
          name: "OpenRouter",
          baseType: "openrouter",
          driverKey: "openrouter",
          status: "active",
          priorityRank: 1,
          defaultSecretRef: "TEST_PROVIDER_KEY",
        },
      ],
      models: [
        {
          id: "mdl_qwen",
          providerId: "prv_openrouter",
          externalModelKey: "qwen/qwen3-30b-a3b",
          name: "Qwen 3 30B",
          priorityRank: 1,
          supportsChat: true,
          supportsAgent: true,
          supportsVision: false,
          adminStatus: "active",
          runtimeStatus: "healthy",
          deletedAt: null,
          cooldownUntil: null,
        },
      ],
    });

    await service.markAttemptFailure({
      modelId: "mdl_qwen",
      failureCode: "invalid_api_key",
    });

    const status = await service.getProvidersStatus();
    const serializedStatus = JSON.stringify(status);

    expect(status.providers[0]).toMatchObject({
      status: "invalid_key",
      keyState: "configured",
      models: [
        expect.objectContaining({
          id: "mdl_qwen",
          eligible: false,
          availabilityReason: "invalid_key",
        }),
      ],
    });
    expect(serializedStatus).not.toContain("sk-secret-value");
    expect(serializedStatus).not.toContain("TEST_PROVIDER_KEY");
    await expect(service.listRoutingCandidates("chat")).resolves.toEqual([]);
  });
});
