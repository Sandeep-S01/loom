import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { generateId } from "@clm/shared-utils";
import type {
  AvailableModelsResponse,
  CreateModelRequest,
  ListModelsResponse,
  ModelAdminStatus,
  ModelAnalyticsResponse,
  ModelEffectiveStatus,
  ModelFailoverAttemptsResponse,
  ModelRegistryItem,
  ProvidersResponse,
  UpdateModelRequest,
} from "@clm/shared-types";
import { getDb } from "../../db/connection.js";
import { badRequest, conflict, notFound } from "../../lib/http-errors.js";
import {
  models,
  providers,
} from "../../db/schema.js";
import type { ModelAnalyticsService } from "./analytics.js";
import type {
  ProviderFailureCode,
  ProviderStatusState,
  ProviderUsage,
} from "../providers/types.js";
import type { ProviderDriverRegistry } from "../providers/driver-registry.js";

export interface ModelRegistryProviderSeed {
  id: string;
  name: string;
  baseType: string;
  driverKey: string;
  status: string;
  priorityRank: number;
  defaultSecretRef: string | null;
}

export interface ModelRegistryModelSeed {
  id: string;
  providerId: string;
  externalModelKey: string;
  name: string;
  priorityRank: number;
  supportsChat: boolean;
  supportsAgent: boolean;
  supportsVision: boolean;
  contextWindow?: number;
  adminStatus: ModelAdminStatus;
  runtimeStatus:
    | "healthy"
    | "rate_limited"
    | "open_circuit"
    | "half_open"
    | "auth_invalid";
  deletedAt: string | null;
  cooldownUntil: string | null;
  secretRef?: string | null;
  requestsPerMinuteLimit?: number | null;
  tokensPerDayLimit?: number | null;
  tokensUsedToday?: number;
  tokensUsedDayBucket?: string | null;
  consecutiveFailures?: number;
  lastFailureCode?: string | null;
  lastFailureAt?: string | null;
  lastSuccessAt?: string | null;
  costInputPer1mUsdMicros?: number | null;
  costOutputPer1mUsdMicros?: number | null;
  sourceType?: "manual" | "provider_catalog" | "local";
  costTier?: "free" | "paid" | "unknown";
  marketplaceStatus?: "available" | "unavailable" | "removed" | "deprecated" | null;
  lastSyncedAt?: string | null;
  lastTestedAt?: string | null;
  catalogMetadataJson?: Record<string, unknown> | null;
}

export type CreateModelInput = CreateModelRequest;
export type UpdateModelInput = UpdateModelRequest;

export interface RegistryRoutingCandidate {
  providerId: string;
  providerName: string;
  providerStatus: string;
  providerPriority: number;
  driverKey: string;
  modelId: string;
  modelName: string;
  externalModelKey: string;
  modelPriority: number;
  supportsChat: boolean;
  supportsAgent: boolean;
  supportsVision: boolean;
  contextWindow: number;
  secretRef: string | null;
  cooldownUntil: string | null;
  requestsPerMinuteLimit: number | null;
  tokensPerDayLimit: number | null;
  tokensUsedToday: number;
  tokensUsedDayBucket: string | null;
  consecutiveFailures: number;
  costInputPer1mUsdMicros: number | null;
  costOutputPer1mUsdMicros: number | null;
}

export interface ModelRegistryService {
  listModels(input?: {
    mode?: "chat" | "agent";
    includeDisabled?: boolean;
    includeDeleted?: boolean;
  }): Promise<ListModelsResponse>;
  listSelectorModels(mode: "chat" | "agent"): Promise<AvailableModelsResponse["models"]>;
  getProvidersStatus(): Promise<ProvidersResponse>;
  createModel(input: CreateModelInput): Promise<ModelRegistryItem>;
  updateModel(modelId: string, input: UpdateModelInput): Promise<ModelRegistryItem>;
  deleteModel(modelId: string): Promise<ModelRegistryItem>;
  listRoutingCandidates(
    mode: "chat" | "agent",
    options?: { claimHalfOpen?: boolean },
  ): Promise<RegistryRoutingCandidate[]>;
  markAttemptSuccess(modelId: string, usage?: ProviderUsage): Promise<void>;
  markAttemptFailure(input: {
    modelId: string;
    failureCode: ProviderFailureCode;
    retryAfterSeconds?: number | null;
  }): Promise<void>;
  getAnalytics?(input: {
    from: string;
    to: string;
    granularity: "hour" | "day";
    modelId?: string;
  }): Promise<ModelAnalyticsResponse>;
  listAttemptEvents?(input: {
    page: number;
    pageSize: number;
    modelId?: string;
    status?: "success" | "failed" | "skipped_cooldown" | "blocked_quota";
    from?: string;
    to?: string;
  }): Promise<ModelFailoverAttemptsResponse>;
}

interface CreateModelRegistryServiceOptions {
  analyticsService?: ModelAnalyticsService;
  driverRegistry?: ProviderDriverRegistry;
}

