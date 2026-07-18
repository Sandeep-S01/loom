import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  isNull,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import { getDb } from "../../db/connection.js";
import { modelCatalog, providers } from "../../db/schema.js";
import type {
  ModelCapabilities,
  ModelCatalogCostTier,
  ModelCatalogListFilters,
  ModelCatalogRecord,
  ModelCatalogReleaseStage,
  ModelPricingMetadata,
  PaginatedModelCatalogResult,
  UpsertDiscoveredModelInput,
} from "./domain.js";
import type {
  ModelCatalogProviderRepository,
  ModelCatalogRepository,
} from "./interfaces.js";

type ModelCatalogRow = typeof modelCatalog.$inferSelect;

export function createDatabaseModelCatalogRepository(): ModelCatalogRepository {
  return {
    async list(filters) {
      const conditions = buildConditions(filters);
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const db = getDb();
      const offset = (filters.page - 1) * filters.pageSize;

      const [{ total }] = await db
        .select({ total: count() })
        .from(modelCatalog)
        .where(whereClause);

      const rows = await db
        .select()
        .from(modelCatalog)
        .where(whereClause)
        .orderBy(getOrderBy(filters))
        .limit(filters.pageSize)
        .offset(offset);

      return {
        items: rows.map(mapRow),
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        hasNextPage: offset + rows.length < total,
      };
    },

    async findById(catalogModelId) {
      const [row] = await getDb()
        .select()
        .from(modelCatalog)
        .where(eq(modelCatalog.id, catalogModelId))
        .limit(1);
      return row ? mapRow(row) : null;
    },

    async findByProviderModel(input) {
      const [row] = await getDb()
        .select()
        .from(modelCatalog)
        .where(
          and(
            eq(modelCatalog.providerId, input.providerId),
            eq(modelCatalog.externalModelKey, input.externalModelKey),
          ),
        )
        .limit(1);
      return row ? mapRow(row) : null;
    },

    async upsertDiscoveredModel(input) {
      const now = new Date();
      const discoveredAt = input.discoveredAt ?? now;
      const values = toInsertValues(input, now, discoveredAt);
      const [row] = await getDb()
        .insert(modelCatalog)
        .values(values)
        .onConflictDoUpdate({
          target: [
            modelCatalog.providerId,
            modelCatalog.externalModelKey,
          ],
          set: {
            displayName: input.displayName,
            description: input.description ?? null,
            supportsChat: input.capabilities.chat,
            supportsAgent: input.capabilities.agent,
            supportsVision: input.capabilities.vision,
            supportsToolUse: input.capabilities.toolUse,
            supportsJsonMode: input.capabilities.jsonMode,
            capabilitiesJson: input.capabilities,
            contextWindow: input.contextWindow ?? null,
            maxOutputTokens: input.maxOutputTokens ?? null,
            costTier: input.costTier,
            pricingJson: toPricing(input),
            releaseStage: input.releaseStage ?? "stable",
            releasedAt: normalizeDate(input.releasedAt),
            deprecatedAt: normalizeDate(input.deprecatedAt),
            deprecationReason: input.deprecationReason ?? null,
            providerMetadataJson: input.providerMetadata ?? {},
            lastDiscoveredAt: discoveredAt,
            lastChangedAt: now,
            updatedAt: now,
          },
        })
        .returning();
      return mapRow(row);
    },
  };
}

export function createDatabaseModelCatalogProviderRepository():
  ModelCatalogProviderRepository {
  return {
    async exists(providerId) {
      const [row] = await getDb()
        .select({ id: providers.id })
        .from(providers)
        .where(eq(providers.id, providerId))
        .limit(1);
      return Boolean(row);
    },
  };
}

