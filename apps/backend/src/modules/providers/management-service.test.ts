import { describe, expect, it, vi } from "vitest";
import {
  createInMemoryProviderCredentialRepository,
  createInMemoryProviderRepository,
} from "./management-repository.js";
import { createProviderManagementService } from "./management-service.js";
import type {
  ProviderCredentialRecord,
  ProviderRecord,
} from "./domain.js";

const now = new Date("2026-07-19T00:00:00.000Z");

describe("provider management service", () => {
  it("lists providers with redacted credential status", async () => {
    const service = createProviderManagementService({
      providerRepository: createInMemoryProviderRepository([
        makeProvider({ id: "prv_openrouter", name: "OpenRouter" }),
      ]),
      credentialRepository: createInMemoryProviderCredentialRepository([
        makeCredential({
          id: "pcr_openrouter",
          providerId: "prv_openrouter",
          secretRef: "OPENROUTER_API_KEY",
          status: "configured",
        }),
      ]),
      secretReader: { hasSecret: async () => true },
    });

    const response = await service.listProviders({
      page: 1,
      pageSize: 25,
      sort: "priorityRank",
      direction: "asc",
    });

    expect(response.items).toEqual([
      expect.objectContaining({
        id: "prv_openrouter",
        credentialStatus: "configured",
        defaultSecretRef: "OPENROUTER_API_KEY",
      }),
    ]);
    expect(JSON.stringify(response)).not.toContain("secret-value");
  });

  it("updates provider metadata and creates default credential reference", async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const credentialRepository = createInMemoryProviderCredentialRepository();
    const service = createProviderManagementService({
      providerRepository: createInMemoryProviderRepository([
        makeProvider({ id: "prv_gemini", name: "Gemini" }),
      ]),
      credentialRepository,
      secretReader: { hasSecret: async () => true },
      logger,
    });

    const provider = await service.updateProvider({
      providerId: "prv_gemini",
      actorUserId: "usr_admin",
      update: {
        status: "disabled",
        priorityRank: 25,
        defaultSecretRef: "GEMINI_API_KEY",
      },
    });

    const credentials = await credentialRepository.list({ providerId: "prv_gemini" });
    expect(provider.status).toBe("disabled");
    expect(provider.priorityRank).toBe(25);
    expect(credentials).toHaveLength(1);
    expect(credentials[0]?.secretRef).toBe("GEMINI_API_KEY");
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "provider.updated",
        actorUserId: "usr_admin",
        providerId: "prv_gemini",
      }),
      "Provider updated",
    );
  });

  it("checks a credential reference without exposing the secret value", async () => {
    const service = createProviderManagementService({
      providerRepository: createInMemoryProviderRepository([
        makeProvider({ id: "prv_openrouter", name: "OpenRouter" }),
      ]),
      credentialRepository: createInMemoryProviderCredentialRepository([
        makeCredential({
          id: "pcr_openrouter",
          providerId: "prv_openrouter",
          secretRef: "OPENROUTER_API_KEY",
          status: "unchecked",
        }),
      ]),
      secretReader: { hasSecret: async (secretRef) => secretRef === "OPENROUTER_API_KEY" },
    });

    const result = await service.checkCredential({
      providerId: "prv_openrouter",
      actorUserId: "usr_admin",
    });

    expect(result.status).toBe("configured");
    expect(result.secretRef).toBe("OPENROUTER_API_KEY");
  });

  it("does not report a stale credential when the provider has no default secret", async () => {
    const service = createProviderManagementService({
      providerRepository: createInMemoryProviderRepository([
        makeProvider({
          id: "prv_openrouter",
          name: "OpenRouter",
          defaultSecretRef: null,
        }),
      ]),
      credentialRepository: createInMemoryProviderCredentialRepository([
        makeCredential({
          id: "pcr_openrouter",
          providerId: "prv_openrouter",
          secretRef: "OPENROUTER_API_KEY",
          status: "configured",
        }),
      ]),
      secretReader: { hasSecret: async () => true },
    });

    const response = await service.listProviders({
      page: 1,
      pageSize: 25,
      sort: "priorityRank",
      direction: "asc",
    });

    expect(response.items[0]?.credentialStatus).toBe("unchecked");
  });

  it("checks the provider current default credential when old credential rows exist", async () => {
    const service = createProviderManagementService({
      providerRepository: createInMemoryProviderRepository([
        makeProvider({
          id: "prv_openrouter",
          name: "OpenRouter",
          defaultSecretRef: "OPENROUTER_API_KEY_NEXT",
        }),
      ]),
      credentialRepository: createInMemoryProviderCredentialRepository([
        makeCredential({
          id: "pcr_old",
          providerId: "prv_openrouter",
          secretRef: "OPENROUTER_API_KEY_OLD",
          status: "configured",
        }),
        makeCredential({
          id: "pcr_next",
          providerId: "prv_openrouter",
          secretRef: "OPENROUTER_API_KEY_NEXT",
          status: "unchecked",
        }),
      ]),
      secretReader: {
        hasSecret: async (secretRef) => secretRef === "OPENROUTER_API_KEY_NEXT",
      },
    });

    const result = await service.checkCredential({
      providerId: "prv_openrouter",
      actorUserId: "usr_admin",
    });

    expect(result.id).toBe("pcr_next");
    expect(result.status).toBe("configured");
  });
});

function makeProvider(input: Partial<ProviderRecord>): ProviderRecord {
  return {
    id: "prv_test",
    name: "Test Provider",
    baseType: "openrouter",
    driverKey: "openrouter",
    defaultSecretRef: "OPENROUTER_API_KEY",
    metadataJson: { supportsDiscovery: true },
    status: "active",
    priorityRank: 10,
    createdAt: now,
    updatedAt: now,
    ...input,
  };
}

function makeCredential(input: Partial<ProviderCredentialRecord>): ProviderCredentialRecord {
  return {
    id: "pcr_test",
    providerId: "prv_test",
    secretRef: "TEST_API_KEY",
    status: "unchecked",
    lastCheckedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureCode: null,
    createdAt: now,
    updatedAt: now,
    ...input,
  };
}
