import { describe, expect, it, vi } from "vitest";
import type {
  ModelCapabilities,
  ModelCatalogRecord,
} from "../model-catalog/domain.js";
import {
  createInMemoryModelRegistryCatalogReader,
  createInMemoryModelRegistryRepository,
} from "./repository.js";
import { createModelRegistryApprovalService } from "./service.js";
import type { ModelRegistryRepository } from "./interfaces.js";

const now = new Date("2026-07-19T00:00:00.000Z");
const capabilities: ModelCapabilities = {
  chat: true,
  agent: false,
  vision: false,
  toolUse: true,
  jsonMode: true,
};

describe("model registry approval service", () => {
  it("registers an approved catalog model without copying policy or runtime state", async () => {
    const catalog = makeCatalogRecord();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const service = createModelRegistryApprovalService({
      repository: createInMemoryModelRegistryRepository([], [catalog]),
      catalogReader: createInMemoryModelRegistryCatalogReader([catalog]),
      logger,
    });

    const result = await service.registerCatalogModel({
      catalogModelId: catalog.id,
      actorUserId: "usr_admin",
      notes: "Approved for MVP testing",
    });

    expect(result).toEqual(
      expect.objectContaining({
        catalogModelId: catalog.id,
        status: "registered",
        approvedByUserId: "usr_admin",
        notes: "Approved for MVP testing",
      }),
    );
    expect(result.catalog.displayName).toBe("DeepSeek Chat");
    expect(result).not.toHaveProperty("priorityRank");
    expect(result).not.toHaveProperty("runtimeStatus");
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "model_registry.model_registered",
        catalogModelId: catalog.id,
      }),
      "Catalog model registered",
    );
  });

  it("rejects duplicate active registrations", async () => {
    const catalog = makeCatalogRecord();
    const service = createModelRegistryApprovalService({
      repository: createInMemoryModelRegistryRepository([], [catalog]),
      catalogReader: createInMemoryModelRegistryCatalogReader([catalog]),
    });

    await service.registerCatalogModel({
      catalogModelId: catalog.id,
      actorUserId: "usr_admin",
    });

    await expect(
      service.registerCatalogModel({
        catalogModelId: catalog.id,
        actorUserId: "usr_admin",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
    });
  });

  it("returns a conflict when a concurrent registration wins the race", async () => {
    const catalog = makeCatalogRecord();
    const repository: ModelRegistryRepository = {
      list: vi.fn(),
      findById: vi.fn(),
      findActiveByCatalogModelId: vi.fn().mockResolvedValue(null),
      registerCatalogModel: vi.fn().mockResolvedValue(null),
      archive: vi.fn(),
    };
    const service = createModelRegistryApprovalService({
      repository,
      catalogReader: createInMemoryModelRegistryCatalogReader([catalog]),
    });

    await expect(
      service.registerCatalogModel({
        catalogModelId: catalog.id,
        actorUserId: "usr_admin",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
    });
  });

  it("rejects missing and paid catalog models", async () => {
    const paidCatalog = makeCatalogRecord({ id: "mcat_paid", costTier: "paid" });
    const service = createModelRegistryApprovalService({
      repository: createInMemoryModelRegistryRepository([], [paidCatalog]),
      catalogReader: createInMemoryModelRegistryCatalogReader([paidCatalog]),
    });

    await expect(
      service.registerCatalogModel({
        catalogModelId: "mcat_missing",
        actorUserId: "usr_admin",
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });

    await expect(
      service.registerCatalogModel({
        catalogModelId: paidCatalog.id,
        actorUserId: "usr_admin",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
    });
  });

  it("lists registered models and archives without deleting history", async () => {
    const catalog = makeCatalogRecord();
    const service = createModelRegistryApprovalService({
      repository: createInMemoryModelRegistryRepository([], [catalog]),
      catalogReader: createInMemoryModelRegistryCatalogReader([catalog]),
    });

    const registered = await service.registerCatalogModel({
      catalogModelId: catalog.id,
      actorUserId: "usr_admin",
    });
    const archived = await service.archiveRegistryModel({
      registryModelId: registered.id,
      actorUserId: "usr_admin",
      archiveReason: "Not needed for launch",
    });
    const activeOnly = await service.listRegistry({
      includeArchived: false,
      page: 1,
      pageSize: 25,
      sort: "approvedAt",
      direction: "desc",
    });
    const archivedOnly = await service.listRegistry({
      includeArchived: true,
      status: "archived",
      page: 1,
      pageSize: 25,
      sort: "approvedAt",
      direction: "desc",
    });

    expect(archived.status).toBe("archived");
    expect(archived.archiveReason).toBe("Not needed for launch");
    expect(activeOnly.total).toBe(0);
    expect(archivedOnly.total).toBe(1);
  });
});

function makeCatalogRecord(input: Partial<ModelCatalogRecord> = {}): ModelCatalogRecord {
  return {
    id: "mcat_deepseek",
    providerId: "prv_openrouter",
    externalModelKey: "deepseek/deepseek-chat",
    displayName: "DeepSeek Chat",
    description: null,
    capabilities,
    contextWindow: 65_536,
    maxOutputTokens: 8_192,
    costTier: "free",
    pricing: {
      inputPer1mUsdMicros: 0,
      outputPer1mUsdMicros: 0,
      currency: "USD",
      raw: null,
    },
    releaseStage: "stable",
    releasedAt: null,
    deprecatedAt: null,
    deprecationReason: null,
    providerMetadata: {},
    firstDiscoveredAt: now,
    lastDiscoveredAt: now,
    lastChangedAt: null,
    createdAt: now,
    updatedAt: now,
    ...input,
  };
}