export function createInMemoryModelCatalogRepository(
  seed: ModelCatalogRecord[] = [],
): ModelCatalogRepository {
  const rowsById = new Map(seed.map((item) => [item.id, item]));

  return {
    async list(filters) {
      return paginateRows(Array.from(rowsById.values()), filters);
    },

    async findById(catalogModelId) {
      return rowsById.get(catalogModelId) ?? null;
    },

    async findByProviderModel(input) {
      return (
        Array.from(rowsById.values()).find(
          (item) =>
            item.providerId === input.providerId &&
            item.externalModelKey === input.externalModelKey,
        ) ?? null
      );
    },

    async upsertDiscoveredModel(input) {
      const existing = await this.findByProviderModel(input);
      const now = new Date();
      const discoveredAt = input.discoveredAt ?? now;
      const next: ModelCatalogRecord = {
        id: existing?.id ?? `mcat_${randomUUID()}`,
        providerId: input.providerId,
        externalModelKey: input.externalModelKey,
        displayName: input.displayName,
        description: input.description ?? null,
        capabilities: input.capabilities,
        contextWindow: input.contextWindow ?? null,
        maxOutputTokens: input.maxOutputTokens ?? null,
        costTier: input.costTier,
        pricing: toPricing(input),
        releaseStage: input.releaseStage ?? "stable",
        releasedAt: normalizeDate(input.releasedAt),
        deprecatedAt: normalizeDate(input.deprecatedAt),
        deprecationReason: input.deprecationReason ?? null,
        providerMetadata: input.providerMetadata ?? {},
        firstDiscoveredAt: existing?.firstDiscoveredAt ?? discoveredAt,
        lastDiscoveredAt: discoveredAt,
        lastChangedAt: existing ? now : null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      rowsById.set(next.id, next);
      return next;
    },
  };
}

export function createInMemoryModelCatalogProviderRepository(
  providerIds: string[] = [],
): ModelCatalogProviderRepository {
  const ids = new Set(providerIds);
  return {
    async exists(providerId) {
      return ids.has(providerId);
    },
  };
}

function buildConditions(filters: ModelCatalogListFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.providerId) {
    conditions.push(eq(modelCatalog.providerId, filters.providerId));
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(modelCatalog.displayName, pattern),
        ilike(modelCatalog.externalModelKey, pattern),
      ) as SQL,
    );
  }
  if (filters.capability) {
    conditions.push(eq(capabilityColumn(filters.capability), true));
  }
  if (filters.costTier) {
    conditions.push(eq(modelCatalog.costTier, filters.costTier));
  }
  if (filters.releaseStage) {
    conditions.push(eq(modelCatalog.releaseStage, filters.releaseStage));
  }
  if (filters.deprecated !== undefined) {
    conditions.push(
      filters.deprecated
        ? isNotNull(modelCatalog.deprecatedAt)
        : isNull(modelCatalog.deprecatedAt),
    );
  }
  if (filters.discoveredAfter) {
    conditions.push(gte(modelCatalog.lastDiscoveredAt, filters.discoveredAfter));
  }
  if (filters.discoveredBefore) {
    conditions.push(lte(modelCatalog.lastDiscoveredAt, filters.discoveredBefore));
  }
  return conditions;
}

function getOrderBy(filters: ModelCatalogListFilters) {
  const column = (() => {
    if (filters.sort === "displayName") return modelCatalog.displayName;
    if (filters.sort === "providerId") return modelCatalog.providerId;
    if (filters.sort === "contextWindow") return modelCatalog.contextWindow;
    if (filters.sort === "updatedAt") return modelCatalog.updatedAt;
    return modelCatalog.lastDiscoveredAt;
  })();
  return filters.direction === "asc" ? asc(column) : desc(column);
}

