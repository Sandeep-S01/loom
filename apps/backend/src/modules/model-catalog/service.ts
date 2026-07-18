import { badRequest, notFound } from "../../lib/http-errors.js";
import type {
  ModelCatalogDTO,
  ModelCatalogRecord,
  UpsertDiscoveredModelInput,
} from "./domain.js";
import type {
  ModelCatalogLogger,
  ModelCatalogProviderRepository,
  ModelCatalogRepository,
  ModelCatalogService,
} from "./interfaces.js";
import { validateDiscoveredModelInput } from "./validators.js";

interface CreateModelCatalogServiceOptions {
  repository: ModelCatalogRepository;
  providerRepository: ModelCatalogProviderRepository;
  logger?: ModelCatalogLogger;
}

const noopLogger: ModelCatalogLogger = {
  info() {},
  warn() {},
  error() {},
};

export function createModelCatalogService(
  options: CreateModelCatalogServiceOptions,
): ModelCatalogService {
  const logger = options.logger ?? noopLogger;

  return {
    async listCatalog(filters) {
      const result = await options.repository.list(filters);
      return {
        ...result,
        items: result.items.map(mapCatalogRecord),
      };
    },

    async getCatalogModel(catalogModelId) {
      const model = await options.repository.findById(catalogModelId);
      if (!model) {
        throw notFound("Catalog model not found.");
      }
      return mapCatalogRecord(model);
    },

    async upsertDiscoveredModel(input) {
      const normalized = validateDiscoveredModelInput(input);
      await assertProviderExists(options.providerRepository, normalized.providerId);
      const model = await options.repository.upsertDiscoveredModel(normalized);

      logger.info(
        {
          event: "model_catalog.model_upserted",
          providerId: model.providerId,
          catalogModelId: model.id,
          externalModelKey: model.externalModelKey,
        },
        "Model catalog item upserted",
      );

      return mapCatalogRecord(model);
    },

    async upsertDiscoveredModels(input) {
      if (!input.providerId?.trim()) {
        throw badRequest("providerId is required.");
      }

      if (!Array.isArray(input.models) || input.models.length === 0) {
        throw badRequest("A catalog discovery batch must contain at least one model.");
      }

      await assertProviderExists(options.providerRepository, input.providerId);

      if (input.models.length > 500) {
        throw badRequest("A catalog discovery batch cannot contain more than 500 models.");
      }

      const items: ModelCatalogDTO[] = [];
      const seenExternalModelKeys = new Set<string>();
      for (const item of input.models) {
        const normalized = validateDiscoveredModelInput({
          ...item,
          providerId: input.providerId,
        });

        if (seenExternalModelKeys.has(normalized.externalModelKey)) {
          throw badRequest("A catalog discovery batch cannot contain duplicate models.");
        }
        seenExternalModelKeys.add(normalized.externalModelKey);

        const model = await options.repository.upsertDiscoveredModel(normalized);
        items.push(mapCatalogRecord(model));
      }

      logger.info(
        {
          event: "model_catalog.batch_upserted",
          providerId: input.providerId,
          upsertedCount: items.length,
        },
        "Model catalog batch upserted",
      );

      return {
        items,
        upsertedCount: items.length,
      };
    },
  };
}

async function assertProviderExists(
  providerRepository: ModelCatalogProviderRepository,
  providerId: string,
) {
  if (!(await providerRepository.exists(providerId))) {
    throw notFound("Provider not found.");
  }
}

function mapCatalogRecord(record: ModelCatalogRecord): ModelCatalogDTO {
  return {
    id: record.id,
    providerId: record.providerId,
    externalModelKey: record.externalModelKey,
    displayName: record.displayName,
    description: record.description,
    capabilities: record.capabilities,
    contextWindow: record.contextWindow,
    maxOutputTokens: record.maxOutputTokens,
    costTier: record.costTier,
    pricing: record.pricing,
    releaseStage: record.releaseStage,
    releasedAt: record.releasedAt?.toISOString() ?? null,
    deprecatedAt: record.deprecatedAt?.toISOString() ?? null,
    deprecationReason: record.deprecationReason,
    providerMetadata: record.providerMetadata,
    firstDiscoveredAt: record.firstDiscoveredAt.toISOString(),
    lastDiscoveredAt: record.lastDiscoveredAt.toISOString(),
    lastChangedAt: record.lastChangedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
