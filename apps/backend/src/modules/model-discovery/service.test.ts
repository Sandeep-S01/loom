import { describe, expect, it, vi } from "vitest";
import type { ModelCatalogService } from "../model-catalog/interfaces.js";
import type { DiscoveredProviderModel, DiscoveryProviderReference } from "./domain.js";
import {
  createDiscoveryAdapterRegistry,
  createOpenRouterDiscoveryAdapter,
} from "./adapters.js";
import {
  createInMemoryDiscoveryJobRepository,
  createInMemoryDiscoveryProviderReader,
  createInMemoryProviderSyncStatusRepository,
} from "./repository.js";
import { createModelDiscoveryService } from "./service.js";

describe("model discovery service", () => {
  it("runs provider discovery and writes free models only to catalog", async () => {
    const catalogService = createCatalogServiceMock();
    const syncStatusRepository = createInMemoryProviderSyncStatusRepository();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const metrics = {
      observeDiscoveryJob: vi.fn(),
    };
    const service = createModelDiscoveryService({
      providerReader: createInMemoryDiscoveryProviderReader([makeProvider()]),
      jobRepository: createInMemoryDiscoveryJobRepository(),
      syncStatusRepository,
      adapterRegistry: createDiscoveryAdapterRegistry([
        {
          driverKey: "openrouter",
          async discoverFreeModels() {
            return [
              makeDiscoveredModel(),
              makeDiscoveredModel({
                externalModelKey: "paid/model",
                displayName: "Paid Model",
                costTier: "paid",
              }),
            ];
          },
        },
      ]),
      catalogService,
      logger,
      metrics,
    });

    const result = await service.runProviderDiscovery({
      providerId: "prv_openrouter",
      triggerType: "manual",
      actorUserId: "usr_admin",
    });

    expect(result.status).toBe("succeeded");
    expect(result.discoveredCount).toBe(2);
    expect(result.upsertedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(catalogService.upsertDiscoveredModels).toHaveBeenCalledWith({
      providerId: "prv_openrouter",
      models: [
        expect.objectContaining({
          providerId: "prv_openrouter",
          externalModelKey: "deepseek/deepseek-chat",
          costTier: "free",
        }),
      ],
    });
    await expect(
      service.getProviderSyncStatus("prv_openrouter"),
    ).resolves.toEqual(expect.objectContaining({ status: "succeeded" }));
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "model_discovery.job_succeeded",
        providerId: "prv_openrouter",
      }),
      "Model discovery job succeeded",
    );
    expect(metrics.observeDiscoveryJob).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: "prv_openrouter",
        status: "succeeded",
        triggerType: "manual",
      }),
    );
  });

  it("records failed jobs without writing to catalog", async () => {
    const catalogService = createCatalogServiceMock();
    const service = createModelDiscoveryService({
      providerReader: createInMemoryDiscoveryProviderReader([makeProvider()]),
      jobRepository: createInMemoryDiscoveryJobRepository(),
      syncStatusRepository: createInMemoryProviderSyncStatusRepository(),
      adapterRegistry: createDiscoveryAdapterRegistry([
        {
          driverKey: "openrouter",
          async discoverFreeModels() {
            throw new Error("provider_unreachable");
          },
        },
      ]),
      catalogService,
    });

    const result = await service.runProviderDiscovery({
      providerId: "prv_openrouter",
      triggerType: "manual",
      actorUserId: "usr_admin",
    });

    expect(result.status).toBe("failed");
    expect(result.failureCode).toBe("provider_unreachable");
    expect(catalogService.upsertDiscoveredModels).not.toHaveBeenCalled();
    await expect(
      service.getProviderSyncStatus("prv_openrouter"),
    ).resolves.toEqual(expect.objectContaining({ status: "failed" }));
  });

  it("runs discovery across all discoverable providers without using adapters directly", async () => {
    const service = createModelDiscoveryService({
      providerReader: createInMemoryDiscoveryProviderReader([
        makeProvider(),
        makeProvider({
          id: "prv_disabled",
          status: "disabled",
        }),
      ]),
      jobRepository: createInMemoryDiscoveryJobRepository(),
      syncStatusRepository: createInMemoryProviderSyncStatusRepository(),
      adapterRegistry: createDiscoveryAdapterRegistry([
        {
          driverKey: "openrouter",
          async discoverFreeModels() {
            return [makeDiscoveredModel()];
          },
        },
      ]),
      catalogService: createCatalogServiceMock(),
    });

    const result = await service.runDiscoverableProvidersDiscovery({
      triggerType: "scheduled",
      actorUserId: null,
    });

    expect(result.attemptedCount).toBe(1);
    expect(result.succeededCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.jobs[0]).toEqual(
      expect.objectContaining({
        providerId: "prv_openrouter",
        triggerType: "scheduled",
        status: "succeeded",
      }),
    );
  });

  it("continues scheduled discovery when one provider cannot run", async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const service = createModelDiscoveryService({
      providerReader: createInMemoryDiscoveryProviderReader([
        makeProvider(),
        makeProvider({
          id: "prv_unknown_driver",
          driverKey: "unknown",
        }),
      ]),
      jobRepository: createInMemoryDiscoveryJobRepository(),
      syncStatusRepository: createInMemoryProviderSyncStatusRepository(),
      adapterRegistry: createDiscoveryAdapterRegistry([
        {
          driverKey: "openrouter",
          async discoverFreeModels() {
            return [makeDiscoveredModel()];
          },
        },
      ]),
      catalogService: createCatalogServiceMock(),
      logger,
    });

    const result = await service.runDiscoverableProvidersDiscovery({
      triggerType: "scheduled",
      actorUserId: null,
    });

    expect(result.attemptedCount).toBe(2);
    expect(result.succeededCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.jobs).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "model_discovery.provider_skipped",
        providerId: "prv_unknown_driver",
      }),
      "Provider discovery skipped",
    );
  });

  it("rejects inactive providers and missing adapters before creating jobs", async () => {
    const jobRepository = createInMemoryDiscoveryJobRepository();
    const service = createModelDiscoveryService({
      providerReader: createInMemoryDiscoveryProviderReader([
        makeProvider({ id: "prv_disabled", status: "disabled" }),
        makeProvider({ id: "prv_unknown_driver", driverKey: "unknown" }),
      ]),
      jobRepository,
      syncStatusRepository: createInMemoryProviderSyncStatusRepository(),
      adapterRegistry: createDiscoveryAdapterRegistry([]),
      catalogService: createCatalogServiceMock(),
    });

    await expect(
      service.runProviderDiscovery({
        providerId: "prv_disabled",
        triggerType: "manual",
        actorUserId: "usr_admin",
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });

    await expect(
      service.runProviderDiscovery({
        providerId: "prv_unknown_driver",
        triggerType: "manual",
        actorUserId: "usr_admin",
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });

    const jobs = await jobRepository.list({
      page: 1,
      pageSize: 10,
      sort: "startedAt",
      direction: "desc",
    });
    expect(jobs.total).toBe(0);
  });

  it("normalizes OpenRouter free models through the discovery adapter", async () => {
    const adapter = createOpenRouterDiscoveryAdapter(
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "qwen/qwen3:free",
              name: "Qwen3 Free",
              context_length: 32768,
              pricing: { prompt: "0", completion: "0" },
              architecture: {
                input_modalities: ["text", "image"],
                output_modalities: ["text"],
              },
            },
          ],
        }),
      })) as unknown as typeof fetch,
    );

    const models = await adapter.discoverFreeModels(makeProvider());

    expect(models).toEqual([
      expect.objectContaining({
        externalModelKey: "qwen/qwen3:free",
        displayName: "Qwen3 Free",
        costTier: "free",
        capabilities: expect.objectContaining({
          chat: true,
          agent: true,
          vision: true,
        }),
      }),
    ]);
  });
});

