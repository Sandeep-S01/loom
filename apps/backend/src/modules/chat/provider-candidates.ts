import { asc, eq } from "drizzle-orm";
import { getDb } from "../../db/connection.js";
import {
  modelCatalog,
  modelPolicy,
  modelRegistry,
  providers,
} from "../../db/schema.js";
import type { ProviderCandidate } from "./service.js";

export interface ChatProviderCandidateReader {
  listCandidates(mode: "chat" | "agent"): Promise<ProviderCandidate[]>;
}

export function createDatabaseChatProviderCandidateReader(): ChatProviderCandidateReader {
  return {
    async listCandidates(mode) {
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
        .leftJoin(modelPolicy, eq(modelPolicy.registryModelId, modelRegistry.id))
        .orderBy(asc(modelPolicy.priorityRank), asc(providers.priorityRank));

      return rows
        .filter((row) => row.registry.status === "registered")
        .filter((row) => !row.registry.archivedAt)
        .filter((row) => row.provider.status !== "disabled")
        .filter((row) =>
          mode === "agent" ? row.catalog.supportsAgent : row.catalog.supportsChat,
        )
        .map((row) => ({
          providerId: row.provider.id,
          providerName: row.provider.name,
          modelId: row.registry.id,
          legacyModelId: null,
          registryModelId: row.registry.id,
          catalogModelId: row.catalog.id,
          modelName: row.catalog.displayName,
          externalModelKey: row.catalog.externalModelKey,
          baseType: row.provider.driverKey,
          providerPriority: row.provider.priorityRank,
          modelPriority: row.policy?.priorityRank ?? 100,
          supportsChat: row.catalog.supportsChat,
          supportsAgent: row.catalog.supportsAgent,
          supportsVision: row.catalog.supportsVision,
          secretRef: row.provider.defaultSecretRef,
          requestsPerMinuteLimit: row.policy?.requestsPerMinuteLimit ?? null,
          contextWindow: row.catalog.contextWindow,
        }));
    },
  };
}