export function createInMemoryModelRegistryService(seed?: {
  providers?: ModelRegistryProviderSeed[];
  models?: ModelRegistryModelSeed[];
}): ModelRegistryService {
  const providerItems = [...(seed?.providers ?? [])];
  const modelItems = [...(seed?.models ?? [])];

  return {
    async listModels(input) {
      return {
        models: modelItems
          .filter((item) => {
            if (!input?.includeDeleted && item.deletedAt) return false;
            if (!input?.includeDisabled && item.adminStatus !== "active") return false;
            if (input?.mode === "chat" && !item.supportsChat) return false;
            if (input?.mode === "agent" && !item.supportsAgent) return false;
            return true;
          })
          .map((item) => toRegistryItem(item, providerItems)),
      };
    },

    async listSelectorModels(mode) {
      return modelItems
        .filter((item) => isSelectorEligible(item, providerItems, mode))
        .sort((left, right) => left.priorityRank - right.priorityRank)
        .map((item) => {
          const provider = getProviderOrThrow(providerItems, item.providerId);
          return {
            id: item.id,
            name: item.name,
            displayName: item.name,
            providerId: provider.id,
            providerName: provider.name,
            supportsChat: item.supportsChat,
            supportsAgent: item.supportsAgent,
            supportsVision: item.supportsVision,
            contextWindow: item.contextWindow ?? 4096,
            effectiveStatus: toEffectiveStatus(item),
          };
        });
    },

    async getProvidersStatus() {
      return buildProvidersResponse(providerItems, modelItems);
    },

    async createModel(input) {
      assertUniqueModel(modelItems, input.providerId, input.providerModelId);
      getProviderOrThrow(providerItems, input.providerId);
      const created: ModelRegistryModelSeed = {
        id: generateId("model"),
        providerId: input.providerId,
        externalModelKey: input.providerModelId,
        name: input.displayName,
        priorityRank: input.priorityRank,
        supportsChat: input.supportsChat,
        supportsAgent: input.supportsAgent,
        supportsVision: input.supportsVision ?? false,
        adminStatus: input.adminStatus,
        runtimeStatus: "healthy",
        deletedAt: null,
        cooldownUntil: null,
        secretRef: input.secretRef ?? null,
        requestsPerMinuteLimit: input.requestsPerMinuteLimit ?? null,
        tokensPerDayLimit: input.tokensPerDayLimit ?? null,
        tokensUsedToday: 0,
        tokensUsedDayBucket: null,
        consecutiveFailures: 0,
        lastFailureCode: null,
        lastFailureAt: null,
        lastSuccessAt: null,
        costInputPer1mUsdMicros: input.costInputPer1mUsdMicros ?? null,
        costOutputPer1mUsdMicros: input.costOutputPer1mUsdMicros ?? null,
        sourceType: "manual",
        costTier: "unknown",
        marketplaceStatus: null,
        lastSyncedAt: null,
        lastTestedAt: null,
        catalogMetadataJson: null,
      };
      modelItems.push(created);
      return toRegistryItem(created, providerItems);
    },

    async updateModel(modelId, input) {
      const model = getModelOrThrow(modelItems, modelId);
      const providerId = input.providerId ?? model.providerId;
      const providerModelId = input.providerModelId ?? model.externalModelKey;

      if (
        providerId !== model.providerId ||
        providerModelId !== model.externalModelKey
      ) {
        assertUniqueModel(modelItems, providerId, providerModelId, modelId);
      }

      model.providerId = providerId;
      model.externalModelKey = providerModelId;
      model.name = input.displayName ?? model.name;
      model.priorityRank = input.priorityRank ?? model.priorityRank;
      model.supportsChat = input.supportsChat ?? model.supportsChat;
      model.supportsAgent = input.supportsAgent ?? model.supportsAgent;
      model.supportsVision = input.supportsVision ?? model.supportsVision;
      model.adminStatus = input.adminStatus ?? model.adminStatus;
      model.secretRef =
        input.secretRef !== undefined ? input.secretRef : model.secretRef ?? null;
      model.requestsPerMinuteLimit =
        input.requestsPerMinuteLimit !== undefined
          ? input.requestsPerMinuteLimit
          : model.requestsPerMinuteLimit ?? null;
      model.tokensPerDayLimit =
        input.tokensPerDayLimit !== undefined
          ? input.tokensPerDayLimit
          : model.tokensPerDayLimit ?? null;
      model.costInputPer1mUsdMicros =
        input.costInputPer1mUsdMicros !== undefined
          ? input.costInputPer1mUsdMicros
          : model.costInputPer1mUsdMicros ?? null;
      model.costOutputPer1mUsdMicros =
        input.costOutputPer1mUsdMicros !== undefined
          ? input.costOutputPer1mUsdMicros
          : model.costOutputPer1mUsdMicros ?? null;

      assertHasRemainingChatModel(modelItems);

      return toRegistryItem(model, providerItems);
    },

    async deleteModel(modelId) {
      const model = getModelOrThrow(modelItems, modelId);
      model.adminStatus = "disabled";
      model.deletedAt = new Date().toISOString();
      assertHasRemainingChatModel(modelItems);
      return toRegistryItem(model, providerItems);
    },

    async listRoutingCandidates(mode) {
      return modelItems
        .filter((item) => isRoutingEligible(item, providerItems, mode))
        .map((item) => toRoutingCandidate(item, providerItems));
    },

    async markAttemptSuccess(modelId, usage) {
      const model = getModelOrThrow(modelItems, modelId);
      const now = new Date().toISOString();
      resetDailyTokens(model, now);
      model.runtimeStatus = "healthy";
      model.cooldownUntil = null;
      model.consecutiveFailures = 0;
      model.lastSuccessAt = now;
      model.tokensUsedToday = (model.tokensUsedToday ?? 0) + (usage?.totalTokens ?? 0);
    },

    async markAttemptFailure({ modelId, failureCode, retryAfterSeconds }) {
      const model = getModelOrThrow(modelItems, modelId);
      const now = new Date().toISOString();
      model.consecutiveFailures = (model.consecutiveFailures ?? 0) + 1;
      model.lastFailureCode = failureCode;
      model.lastFailureAt = now;
      model.runtimeStatus =
          failureCode === "auth_invalid" || failureCode === "invalid_api_key"
          ? "auth_invalid"
          : model.consecutiveFailures >= 3
            ? "open_circuit"
            : "rate_limited";
      model.cooldownUntil = new Date(
        Date.now() + resolveCooldownMs(failureCode, retryAfterSeconds),
      ).toISOString();
    },

    async listAttemptEvents(input) {
      return {
        items: [],
        page: input.page,
        pageSize: input.pageSize,
        total: 0,
        hasNextPage: false,
      };
    },
  };
}

