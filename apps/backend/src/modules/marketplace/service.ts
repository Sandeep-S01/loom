import { and, desc, eq, isNull, notInArray, sql } from "drizzle-orm";
import type {
  FreeMarketplaceModelItem,
  FreeMarketplaceResponse,
  FreeMarketplaceSyncResponse,
} from "@clm/shared-types";
import { getDb } from "../../db/connection.js";
import { models, providers } from "../../db/schema.js";
import { badRequest, conflict, notFound } from "../../lib/http-errors.js";
import {
  normalizeOpenRouterFreeModels,
  type OpenRouterCatalogResponse,
} from "./openrouter-catalog.js";

interface MarketplaceServiceOptions {
  fetchFn?: typeof fetch;
}

export interface MarketplaceService {
  listFreeModels(): Promise<FreeMarketplaceResponse>;
  syncOpenRouterFreeModels(): Promise<FreeMarketplaceSyncResponse>;
  enableFreeModel(modelId: string): Promise<FreeMarketplaceModelItem>;
  disableFreeModel(modelId: string): Promise<FreeMarketplaceModelItem>;
}

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

export function createMarketplaceService(
  options: MarketplaceServiceOptions = {},
): MarketplaceService {
  const fetchFn = options.fetchFn ?? fetch;

  return {
    async listFreeModels() {
      const marketplaceModels = await listMarketplaceRows();
      return {
        models: marketplaceModels,
        lastSyncedAt: resolveLastSyncedAt(marketplaceModels),
      };
    },

    async syncOpenRouterFreeModels() {
      const provider = await getOpenRouterProvider();
      const response = await fetchFn(OPENROUTER_MODELS_URL);
      if (!response.ok) {
        throw badRequest("OpenRouter model catalog could not be refreshed.");
      }

      const body = (await response.json()) as OpenRouterCatalogResponse;
      const freeModels = normalizeOpenRouterFreeModels(body);
      const db = getDb();
      const now = new Date();
      const syncedProviderModelIds = freeModels.map((item) => item.providerModelId);
      let importedCount = 0;
      let updatedCount = 0;

      for (const item of freeModels) {
        const existing = await db.query.models.findFirst({
          where: and(
            eq(models.providerId, provider.id),
            eq(models.externalModelKey, item.providerModelId),
            isNull(models.deletedAt),
          ),
        });

        if (existing) {
          updatedCount += 1;
          await db
            .update(models)
            .set({
              name: item.displayName,
              supportsChat: item.supportsChat,
              supportsAgent: item.supportsAgent,
              supportsVision: item.supportsVision,
              contextWindow: item.contextWindow,
              costInputPer1mUsdMicros: item.costInputPer1mUsdMicros,
              costOutputPer1mUsdMicros: item.costOutputPer1mUsdMicros,
              sourceType: "provider_catalog",
              costTier: "free",
              marketplaceStatus: "available",
              lastSyncedAt: now,
              catalogMetadataJson: buildCatalogMetadata(item),
              updatedAt: now,
            })
            .where(eq(models.id, existing.id));
          continue;
        }

        importedCount += 1;
        await db.insert(models).values({
          id: buildMarketplaceModelId(item.providerModelId),
          providerId: provider.id,
          name: item.displayName,
          externalModelKey: item.providerModelId,
          supportsChat: item.supportsChat,
          supportsAgent: item.supportsAgent,
          supportsVision: item.supportsVision,
          contextWindow: item.contextWindow,
          priorityRank: 1000 + importedCount,
          active: false,
          adminStatus: "disabled",
          runtimeStatus: "healthy",
          sourceType: "provider_catalog",
          costTier: "free",
          marketplaceStatus: "available",
          lastSyncedAt: now,
          catalogMetadataJson: buildCatalogMetadata(item),
          costInputPer1mUsdMicros: item.costInputPer1mUsdMicros,
          costOutputPer1mUsdMicros: item.costOutputPer1mUsdMicros,
        });
      }

      let removedCount = 0;
      if (syncedProviderModelIds.length > 0) {
        const removedModels = await db
          .update(models)
          .set({
            adminStatus: "disabled",
            active: false,
            marketplaceStatus: "removed",
            updatedAt: now,
          })
          .where(
            and(
              eq(models.providerId, provider.id),
              eq(models.sourceType, "provider_catalog"),
              eq(models.costTier, "free"),
              isNull(models.deletedAt),
              notInArray(models.externalModelKey, syncedProviderModelIds),
            ),
          )
          .returning({ id: models.id });
        removedCount = removedModels.length;
      }

      const marketplaceModels = await listMarketplaceRows();
      return {
        models: marketplaceModels,
        lastSyncedAt: resolveLastSyncedAt(marketplaceModels),
        importedCount,
        updatedCount,
        removedCount,
      };
    },

    async enableFreeModel(modelId) {
      const model = await getMarketplaceModelOrThrow(modelId);
      const provider = await getProviderById(model.providerId);
      if (!isSecretConfigured(model.secretRef ?? provider.defaultSecretRef ?? null)) {
        throw badRequest("Configure the provider API key before enabling this free model.");
      }

      await getDb()
        .update(models)
        .set({
          adminStatus: "active",
          active: true,
          runtimeStatus: "healthy",
          cooldownUntil: null,
          marketplaceStatus: "available",
          updatedAt: new Date(),
        })
        .where(eq(models.id, modelId));
      return getMarketplaceItemOrThrow(modelId);
    },

    async disableFreeModel(modelId) {
      await getMarketplaceModelOrThrow(modelId);
      const db = getDb();
      await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(1280266061)`);
        await tx.update(models).set({
          adminStatus: "disabled",
          active: false,
          updatedAt: new Date(),
        }).where(eq(models.id, modelId));

        const [remaining] = await tx
          .select({ id: models.id })
          .from(models)
          .where(
            and(
              eq(models.adminStatus, "active"),
              eq(models.supportsChat, true),
              isNull(models.deletedAt),
            ),
          )
          .limit(1);
        if (!remaining) {
          throw conflict("At least one active chat model must remain.");
        }
      });
      return getMarketplaceItemOrThrow(modelId);
    },
  };
}

async function getOpenRouterProvider() {
  const provider = await getDb().query.providers.findFirst({
    where: eq(providers.driverKey, "openrouter"),
  });
  if (!provider) {
    throw badRequest("OpenRouter provider is not configured.");
  }
  return provider;
}

async function getProviderById(providerId: string) {
  const provider = await getDb().query.providers.findFirst({
    where: eq(providers.id, providerId),
  });
  if (!provider) {
    throw badRequest("Provider is not configured.");
  }
  return provider;
}

async function getMarketplaceModelOrThrow(modelId: string) {
  const model = await getDb().query.models.findFirst({
    where: and(
      eq(models.id, modelId),
      eq(models.sourceType, "provider_catalog"),
      eq(models.costTier, "free"),
      isNull(models.deletedAt),
    ),
  });
  if (!model) {
    throw notFound("Free marketplace model not found.");
  }
  return model;
}

async function getMarketplaceItemOrThrow(modelId: string) {
  const rows = await listMarketplaceRows();
  const item = rows.find((row) => row.id === modelId);
  if (!item) {
    throw notFound("Free marketplace model not found.");
  }
  return item;
}

async function listMarketplaceRows(): Promise<FreeMarketplaceModelItem[]> {
  const rows = await getDb()
    .select({
      id: models.id,
      providerId: providers.id,
      providerName: providers.name,
      driverKey: providers.driverKey,
      providerModelId: models.externalModelKey,
      displayName: models.name,
      secretRef: models.secretRef,
      defaultSecretRef: providers.defaultSecretRef,
      priorityRank: models.priorityRank,
      supportsChat: models.supportsChat,
      supportsAgent: models.supportsAgent,
      supportsVision: models.supportsVision,
      adminStatus: models.adminStatus,
      runtimeStatus: models.runtimeStatus,
      cooldownUntil: models.cooldownUntil,
      requestsPerMinuteLimit: models.requestsPerMinuteLimit,
      tokensPerDayLimit: models.tokensPerDayLimit,
      tokensUsedToday: models.tokensUsedToday,
      costInputPer1mUsdMicros: models.costInputPer1mUsdMicros,
      costOutputPer1mUsdMicros: models.costOutputPer1mUsdMicros,
      lastFailureCode: models.lastFailureCode,
      lastFailureAt: models.lastFailureAt,
      lastSuccessAt: models.lastSuccessAt,
      sourceType: models.sourceType,
      costTier: models.costTier,
      marketplaceStatus: models.marketplaceStatus,
      lastSyncedAt: models.lastSyncedAt,
      lastTestedAt: models.lastTestedAt,
      catalogMetadataJson: models.catalogMetadataJson,
      deletedAt: models.deletedAt,
      contextWindow: models.contextWindow,
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(
      and(
        eq(models.sourceType, "provider_catalog"),
        eq(models.costTier, "free"),
        isNull(models.deletedAt),
      ),
    )
    .orderBy(desc(models.lastSyncedAt), models.name);

  return rows.map((row) => {
    const metadata = row.catalogMetadataJson as Record<string, unknown> | null;
    return {
      id: row.id,
      providerId: row.providerId,
      providerName: row.providerName,
      driverKey: row.driverKey,
      providerModelId: row.providerModelId,
      displayName: row.displayName,
      secretRef: null,
      secretConfigured: isSecretConfigured(row.secretRef ?? row.defaultSecretRef ?? null),
      priorityRank: row.priorityRank,
      supportsChat: row.supportsChat,
      supportsAgent: row.supportsAgent,
      supportsVision: row.supportsVision,
      adminStatus: row.adminStatus as FreeMarketplaceModelItem["adminStatus"],
      runtimeStatus: row.runtimeStatus as FreeMarketplaceModelItem["runtimeStatus"],
      effectiveStatus:
        row.adminStatus === "active" && !row.deletedAt ? "active" : "disabled",
      cooldownUntil: row.cooldownUntil?.toISOString() ?? null,
      requestsPerMinuteLimit: row.requestsPerMinuteLimit,
      tokensPerDayLimit: row.tokensPerDayLimit,
      tokensUsedToday: row.tokensUsedToday,
      costInputPer1mUsdMicros: row.costInputPer1mUsdMicros,
      costOutputPer1mUsdMicros: row.costOutputPer1mUsdMicros,
      lastFailureCode: row.lastFailureCode,
      lastFailureAt: row.lastFailureAt?.toISOString() ?? null,
      lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
      sourceType: "provider_catalog",
      costTier: "free",
      marketplaceStatus:
        row.marketplaceStatus === "available" ||
        row.marketplaceStatus === "unavailable" ||
        row.marketplaceStatus === "removed" ||
        row.marketplaceStatus === "deprecated"
          ? row.marketplaceStatus
          : null,
      lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
      lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
      catalogMetadata: metadata,
      owner: typeof metadata?.owner === "string" ? metadata.owner : null,
      contextWindow: row.contextWindow,
      inputModalities: Array.isArray(metadata?.inputModalities)
        ? metadata.inputModalities.filter((item): item is string => typeof item === "string")
        : [],
      outputModalities: Array.isArray(metadata?.outputModalities)
        ? metadata.outputModalities.filter((item): item is string => typeof item === "string")
        : [],
    };
  });
}

function buildCatalogMetadata(
  item: ReturnType<typeof normalizeOpenRouterFreeModels>[number],
) {
  return {
    source: "openrouter",
    owner: item.owner,
    inputModalities: item.inputModalities,
    outputModalities: item.outputModalities,
    raw: item.raw,
  };
}

function buildMarketplaceModelId(providerModelId: string) {
  return `mdl_or_free_${providerModelId}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

function resolveLastSyncedAt(modelsList: FreeMarketplaceModelItem[]) {
  return modelsList.reduce<string | null>((latest, item) => {
    if (!item.lastSyncedAt) return latest;
    if (!latest || item.lastSyncedAt > latest) return item.lastSyncedAt;
    return latest;
  }, null);
}

function isSecretConfigured(secretRef: string | null) {
  return Boolean(secretRef && process.env[secretRef]);
}
