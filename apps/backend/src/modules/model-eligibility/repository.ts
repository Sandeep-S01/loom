import { eq } from "drizzle-orm";
import { getDb } from "../../db/connection.js";
import {
  modelCatalog,
  modelPolicy,
  modelRegistry,
  providers,
} from "../../db/schema.js";
import type {
  EligibilityPolicySnapshot,
  EligibilitySourceModel,
  ModelRuntimeHealthStatus,
  ProviderHealthStatus,
  ProviderHealthSnapshot,
  RuntimeHealthSnapshot,
} from "./domain.js";
import type {
  EligibilitySourceReader,
  ProviderHealthReader,
  RuntimeHealthReader,
} from "./interfaces.js";

type CatalogRow = typeof modelCatalog.$inferSelect;
type RegistryRow = typeof modelRegistry.$inferSelect;
type ProviderRow = typeof providers.$inferSelect;
type PolicyRow = typeof modelPolicy.$inferSelect;

export function createDatabaseEligibilitySourceReader(): EligibilitySourceReader {
  return {
    async listRegistryModels() {
      const rows = await getDb()
        .select({
          registry: modelRegistry,
          catalog: modelCatalog,
          provider: providers,
          policy: modelPolicy,
        })
        .from(modelRegistry)
        .innerJoin(modelCatalog, eq(modelRegistry.catalogModelId, modelCatalog.id))
        .innerJoin(providers, eq(modelCatalog.providerId, providers.id))
        .leftJoin(modelPolicy, eq(modelPolicy.registryModelId, modelRegistry.id));

      return rows.map((row) =>
        mapSourceModel(row.registry, row.catalog, row.provider, row.policy),
      );
    },
  };
}

export function createInMemoryEligibilitySourceReader(
  seed: EligibilitySourceModel[] = [],
): EligibilitySourceReader {
  return {
    async listRegistryModels() {
      return [...seed];
    },
  };
}

export function createStaticRuntimeHealthReader(
  seed: RuntimeHealthSnapshot[] = [],
): RuntimeHealthReader {
  const rowsByRegistryModelId = new Map(seed.map((row) => [row.registryModelId, row]));
  return {
    async getRuntimeHealth(registryModelIds) {
      return new Map(
        registryModelIds.map((registryModelId) => [
          registryModelId,
          rowsByRegistryModelId.get(registryModelId) ?? {
            registryModelId,
            status: "healthy" as const,
            cooldownUntil: null,
            checkedAt: null,
            reason: null,
          },
        ]),
      );
    },
  };
}

export function createStaticProviderHealthReader(
  seed: ProviderHealthSnapshot[] = [],
): ProviderHealthReader {
  const rowsByProviderId = new Map(seed.map((row) => [row.providerId, row]));
  return {
    async getProviderHealth(providerIds) {
      return new Map(
        providerIds.map((providerId) => [
          providerId,
          rowsByProviderId.get(providerId) ?? {
            providerId,
            status: "healthy" as const,
            cooldownUntil: null,
            checkedAt: null,
            reason: null,
          },
        ]),
      );
    },
  };
}

function mapSourceModel(
  registry: RegistryRow,
  catalog: CatalogRow,
  provider: ProviderRow,
  policy: PolicyRow | null,
): EligibilitySourceModel {
  return {
    registryModelId: registry.id,
    registryStatus: registry.status === "registered" ? "registered" : "archived",
    registryArchivedAt: registry.archivedAt,
    catalogModelId: catalog.id,
    providerId: provider.id,
    providerName: provider.name,
    providerStatus: normalizeProviderStatus(provider.status),
    providerPriorityRank: provider.priorityRank,
    externalModelKey: catalog.externalModelKey,
    displayName: catalog.displayName,
    capabilities: {
      chat: catalog.supportsChat,
      agent: catalog.supportsAgent,
      vision: catalog.supportsVision,
      toolUse: catalog.supportsToolUse,
      jsonMode: catalog.supportsJsonMode,
    },
    contextWindow: catalog.contextWindow,
    maxOutputTokens: catalog.maxOutputTokens,
    costTier:
      catalog.costTier === "free" || catalog.costTier === "paid"
        ? catalog.costTier
        : "unknown",
    policy: policy ? mapPolicy(policy) : null,
  };
}

function mapPolicy(row: PolicyRow): EligibilityPolicySnapshot {
  return {
    enabled: row.enabled,
    visibleInSelector: row.visibleInSelector,
    priorityRank: row.priorityRank,
    defaultForChat: row.defaultForChat,
    defaultForAgent: row.defaultForAgent,
    requiresCompanion: row.requiresCompanion,
    requestsPerMinuteLimit: row.requestsPerMinuteLimit,
    tokensPerDayLimit: row.tokensPerDayLimit,
    tokensPerRequestLimit: row.tokensPerRequestLimit,
  };
}

function normalizeProviderStatus(status: string): EligibilitySourceModel["providerStatus"] {
  if (status === "active" || status === "degraded" || status === "disabled") {
    return status;
  }
  return "disabled";
}

export function normalizeRuntimeHealthStatus(
  status: string,
): ModelRuntimeHealthStatus {
  if (
    status === "healthy" ||
    status === "degraded" ||
    status === "rate_limited" ||
    status === "open_circuit" ||
    status === "auth_invalid"
  ) {
    return status;
  }
  return "unknown";
}

export function normalizeProviderHealthStatus(status: string): ProviderHealthStatus {
  if (
    status === "healthy" ||
    status === "degraded" ||
    status === "unavailable" ||
    status === "auth_invalid"
  ) {
    return status;
  }
  return "unknown";
}