function createCatalogServiceMock(): ModelCatalogService {
  return {
    listCatalog: vi.fn(),
    getCatalogModel: vi.fn(),
    upsertDiscoveredModel: vi.fn(),
    upsertDiscoveredModels: vi.fn(async (input) => ({
      items: [],
      upsertedCount: input.models.length,
    })),
  };
}

function makeProvider(
  input: Partial<DiscoveryProviderReference> = {},
): DiscoveryProviderReference {
  return {
    id: "prv_openrouter",
    name: "OpenRouter",
    driverKey: "openrouter",
    status: "active",
    metadataJson: { supportsDiscovery: true },
    ...input,
  };
}

function makeDiscoveredModel(
  input: Partial<DiscoveredProviderModel> = {},
): DiscoveredProviderModel {
  return {
    externalModelKey: "deepseek/deepseek-chat",
    displayName: "DeepSeek Chat",
    description: "Free chat model",
    capabilities: {
      chat: true,
      agent: true,
      vision: false,
      toolUse: false,
      jsonMode: false,
    },
    contextWindow: 65_536,
    maxOutputTokens: null,
    costTier: "free",
    pricing: {
      inputPer1mUsdMicros: 0,
      outputPer1mUsdMicros: 0,
      raw: null,
    },
    releaseStage: "stable",
    releasedAt: null,
    deprecatedAt: null,
    deprecationReason: null,
    providerMetadata: { source: "test" },
    ...input,
  };
}