function paginateRows(
  rows: ModelCatalogRecord[],
  filters: ModelCatalogListFilters,
): PaginatedModelCatalogResult {
  const search = filters.search?.toLowerCase();
  const filtered = rows.filter((item) => {
    if (filters.providerId && item.providerId !== filters.providerId) return false;
    if (
      search &&
      !`${item.displayName} ${item.externalModelKey}`.toLowerCase().includes(search)
    ) {
      return false;
    }
    if (filters.capability && !item.capabilities[filters.capability]) return false;
    if (filters.costTier && item.costTier !== filters.costTier) return false;
    if (filters.releaseStage && item.releaseStage !== filters.releaseStage) return false;
    if (filters.deprecated !== undefined) {
      if (filters.deprecated !== Boolean(item.deprecatedAt)) return false;
    }
    if (
      filters.discoveredAfter &&
      item.lastDiscoveredAt.getTime() < filters.discoveredAfter.getTime()
    ) {
      return false;
    }
    if (
      filters.discoveredBefore &&
      item.lastDiscoveredAt.getTime() > filters.discoveredBefore.getTime()
    ) {
      return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((left, right) => {
    const modifier = filters.direction === "asc" ? 1 : -1;
    if (filters.sort === "displayName") {
      return left.displayName.localeCompare(right.displayName) * modifier;
    }
    if (filters.sort === "providerId") {
      return left.providerId.localeCompare(right.providerId) * modifier;
    }
    if (filters.sort === "contextWindow") {
      return ((left.contextWindow ?? 0) - (right.contextWindow ?? 0)) * modifier;
    }
    if (filters.sort === "updatedAt") {
      return (left.updatedAt.getTime() - right.updatedAt.getTime()) * modifier;
    }
    return (left.lastDiscoveredAt.getTime() - right.lastDiscoveredAt.getTime()) * modifier;
  });

  const offset = (filters.page - 1) * filters.pageSize;
  const items = sorted.slice(offset, offset + filters.pageSize);
  return {
    items,
    page: filters.page,
    pageSize: filters.pageSize,
    total: filtered.length,
    hasNextPage: offset + items.length < filtered.length,
  };
}

function toInsertValues(
  input: UpsertDiscoveredModelInput,
  now: Date,
  discoveredAt: Date,
) {
  return {
    id: `mcat_${randomUUID()}`,
    providerId: input.providerId,
    externalModelKey: input.externalModelKey,
    displayName: input.displayName,
    description: input.description ?? null,
    supportsChat: input.capabilities.chat,
    supportsAgent: input.capabilities.agent,
    supportsVision: input.capabilities.vision,
    supportsToolUse: input.capabilities.toolUse,
    supportsJsonMode: input.capabilities.jsonMode,
    capabilitiesJson: input.capabilities,
    contextWindow: input.contextWindow ?? null,
    maxOutputTokens: input.maxOutputTokens ?? null,
    costTier: input.costTier,
    pricingJson: toPricing(input),
    releaseStage: input.releaseStage ?? "stable",
    releasedAt: normalizeDate(input.releasedAt),
    deprecatedAt: normalizeDate(input.deprecatedAt),
    deprecationReason: input.deprecationReason ?? null,
    providerMetadataJson: input.providerMetadata ?? {},
    firstDiscoveredAt: discoveredAt,
    lastDiscoveredAt: discoveredAt,
    lastChangedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function mapRow(row: ModelCatalogRow): ModelCatalogRecord {
  return {
    id: row.id,
    providerId: row.providerId,
    externalModelKey: row.externalModelKey,
    displayName: row.displayName,
    description: row.description,
    capabilities: normalizeCapabilities(row),
    contextWindow: row.contextWindow,
    maxOutputTokens: row.maxOutputTokens,
    costTier: normalizeCostTier(row.costTier),
    pricing: normalizePricing(row.pricingJson),
    releaseStage: normalizeReleaseStage(row.releaseStage),
    releasedAt: row.releasedAt,
    deprecatedAt: row.deprecatedAt,
    deprecationReason: row.deprecationReason,
    providerMetadata: row.providerMetadataJson,
    firstDiscoveredAt: row.firstDiscoveredAt,
    lastDiscoveredAt: row.lastDiscoveredAt,
    lastChangedAt: row.lastChangedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeCapabilities(row: ModelCatalogRow): ModelCapabilities {
  return {
    chat: row.supportsChat,
    agent: row.supportsAgent,
    vision: row.supportsVision,
    toolUse: row.supportsToolUse,
    jsonMode: row.supportsJsonMode,
  };
}

function toPricing(input: UpsertDiscoveredModelInput): ModelPricingMetadata {
  return {
    inputPer1mUsdMicros: input.pricing?.inputPer1mUsdMicros ?? null,
    outputPer1mUsdMicros: input.pricing?.outputPer1mUsdMicros ?? null,
    currency: "USD",
    raw: input.pricing?.raw ?? null,
  };
}

function normalizePricing(value: unknown): ModelPricingMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      inputPer1mUsdMicros: null,
      outputPer1mUsdMicros: null,
      currency: "USD",
      raw: null,
    };
  }
  const pricing = value as Partial<ModelPricingMetadata>;
  return {
    inputPer1mUsdMicros: pricing.inputPer1mUsdMicros ?? null,
    outputPer1mUsdMicros: pricing.outputPer1mUsdMicros ?? null,
    currency: "USD",
    raw: pricing.raw ?? null,
  };
}

function normalizeCostTier(value: string): ModelCatalogCostTier {
  if (value === "free" || value === "paid" || value === "unknown") return value;
  return "unknown";
}

function normalizeReleaseStage(value: string): ModelCatalogReleaseStage {
  if (
    value === "stable" ||
    value === "preview" ||
    value === "experimental" ||
    value === "legacy"
  ) {
    return value;
  }
  return "stable";
}

function normalizeDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function capabilityColumn(capability: keyof ModelCapabilities) {
  if (capability === "chat") return modelCatalog.supportsChat;
  if (capability === "agent") return modelCatalog.supportsAgent;
  if (capability === "vision") return modelCatalog.supportsVision;
  if (capability === "toolUse") return modelCatalog.supportsToolUse;
  return modelCatalog.supportsJsonMode;
}