export function createDatabaseModelRegistryService(
  options: CreateModelRegistryServiceOptions = {},
): ModelRegistryService {
  const analyticsService = options.analyticsService;
  const driverRegistry = options.driverRegistry;

  return {
    async listModels(input = {}) {
      const db = getDb();
      const rows = await db
        .select({
          providerId: providers.id,
          providerName: providers.name,
          driverKey: providers.driverKey,
          providerStatus: providers.status,
          defaultSecretRef: providers.defaultSecretRef,
          modelId: models.id,
          providerModelId: models.externalModelKey,
          displayName: models.name,
          priorityRank: models.priorityRank,
          supportsChat: models.supportsChat,
          supportsAgent: models.supportsAgent,
          supportsVision: models.supportsVision,
          contextWindow: models.contextWindow,
          adminStatus: models.adminStatus,
          runtimeStatus: models.runtimeStatus,
          secretRef: models.secretRef,
          cooldownUntil: models.cooldownUntil,
          requestsPerMinuteLimit: models.requestsPerMinuteLimit,
          tokensPerDayLimit: models.tokensPerDayLimit,
          tokensUsedToday: models.tokensUsedToday,
          costInputPer1mUsdMicros: models.costInputPer1mUsdMicros,
          costOutputPer1mUsdMicros: models.costOutputPer1mUsdMicros,
          sourceType: models.sourceType,
          costTier: models.costTier,
          marketplaceStatus: models.marketplaceStatus,
          lastSyncedAt: models.lastSyncedAt,
          lastTestedAt: models.lastTestedAt,
          catalogMetadataJson: models.catalogMetadataJson,
          lastFailureCode: models.lastFailureCode,
          lastFailureAt: models.lastFailureAt,
          lastSuccessAt: models.lastSuccessAt,
          deletedAt: models.deletedAt,
        })
        .from(models)
        .innerJoin(providers, eq(models.providerId, providers.id))
        .where(
          and(
            input.includeDeleted ? undefined : isNull(models.deletedAt),
            input.includeDisabled ? undefined : eq(models.adminStatus, "active"),
            input.mode === "chat"
              ? eq(models.supportsChat, true)
              : input.mode === "agent"
                ? eq(models.supportsAgent, true)
                : undefined,
          ),
        )
        .orderBy(asc(models.priorityRank), asc(providers.priorityRank));

      return {
        models: rows.map((row) => ({
          id: row.modelId,
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
          adminStatus: row.adminStatus as ModelAdminStatus,
          runtimeStatus: row.runtimeStatus as ModelRegistryItem["runtimeStatus"],
          effectiveStatus: deriveEffectiveStatus(
            row.adminStatus as ModelAdminStatus,
            row.deletedAt?.toISOString?.() ?? null,
            row.cooldownUntil?.toISOString() ?? null,
          ),
          cooldownUntil: row.cooldownUntil?.toISOString() ?? null,
          requestsPerMinuteLimit: row.requestsPerMinuteLimit,
          tokensPerDayLimit: row.tokensPerDayLimit,
          tokensUsedToday: row.tokensUsedToday,
          costInputPer1mUsdMicros: row.costInputPer1mUsdMicros,
          costOutputPer1mUsdMicros: row.costOutputPer1mUsdMicros,
          lastFailureCode: row.lastFailureCode,
          lastFailureAt: row.lastFailureAt?.toISOString() ?? null,
          lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
          sourceType: normalizeSourceType(row.sourceType),
          costTier: normalizeCostTier(row.costTier),
          marketplaceStatus: normalizeMarketplaceStatus(row.marketplaceStatus),
          lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
          lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
          catalogMetadata:
            row.catalogMetadataJson && typeof row.catalogMetadataJson === "object"
              ? (row.catalogMetadataJson as Record<string, unknown>)
              : null,
        })),
      };
    },

    async listSelectorModels(mode) {
      const candidates = await this.listRoutingCandidates(mode, {
        claimHalfOpen: false,
      });
      return candidates.map((candidate) => ({
        id: candidate.modelId,
        name: candidate.modelName,
        displayName: candidate.modelName,
        providerId: candidate.providerId,
        providerName: candidate.providerName,
        supportsChat: candidate.supportsChat,
        supportsAgent: candidate.supportsAgent,
        supportsVision: candidate.supportsVision,
        effectiveStatus: "active" as const,
      }));
    },

    async getProvidersStatus() {
      const rows = await this.listModels({
        includeDisabled: true,
        includeDeleted: false,
      });
      const grouped = new Map<string, ProvidersResponse["providers"][number]>();
      for (const row of rows.models) {
        const provider =
          grouped.get(row.providerId) ??
          ({
            id: row.providerId,
            name: row.providerName,
            baseType: row.driverKey,
            status: "connected",
            keyState: row.secretConfigured ? "configured" : "missing_key",
            keyConfigured: row.secretConfigured,
            lastCheckedAt: row.lastFailureAt ?? row.lastSuccessAt,
            models: [],
          } as ProvidersResponse["providers"][number]);
        const availability = resolveModelAvailability({
          adminStatus: row.adminStatus,
          runtimeStatus: row.runtimeStatus,
          effectiveStatus: row.effectiveStatus,
          secretConfigured: row.secretConfigured,
        });
        provider.status = mergeProviderStatus(provider.status, availability.reason);
        provider.keyState = provider.keyConfigured ? "configured" : "missing_key";
        provider.models.push({
          id: row.id,
          name: row.displayName,
          active: row.adminStatus === "active",
          supportsChat: row.supportsChat,
          supportsAgent: row.supportsAgent,
          eligible: availability.routable,
          inCooldown: row.effectiveStatus === "rate_limited",
          cooldownUntil: row.cooldownUntil,
          effectiveStatus: row.effectiveStatus,
          availabilityReason: availability.reason,
        });
        grouped.set(row.providerId, provider);
      }
      return { providers: Array.from(grouped.values()) };
    },

    async createModel(input) {
      const db = getDb();
      await ensureProviderExists(input.providerId);
      await ensureNoDuplicateModel(input.providerId, input.providerModelId);
      const provider = await getProviderRow(input.providerId);
      if (!provider) {
        throw badRequest("Unknown provider.");
      }
      const secretRef = input.secretRef ?? provider.defaultSecretRef ?? null;
      const driver = driverRegistry?.getDriver(provider.driverKey);
      if (!driver) {
        throw badRequest("Unsupported provider driver.");
      }
      const connectionResult = await driver.testConnection({
        providerModelId: input.providerModelId,
        providerName: provider.name,
        secretRef,
      });
      if (!connectionResult.ok) {
        throw badRequest(connectionResult.message);
      }

      const createdId = generateId("model");
      await db.insert(models).values({
        id: createdId,
        providerId: input.providerId,
        name: input.displayName,
        externalModelKey: input.providerModelId,
        supportsChat: input.supportsChat,
        supportsAgent: input.supportsAgent,
        supportsVision: input.supportsVision ?? false,
        contextWindow: 4096,
        priorityRank: input.priorityRank,
        active: input.adminStatus === "active",
        adminStatus: input.adminStatus,
        runtimeStatus: "healthy",
        secretRef,
        requestsPerMinuteLimit: input.requestsPerMinuteLimit ?? null,
        tokensPerDayLimit: input.tokensPerDayLimit ?? null,
        tokensUsedToday: 0,
        tokensUsedDayBucket: null,
        consecutiveFailures: 0,
        lastFailureCode: null,
        lastFailureAt: null,
        lastSuccessAt: null,
        cooldownUntil: null,
        costInputPer1mUsdMicros: input.costInputPer1mUsdMicros ?? null,
        costOutputPer1mUsdMicros: input.costOutputPer1mUsdMicros ?? null,
        sourceType: "manual",
        costTier: "unknown",
        marketplaceStatus: null,
        lastSyncedAt: null,
        lastTestedAt: null,
        catalogMetadataJson: null,
      });

      const response = await this.listModels({ includeDisabled: true });
      const created = response.models.find((model) => model.id === createdId);
      if (!created) throw new Error("Created model could not be loaded");
      return created;
    },

    async updateModel(modelId, input) {
      const db = getDb();
      const existing = await getModelRow(modelId);
      if (!existing) throw notFound("Model not found");

      const nextProviderId = input.providerId ?? existing.providerId;
      const nextProviderModelId =
        input.providerModelId ?? existing.externalModelKey;
      if (
        nextProviderId !== existing.providerId ||
        nextProviderModelId !== existing.externalModelKey
      ) {
        await ensureNoDuplicateModel(nextProviderId, nextProviderModelId, modelId);
      }

      const provider = await getProviderRow(nextProviderId);
      if (!provider) {
        throw badRequest("Unknown provider.");
      }
      const nextSecretRef =
        input.secretRef !== undefined
          ? input.secretRef
          : existing.secretRef ?? provider.defaultSecretRef ?? null;

      const needsConnectionTest =
        nextProviderId !== existing.providerId ||
        nextProviderModelId !== existing.externalModelKey ||
        nextSecretRef !== existing.secretRef;
      if (needsConnectionTest) {
        const driver = driverRegistry?.getDriver(provider.driverKey);
        if (!driver) {
          throw badRequest("Unsupported provider driver.");
        }
        const connectionResult = await driver.testConnection({
          providerModelId: nextProviderModelId,
          providerName: provider.name,
          secretRef: nextSecretRef,
        });
        if (!connectionResult.ok) {
          throw badRequest(connectionResult.message);
        }
      }

      await db.transaction(async (tx) => {
        await lockModelRegistry(tx);
        await tx.update(models).set({
          providerId: nextProviderId,
          name: input.displayName ?? existing.name,
          externalModelKey: nextProviderModelId,
          supportsChat: input.supportsChat ?? existing.supportsChat,
          supportsAgent: input.supportsAgent ?? existing.supportsAgent,
          supportsVision: input.supportsVision ?? existing.supportsVision,
          priorityRank: input.priorityRank ?? existing.priorityRank,
          active: (input.adminStatus ?? existing.adminStatus) === "active",
          adminStatus: input.adminStatus ?? existing.adminStatus,
          secretRef: nextSecretRef,
          requestsPerMinuteLimit:
            input.requestsPerMinuteLimit !== undefined
              ? input.requestsPerMinuteLimit
              : existing.requestsPerMinuteLimit,
          tokensPerDayLimit:
            input.tokensPerDayLimit !== undefined
              ? input.tokensPerDayLimit
              : existing.tokensPerDayLimit,
          costInputPer1mUsdMicros:
            input.costInputPer1mUsdMicros !== undefined
              ? input.costInputPer1mUsdMicros
              : existing.costInputPer1mUsdMicros,
          costOutputPer1mUsdMicros:
            input.costOutputPer1mUsdMicros !== undefined
              ? input.costOutputPer1mUsdMicros
              : existing.costOutputPer1mUsdMicros,
          updatedAt: new Date(),
        }).where(eq(models.id, modelId));
        await assertHasRemainingChatModelInTransaction(tx);
      });

      const response = await this.listModels({
        includeDisabled: true,
      });
      const updated = response.models.find((model) => model.id === modelId);
      if (!updated) throw new Error("Updated model could not be loaded");
      return updated;
    },

    async deleteModel(modelId) {
      const db = getDb();
      const existing = await getModelRow(modelId);
      if (!existing) throw notFound("Model not found");

      await db.transaction(async (tx) => {
        await lockModelRegistry(tx);
        await tx.update(models).set({
          adminStatus: "disabled",
          active: false,
          deletedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(models.id, modelId));
        await assertHasRemainingChatModelInTransaction(tx);
      });

      const response = await this.listModels({ includeDisabled: true });
      const deleted = response.models.find((model) => model.id === modelId);
      if (!deleted) throw new Error("Deleted model could not be loaded");
      return deleted;
    },

    async listRoutingCandidates(mode, routingOptions = {}) {
      const db = getDb();
      const rows = await db
        .select({
          providerId: providers.id,
          providerName: providers.name,
          providerStatus: providers.status,
          providerPriority: providers.priorityRank,
          driverKey: providers.driverKey,
          defaultSecretRef: providers.defaultSecretRef,
          modelId: models.id,
          modelName: models.name,
          externalModelKey: models.externalModelKey,
          modelPriority: models.priorityRank,
          supportsChat: models.supportsChat,
          supportsAgent: models.supportsAgent,
          supportsVision: models.supportsVision,
          contextWindow: models.contextWindow,
          adminStatus: models.adminStatus,
          runtimeStatus: models.runtimeStatus,
          secretRef: models.secretRef,
          cooldownUntil: models.cooldownUntil,
          requestsPerMinuteLimit: models.requestsPerMinuteLimit,
          tokensPerDayLimit: models.tokensPerDayLimit,
          tokensUsedToday: models.tokensUsedToday,
          tokensUsedDayBucket: models.tokensUsedDayBucket,
          consecutiveFailures: models.consecutiveFailures,
          deletedAt: models.deletedAt,
          costInputPer1mUsdMicros: models.costInputPer1mUsdMicros,
          costOutputPer1mUsdMicros: models.costOutputPer1mUsdMicros,
        })
        .from(models)
        .innerJoin(providers, eq(models.providerId, providers.id))
        .where(
          and(
            eq(models.adminStatus, "active"),
            isNull(models.deletedAt),
            mode === "chat" ? eq(models.supportsChat, true) : eq(models.supportsAgent, true),
            ne(providers.status, "disabled"),
          ),
        )
        .orderBy(asc(models.priorityRank), asc(providers.priorityRank));

      const now = new Date();
      const eligibleRows: typeof rows = [];
      for (const row of rows) {
        if (row.runtimeStatus === "auth_invalid") {
          continue;
        }

        if (row.runtimeStatus === "open_circuit" || row.runtimeStatus === "half_open") {
          if (row.cooldownUntil && row.cooldownUntil.getTime() > now.getTime()) {
            continue;
          }

          if (routingOptions.claimHalfOpen === false) {
            eligibleRows.push(row);
            continue;
          }

          const [claimed] = await db
            .update(models)
            .set({
              runtimeStatus: "half_open",
              cooldownUntil: new Date(now.getTime() + 30_000),
              updatedAt: now,
            })
            .where(
              and(
                eq(models.id, row.modelId),
                inArray(models.runtimeStatus, ["open_circuit", "half_open"]),
                or(isNull(models.cooldownUntil), lte(models.cooldownUntil, now)),
              ),
            )
            .returning({ id: models.id });
          if (!claimed) {
            continue;
          }
        } else if (row.cooldownUntil && row.cooldownUntil.getTime() > now.getTime()) {
          continue;
        }

        if (!isSecretConfigured(row.secretRef ?? row.defaultSecretRef ?? null)) {
          continue;
        }

        if (row.tokensPerDayLimit != null) {
          const tokensUsedToday = resetTokenCounterIfNewDay(
            row.tokensUsedToday,
            row.tokensUsedDayBucket ? String(row.tokensUsedDayBucket) : null,
          );
          if (tokensUsedToday >= row.tokensPerDayLimit) {
            continue;
          }
        }

        eligibleRows.push(row);
      }

      return eligibleRows.map((row) => ({
          providerId: row.providerId,
          providerName: row.providerName,
          providerStatus: row.providerStatus,
          providerPriority: row.providerPriority,
          driverKey: row.driverKey,
          modelId: row.modelId,
          modelName: row.modelName,
          externalModelKey: row.externalModelKey,
          modelPriority: row.modelPriority,
          supportsChat: row.supportsChat,
          supportsAgent: row.supportsAgent,
          supportsVision: row.supportsVision,
          contextWindow: row.contextWindow,
          secretRef: row.secretRef ?? row.defaultSecretRef ?? null,
          cooldownUntil: row.cooldownUntil?.toISOString() ?? null,
          requestsPerMinuteLimit: row.requestsPerMinuteLimit,
          tokensPerDayLimit: row.tokensPerDayLimit,
          tokensUsedToday: row.tokensUsedToday,
          tokensUsedDayBucket: row.tokensUsedDayBucket ? String(row.tokensUsedDayBucket) : null,
          consecutiveFailures: row.consecutiveFailures,
          costInputPer1mUsdMicros: row.costInputPer1mUsdMicros,
          costOutputPer1mUsdMicros: row.costOutputPer1mUsdMicros,
        }));
    },

    async markAttemptSuccess(modelId, usage) {
      const db = getDb();
      const existing = await getModelRow(modelId);
      if (!existing) return;
      const now = new Date();
      const dailyTotal = resetTokenCounterIfNewDay(
        existing.tokensUsedToday,
        existing.tokensUsedDayBucket ? String(existing.tokensUsedDayBucket) : null,
      );
      await db
        .update(models)
        .set({
          runtimeStatus: "healthy",
          cooldownUntil: null,
          consecutiveFailures: 0,
          lastSuccessAt: now,
          tokensUsedToday: dailyTotal + (usage?.totalTokens ?? 0),
          tokensUsedDayBucket: now.toISOString().slice(0, 10),
          updatedAt: now,
        })
        .where(eq(models.id, modelId));
    },

    async markAttemptFailure({ modelId, failureCode, retryAfterSeconds }) {
      const db = getDb();
      const existing = await getModelRow(modelId);
      if (!existing) return;
      const now = new Date();
      const consecutiveFailures = existing.consecutiveFailures + 1;
      await db
        .update(models)
        .set({
          runtimeStatus:
            failureCode === "auth_invalid" || failureCode === "invalid_api_key"
              ? "auth_invalid"
              : consecutiveFailures >= 3
                ? "open_circuit"
                : "rate_limited",
          cooldownUntil: new Date(
            Date.now() + resolveCooldownMs(failureCode, retryAfterSeconds),
          ),
          consecutiveFailures,
          lastFailureCode: failureCode,
          lastFailureAt: now,
          updatedAt: now,
        })
        .where(eq(models.id, modelId));
    },

    async getAnalytics(input) {
      if (!analyticsService) {
        return {
          summary: [],
          series: [],
        };
      }
      return analyticsService.getAnalytics(input);
    },

    async listAttemptEvents(input) {
      if (!analyticsService) {
        return {
          items: [],
          page: input.page,
          pageSize: input.pageSize,
          total: 0,
          hasNextPage: false,
        };
      }
      return analyticsService.listAttemptEvents(input);
    },
  };
}

function getProviderOrThrow(
  providersList: ModelRegistryProviderSeed[],
  providerId: string,
) {
  const provider = providersList.find((item) => item.id === providerId);
  if (!provider) {
    throw badRequest("Unknown provider.");
  }
  return provider;
}

function getModelOrThrow(modelsList: ModelRegistryModelSeed[], modelId: string) {
  const model = modelsList.find((item) => item.id === modelId);
  if (!model) {
    throw notFound("Model not found");
  }
  return model;
}

function toRegistryItem(
  item: ModelRegistryModelSeed,
  providerItems: ModelRegistryProviderSeed[],
): ModelRegistryItem {
  const provider = getProviderOrThrow(providerItems, item.providerId);
  const secretRef = item.secretRef ?? provider.defaultSecretRef ?? null;
  return {
    id: item.id,
    providerId: provider.id,
    providerName: provider.name,
    driverKey: provider.driverKey,
    providerModelId: item.externalModelKey,
    displayName: item.name,
    secretRef: null,
    secretConfigured: isSecretConfigured(secretRef),
    priorityRank: item.priorityRank,
    supportsChat: item.supportsChat,
    supportsAgent: item.supportsAgent,
    supportsVision: item.supportsVision,
    adminStatus: item.adminStatus,
    runtimeStatus: item.runtimeStatus,
    effectiveStatus: toEffectiveStatus(item),
    cooldownUntil: item.cooldownUntil,
    requestsPerMinuteLimit: item.requestsPerMinuteLimit ?? null,
    tokensPerDayLimit: item.tokensPerDayLimit ?? null,
    tokensUsedToday: item.tokensUsedToday ?? 0,
    costInputPer1mUsdMicros: item.costInputPer1mUsdMicros ?? null,
    costOutputPer1mUsdMicros: item.costOutputPer1mUsdMicros ?? null,
    lastFailureCode: item.lastFailureCode ?? null,
    lastFailureAt: item.lastFailureAt ?? null,
    lastSuccessAt: item.lastSuccessAt ?? null,
    sourceType: normalizeSourceType(item.sourceType),
    costTier: normalizeCostTier(item.costTier),
    marketplaceStatus: normalizeMarketplaceStatus(item.marketplaceStatus ?? null),
    lastSyncedAt: item.lastSyncedAt ?? null,
    lastTestedAt: item.lastTestedAt ?? null,
    catalogMetadata: item.catalogMetadataJson ?? null,
  };
}

function normalizeSourceType(value: unknown): ModelRegistryItem["sourceType"] {
  return value === "provider_catalog" || value === "local" || value === "manual"
    ? value
    : "manual";
}

function normalizeCostTier(value: unknown): ModelRegistryItem["costTier"] {
  return value === "free" || value === "paid" || value === "unknown"
    ? value
    : "unknown";
}

function normalizeMarketplaceStatus(
  value: unknown,
): ModelRegistryItem["marketplaceStatus"] {
  return value === "available" ||
    value === "unavailable" ||
    value === "removed" ||
    value === "deprecated"
    ? value
    : null;
}

function toEffectiveStatus(item: ModelRegistryModelSeed): ModelEffectiveStatus {
  return deriveEffectiveStatus(item.adminStatus, item.deletedAt, item.cooldownUntil);
}

function deriveEffectiveStatus(
  adminStatus: ModelAdminStatus,
  deletedAt: string | null,
  cooldownUntil: string | null,
): ModelEffectiveStatus {
  if (adminStatus !== "active" || deletedAt) return "disabled";
  if (cooldownUntil && new Date(cooldownUntil).getTime() > Date.now()) {
    return "rate_limited";
  }
  return "active";
}

function isSelectorEligible(
  item: ModelRegistryModelSeed,
  providerItems: ModelRegistryProviderSeed[],
  mode: "chat" | "agent",
) {
  const provider = getProviderOrThrow(providerItems, item.providerId);
  const secretConfigured = isSecretConfigured(item.secretRef ?? provider.defaultSecretRef);
  return (
    provider.status !== "disabled" &&
    item.adminStatus === "active" &&
    !item.deletedAt &&
    (mode === "chat" ? item.supportsChat : item.supportsAgent) &&
    toEffectiveStatus(item) === "active" &&
    item.runtimeStatus !== "auth_invalid" &&
    item.runtimeStatus !== "open_circuit" &&
    secretConfigured
  );
}

function isRoutingEligible(
  item: ModelRegistryModelSeed,
  providerItems: ModelRegistryProviderSeed[],
  mode: "chat" | "agent",
) {
  if (!isSelectorEligible(item, providerItems, mode)) {
    return false;
  }
  if (!isSecretConfigured(item.secretRef ?? getProviderOrThrow(providerItems, item.providerId).defaultSecretRef)) {
    return false;
  }
  return true;
}

function toRoutingCandidate(
  item: ModelRegistryModelSeed,
  providerItems: ModelRegistryProviderSeed[],
): RegistryRoutingCandidate {
  const provider = getProviderOrThrow(providerItems, item.providerId);
  return {
    providerId: provider.id,
    providerName: provider.name,
    providerStatus: provider.status,
    providerPriority: provider.priorityRank,
    driverKey: provider.driverKey,
    modelId: item.id,
    modelName: item.name,
    externalModelKey: item.externalModelKey,
    modelPriority: item.priorityRank,
    supportsChat: item.supportsChat,
    supportsAgent: item.supportsAgent,
    supportsVision: item.supportsVision,
    contextWindow: item.contextWindow ?? 4096,
    secretRef: item.secretRef ?? provider.defaultSecretRef ?? null,
    cooldownUntil: item.cooldownUntil,
    requestsPerMinuteLimit: item.requestsPerMinuteLimit ?? null,
    tokensPerDayLimit: item.tokensPerDayLimit ?? null,
    tokensUsedToday: item.tokensUsedToday ?? 0,
    tokensUsedDayBucket: item.tokensUsedDayBucket ?? null,
    consecutiveFailures: item.consecutiveFailures ?? 0,
    costInputPer1mUsdMicros: item.costInputPer1mUsdMicros ?? null,
    costOutputPer1mUsdMicros: item.costOutputPer1mUsdMicros ?? null,
  };
}

function buildProvidersResponse(
  providerItems: ModelRegistryProviderSeed[],
  modelItems: ModelRegistryModelSeed[],
): ProvidersResponse {
  return {
    providers: providerItems.map((provider) => ({
      ...buildProviderStatusEntry(provider, modelItems),
    })),
  };
}

function buildProviderStatusEntry(
  provider: ModelRegistryProviderSeed,
  modelItems: ModelRegistryModelSeed[],
): ProvidersResponse["providers"][number] {
  const keyConfigured = isSecretConfigured(provider.defaultSecretRef);
  const providerModels = modelItems
    .filter((model) => model.providerId === provider.id && !model.deletedAt)
    .map((model) => {
      const availability = resolveModelAvailability({
        adminStatus: model.adminStatus,
        runtimeStatus: model.runtimeStatus,
        effectiveStatus: toEffectiveStatus(model),
        secretConfigured: isSecretConfigured(model.secretRef ?? provider.defaultSecretRef),
      });

      return {
          id: model.id,
          name: model.name,
          active: model.adminStatus === "active",
          supportsChat: model.supportsChat,
          supportsAgent: model.supportsAgent,
          eligible: availability.routable,
          inCooldown: toEffectiveStatus(model) === "rate_limited",
          cooldownUntil: model.cooldownUntil,
          effectiveStatus: toEffectiveStatus(model),
          availabilityReason: availability.reason,
        };
    });

  const baseStatus: ProviderStatusState = provider.status === "disabled"
    ? "disabled"
    : keyConfigured
      ? "connected"
      : "missing_key";
  let modelStatus: ProviderStatusState = baseStatus;
  for (const model of providerModels) {
    modelStatus = mergeProviderStatus(modelStatus, model.availabilityReason);
  }

  return {
    id: provider.id,
    name: provider.name,
    baseType: provider.baseType,
    status: modelStatus,
    keyState: keyConfigured ? "configured" : "missing_key",
    keyConfigured,
    lastCheckedAt: null,
    models: providerModels,
  };
}

function resolveModelAvailability(input: {
  adminStatus: ModelAdminStatus;
  runtimeStatus: ModelRegistryItem["runtimeStatus"];
  effectiveStatus: ModelEffectiveStatus;
  secretConfigured: boolean;
}): {
  routable: boolean;
  reason: Exclude<ProviderStatusState, "disabled"> | "disabled" | "rate_limited";
} {
  if (input.adminStatus !== "active" || input.effectiveStatus === "disabled") {
    return { routable: false, reason: "disabled" };
  }

  if (!input.secretConfigured) {
    return { routable: false, reason: "missing_key" };
  }

  if (input.runtimeStatus === "auth_invalid") {
    return { routable: false, reason: "invalid_key" };
  }

  if (input.runtimeStatus === "open_circuit") {
    return { routable: false, reason: "unavailable" };
  }

  if (input.effectiveStatus === "rate_limited" || input.runtimeStatus === "rate_limited") {
    return { routable: false, reason: "rate_limited" };
  }

  return { routable: true, reason: "connected" };
}

function mergeProviderStatus(
  current: ProviderStatusState,
  reason: ReturnType<typeof resolveModelAvailability>["reason"],
): ProviderStatusState {
  const currentRank = providerStatusRank(current);
  const nextStatus = reason === "rate_limited" ? "degraded" : reason;
  return providerStatusRank(nextStatus) > currentRank ? nextStatus : current;
}

function providerStatusRank(status: ProviderStatusState) {
  switch (status) {
    case "disabled":
      return 6;
    case "invalid_key":
      return 5;
    case "missing_key":
      return 4;
    case "unavailable":
      return 3;
    case "degraded":
      return 2;
    case "connected":
    default:
      return 1;
  }
}

function assertUniqueModel(
  modelItems: ModelRegistryModelSeed[],
  providerId: string,
  providerModelId: string,
  currentModelId?: string,
) {
  const exists = modelItems.some(
    (item) =>
      item.id !== currentModelId &&
      item.providerId === providerId &&
      item.externalModelKey === providerModelId &&
      !item.deletedAt,
  );

  if (exists) {
    throw conflict("Model already exists for this provider.");
  }
}

function assertHasRemainingChatModel(modelItems: ModelRegistryModelSeed[]) {
  const remaining = modelItems.some(
    (item) =>
      item.adminStatus === "active" &&
      !item.deletedAt &&
      item.supportsChat,
  );

  if (!remaining) {
    throw conflict("At least one active chat model must remain.");
  }
}

async function ensureProviderExists(providerId: string) {
  const provider = await getProviderRow(providerId);
  if (!provider) {
    throw badRequest("Unknown provider.");
  }
}

async function ensureNoDuplicateModel(
  providerId: string,
  providerModelId: string,
  currentModelId?: string,
) {
  const db = getDb();
  const existing = await db.query.models.findFirst({
    where: and(
      eq(models.providerId, providerId),
      eq(models.externalModelKey, providerModelId),
      isNull(models.deletedAt),
      currentModelId ? ne(models.id, currentModelId) : undefined,
    ),
  });

  if (existing) {
    throw conflict("Model already exists for this provider.");
  }
}

async function getProviderRow(providerId: string) {
  const db = getDb();
  return db.query.providers.findFirst({
    where: eq(providers.id, providerId),
  });
}

async function getModelRow(modelId: string) {
  const db = getDb();
  return db.query.models.findFirst({
    where: eq(models.id, modelId),
  });
}

type ModelRegistryTransaction = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

async function lockModelRegistry(tx: ModelRegistryTransaction) {
  await tx.execute(sql`select pg_advisory_xact_lock(1280266061)`);
}

async function assertHasRemainingChatModelInTransaction(
  tx: ModelRegistryTransaction,
) {
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
}

function isSecretConfigured(secretRef: string | null) {
  return Boolean(secretRef && process.env[secretRef]);
}

function resolveCooldownMs(
  failureCode: ProviderFailureCode,
  retryAfterSeconds?: number | null,
) {
  if (retryAfterSeconds != null && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  switch (failureCode) {
    case "provider_rate_limited":
    case "rate_limited_transient":
      return 30_000;
    case "quota_exhausted":
      return 5 * 60_000;
    case "provider_timeout":
      return 30_000;
    case "provider_5xx":
    case "provider_unavailable":
    case "provider_unreachable":
      return 60_000;
    case "invalid_api_key":
    case "model_not_found":
    case "auth_invalid":
    case "policy_blocked":
      return 10 * 60_000;
    case "context_too_large":
    case "provider_4xx":
    case "unknown_provider_error":
    default:
      return 15_000;
  }
}

function resetDailyTokens(item: ModelRegistryModelSeed, nowIso: string) {
  const today = nowIso.slice(0, 10);
  if (!item.tokensUsedDayBucket || item.tokensUsedDayBucket.slice(0, 10) !== today) {
    item.tokensUsedToday = 0;
    item.tokensUsedDayBucket = `${today}T00:00:00.000Z`;
  }
}

function resetTokenCounterIfNewDay(tokensUsedToday: number, bucket: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  if (!bucket || bucket.slice(0, 10) !== today) {
    return 0;
  }
  return tokensUsedToday;
}
