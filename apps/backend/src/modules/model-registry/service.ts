import { conflict, notFound } from "../../lib/http-errors.js";
import type {
  ModelCatalogDTO,
  ModelCatalogRecord,
} from "../model-catalog/domain.js";
import type {
  ModelRegistryDTO,
  ModelRegistryEntry,
  ModelRegistryRecord,
} from "./domain.js";
import type {
  ModelRegistryApprovalService,
  ModelRegistryCatalogReader,
  ModelRegistryLogger,
  ModelRegistryRepository,
} from "./interfaces.js";

interface CreateModelRegistryApprovalServiceOptions {
  repository: ModelRegistryRepository;
  catalogReader: ModelRegistryCatalogReader;
  logger?: ModelRegistryLogger;
}

const noopLogger: ModelRegistryLogger = {
  info() {},
  warn() {},
  error() {},
};

export function createModelRegistryApprovalService(
  options: CreateModelRegistryApprovalServiceOptions,
): ModelRegistryApprovalService {
  const logger = options.logger ?? noopLogger;

  return {
    async listRegistry(filters) {
      const result = await options.repository.list(filters);
      return {
        ...result,
        items: result.items.map(mapRegistryEntry),
      };
    },

    async getRegistryModel(registryModelId) {
      const entry = await options.repository.findById(registryModelId);
      if (!entry) {
        throw notFound("Registry model not found.");
      }
      return mapRegistryEntry(entry);
    },

    async registerCatalogModel(input) {
      const catalog = await options.catalogReader.findById(input.catalogModelId);
      if (!catalog) {
        throw notFound("Catalog model not found.");
      }

      if (catalog.costTier !== "free") {
        throw conflict("Only free catalog models can be registered in this release.");
      }

      const existing = await options.repository.findActiveByCatalogModelId(
        input.catalogModelId,
      );
      if (existing) {
        throw conflict("Catalog model is already registered.");
      }

      const registry = await options.repository.registerCatalogModel(input);
      if (!registry) {
        throw conflict("Catalog model is already registered.");
      }

      logger.info(
        {
          event: "model_registry.model_registered",
          actorUserId: input.actorUserId,
          registryModelId: registry.id,
          catalogModelId: registry.catalogModelId,
        },
        "Catalog model registered",
      );

      return mapRegistryEntry({ registry, catalog });
    },

    async archiveRegistryModel(input) {
      const archived = await options.repository.archive(input);
      if (!archived) {
        throw notFound("Registry model not found.");
      }

      const entry = await options.repository.findById(archived.id);
      if (!entry) {
        throw notFound("Registry model not found.");
      }

      logger.info(
        {
          event: "model_registry.model_archived",
          actorUserId: input.actorUserId,
          registryModelId: archived.id,
          catalogModelId: archived.catalogModelId,
        },
        "Registry model archived",
      );

      return mapRegistryEntry(entry);
    },
  };
}

function mapRegistryEntry(entry: ModelRegistryEntry): ModelRegistryDTO {
  return {
    id: entry.registry.id,
    catalogModelId: entry.registry.catalogModelId,
    status: entry.registry.status,
    approvedByUserId: entry.registry.approvedByUserId,
    approvedAt: entry.registry.approvedAt.toISOString(),
    archivedByUserId: entry.registry.archivedByUserId,
    archivedAt: entry.registry.archivedAt?.toISOString() ?? null,
    archiveReason: entry.registry.archiveReason,
    notes: entry.registry.notes,
    catalog: mapCatalogRecord(entry.catalog),
    createdAt: entry.registry.createdAt.toISOString(),
    updatedAt: entry.registry.updatedAt.toISOString(),
  };
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
