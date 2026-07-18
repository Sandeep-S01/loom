import { describe, expect, it, vi } from "vitest";
import {
  createInMemoryModelCatalogProviderRepository,
  createInMemoryModelCatalogRepository,
} from "./repository.js";
import { createModelCatalogService } from "./service.js";
import type {
  ModelCapabilities,
  ModelCatalogRecord,
  UpsertDiscoveredModelInput,
} from "./domain.js";

const now = new Date("2026-07-19T00:00:00.000Z");
const capabilities: ModelCapabilities = {
  chat: true,
  agent: false,
  vision: false,
  toolUse: true,
  jsonMode: true,
};

describe("model catalog service", () => {
  it("lists catalog models with search, filtering, and pagination", async () => {
    const service = createModelCatalogService({
      repository: createInMemoryModelCatalogRepository([
        makeCatalogRecord({
          id: "mcat_a",
          providerId: "prv_openrouter",
          externalModelKey: "deepseek/deepseek-chat",
          displayName: "DeepSeek Chat",
          capabilities,
        }),
        makeCatalogRecord({
          id: "mcat_b",
          providerId: "prv_gemini",
          externalModelKey: "gemini-2.0-flash",
          displayName: "Gemini Flash",
          capabilities: { ...capabilities, toolUse: false },
        }),
      ]),
      providerRepository: createInMemoryModelCatalogProviderRepository([
        "prv_openrouter",
        "prv_gemini",
      ]),
    });

    const result = await service.listCatalog({
      search: "deepseek",
      capability: "toolUse",
      costTier: "free",
      page: 1,
      pageSize: 10,
      sort: "displayName",
      direction: "asc",
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: "mcat_a",
        providerId: "prv_openrouter",
        externalModelKey: "deepseek/deepseek-chat",
      }),
    );
  });

  it("upserts discovered free models and logs the catalog write", async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const repository = createInMemoryModelCatalogRepository();
    const service = createModelCatalogService({
      repository,
      providerRepository: createInMemoryModelCatalogProviderRepository(["prv_openrouter"]),
      logger,
    });

    const first = await service.upsertDiscoveredModel(makeDiscoveredModel());
    const second = await service.upsertDiscoveredModel({
      ...makeDiscoveredModel(),
      displayName: "DeepSeek Chat v2",
      contextWindow: 131_072,
    });

    const listed = await service.listCatalog({
      providerId: "prv_openrouter",
      page: 1,
      pageSize: 10,
      sort: "updatedAt",
      direction: "desc",
    });

    expect(second.id).toBe(first.id);
    expect(second.displayName).toBe("DeepSeek Chat v2");
    expect(second.contextWindow).toBe(131_072);
    expect(listed.total).toBe(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "model_catalog.model_upserted",
        providerId: "prv_openrouter",
      }),
      "Model catalog item upserted",
    );
  });

  it("requires discovered models to belong to a known provider", async () => {
    const service = createModelCatalogService({
      repository: createInMemoryModelCatalogRepository(),
      providerRepository: createInMemoryModelCatalogProviderRepository(),
    });

    await expect(service.upsertDiscoveredModel(makeDiscoveredModel())).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
  });

  it("rejects paid models during the free-model MVP", async () => {
    const service = createModelCatalogService({
      repository: createInMemoryModelCatalogRepository(),
      providerRepository: createInMemoryModelCatalogProviderRepository(["prv_openrouter"]),
    });

    await expect(
      service.upsertDiscoveredModel({
        ...makeDiscoveredModel(),
        costTier: "paid",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "BAD_REQUEST",
    });
  });

  it("upserts discovery batches under one provider boundary", async () => {
    const service = createModelCatalogService({
      repository: createInMemoryModelCatalogRepository(),
      providerRepository: createInMemoryModelCatalogProviderRepository(["prv_openrouter"]),
    });

    const result = await service.upsertDiscoveredModels({
      providerId: "prv_openrouter",
      models: [
        makeDiscoveredModel(),
        {
          ...makeDiscoveredModel(),
          externalModelKey: "qwen/qwen3",
          displayName: "Qwen3",
        },
      ],
    });

    expect(result.upsertedCount).toBe(2);
    expect(result.items.map((item) => item.providerId)).toEqual([
      "prv_openrouter",
      "prv_openrouter",
    ]);
  });

  it("rejects empty and duplicate discovery batches", async () => {
    const service = createModelCatalogService({
      repository: createInMemoryModelCatalogRepository(),
      providerRepository: createInMemoryModelCatalogProviderRepository(["prv_openrouter"]),
    });

    await expect(
      service.upsertDiscoveredModels({
        providerId: "prv_openrouter",
        models: [],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "BAD_REQUEST",
    });

    await expect(
      service.upsertDiscoveredModels({
        providerId: "prv_openrouter",
        models: [makeDiscoveredModel(), makeDiscoveredModel()],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "BAD_REQUEST",
    });
  });
});

function makeDiscoveredModel(
  input: Partial<UpsertDiscoveredModelInput> = {},
): UpsertDiscoveredModelInput {
  return {
    providerId: "prv_openrouter",
    externalModelKey: "deepseek/deepseek-chat",
    displayName: "DeepSeek Chat",
    description: "Free chat model",
    capabilities,
    contextWindow: 65_536,
    maxOutputTokens: 8_192,
    costTier: "free",
    pricing: {
      inputPer1mUsdMicros: 0,
      outputPer1mUsdMicros: 0,
      raw: { prompt: "0" },
    },
    releaseStage: "stable",
    releasedAt: null,
    deprecatedAt: null,
    deprecationReason: null,
    providerMetadata: { providerSlug: "deepseek" },
    discoveredAt: now,
    ...input,
  };
}

function makeCatalogRecord(input: Partial<ModelCatalogRecord>): ModelCatalogRecord {
  return {
    id: "mcat_test",
    providerId: "prv_openrouter",
    externalModelKey: "test/model",
    displayName: "Test Model",
    description: null,
    capabilities,
    contextWindow: 4096,
    maxOutputTokens: null,
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
