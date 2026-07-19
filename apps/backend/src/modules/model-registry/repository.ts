import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNull,
  or,
  type SQL,
} from "drizzle-orm";
import { getDb } from "../../db/connection.js";
import { modelCatalog, modelRegistry } from "../../db/schema.js";
import type {
  ModelCapabilities,
  ModelCatalogCostTier,
  ModelCatalogRecord,
  ModelCatalogReleaseStage,
  ModelPricingMetadata,
} from "../model-catalog/domain.js";
import type {
  ArchiveRegistryModelInput,
  ModelRegistryEntry,
  ModelRegistryListFilters,
  ModelRegistryRecord,
  ModelRegistryStatus,
  PaginatedModelRegistryResult,
  RegisterCatalogModelInput,
} from "./domain.js";
import type {
  ModelRegistryCatalogReader,
  ModelRegistryRepository,
} from "./interfaces.js";

type RegistryRow = typeof modelRegistry.$inferSelect;
type CatalogRow = typeof modelCatalog.$inferSelect;

export function createDatabaseModelRegistryRepository(): ModelRegistryRepository {
  return {
    async list(filters) {
      const conditions = buildConditions(filters);
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const db = getDb();
      const offset = (filters.page - 1) * filters.pageSize;

      const [{ total }] = await db
        .select({ total: count() })
        .from(modelRegistry)
        .innerJoin(modelCatalog, eq(modelRegistry.catalogModelId, modelCatalog.id))
        .where(whereClause);

      const rows = await db
        .select({ registry: modelRegistry, catalog: modelCatalog })
        .from(modelRegistry)
        .innerJoin(modelCatalog, eq(modelRegistry.catalogModelId, modelCatalog.id))
        .where(whereClause)
        .orderBy(getOrderBy(filters))
        .limit(filters.pageSize)
        .offset(offset);

      return {
        items: rows.map((row) => ({
          registry: mapRegistryRow(row.registry),
          catalog: mapCatalogRow(row.catalog),
        })),
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        hasNextPage: offset + rows.length < total,
      };
    },

    async findById(registryModelId) {
      const [row] = await getDb()
        .select({ registry: modelRegistry, catalog: modelCatalog })
        .from(modelRegistry)
        .innerJoin(modelCatalog, eq(modelRegistry.catalogModelId, modelCatalog.id))
        .where(eq(modelRegistry.id, registryModelId))
        .limit(1);
      return row
        ? {
            registry: mapRegistryRow(row.registry),
            catalog: mapCatalogRow(row.catalog),
          }
        : null;
    },

    async findActiveByCatalogModelId(catalogModelId) {
      const [row] = await getDb()
        .select()
        .from(modelRegistry)
        .where(
          and(
            eq(modelRegistry.catalogModelId, catalogModelId),
            eq(modelRegistry.status, "registered"),
            isNull(modelRegistry.archivedAt),
          ),
        )
        .limit(1);
      return row ? mapRegistryRow(row) : null;
    },

    async registerCatalogModel(input) {
      const now = new Date();
      try {
        const [row] = await getDb()
          .insert(modelRegistry)
          .values({
            id: `mreg_${randomUUID()}`,
            catalogModelId: input.catalogModelId,
            status: "registered",
            approvedByUserId: input.actorUserId,
            approvedAt: now,
            notes: input.notes ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        return mapRegistryRow(row);
      } catch (error) {
        if (isUniqueViolation(error)) return null;
        throw error;
      }
    },

    async archive(input) {
      const now = new Date();
      const [row] = await getDb()
        .update(modelRegistry)
        .set({
          status: "archived",
          archivedByUserId: input.actorUserId,
          archivedAt: now,
          archiveReason: input.archiveReason ?? null,
          updatedAt: now,
        })
        .where(
          and(
            eq(modelRegistry.id, input.registryModelId),
            eq(modelRegistry.status, "registered"),
            isNull(modelRegistry.archivedAt),
          ),
        )
        .returning();
      return row ? mapRegistryRow(row) : null;
    },
  };
}

export function createDatabaseModelRegistryCatalogReader(): ModelRegistryCatalogReader {
  return {
    async findById(catalogModelId) {
      const [row] = await getDb()
        .select()
        .from(modelCatalog)
        .where(eq(modelCatalog.id, catalogModelId))
        .limit(1);
      return row ? mapCatalogRow(row) : null;
    },
  };
}

export function createInMemoryModelRegistryRepository(
  seed: ModelRegistryEntry[] = [],
  catalogRecords: ModelCatalogRecord[] = [],
): ModelRegistryRepository {
  const registryById = new Map(seed.map((entry) => [entry.registry.id, entry.registry]));
  const catalogById = new Map([
    ...catalogRecords.map((catalog): [string, ModelCatalogRecord] => [catalog.id, catalog]),
    ...seed.map((entry): [string, ModelCatalogRecord] => [entry.catalog.id, entry.catalog]),
  ]);

  return {
    async list(filters) {
      return paginateEntries(
        Array.from(registryById.values()).flatMap((registry) => {
          const catalog = catalogById.get(registry.catalogModelId);
          return catalog ? [{ registry, catalog }] : [];
        }),
        filters,
      );
    },

    async findById(registryModelId) {
      const registry = registryById.get(registryModelId);
      if (!registry) return null;
      const catalog = catalogById.get(registry.catalogModelId);
      return catalog ? { registry, catalog } : null;
    },

    async findActiveByCatalogModelId(catalogModelId) {
      return (
        Array.from(registryById.values()).find(
          (registry) =>
            registry.catalogModelId === catalogModelId &&
            registry.status === "registered" &&
            !registry.archivedAt,
        ) ?? null
      );
    },

    async registerCatalogModel(input) {
      const existing = await this.findActiveByCatalogModelId(input.catalogModelId);
      if (existing) return null;

      const now = new Date();
      const registry: ModelRegistryRecord = {
        id: `mreg_${randomUUID()}`,
        catalogModelId: input.catalogModelId,
        status: "registered",
        approvedByUserId: input.actorUserId,
        approvedAt: now,
        archivedByUserId: null,
        archivedAt: null,
        archiveReason: null,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
      };
      registryById.set(registry.id, registry);
      return registry;
    },

    async archive(input) {
      const existing = registryById.get(input.registryModelId);
      if (!existing || existing.status !== "registered" || existing.archivedAt) {
        return null;
      }
      const now = new Date();
      const archived: ModelRegistryRecord = {
        ...existing,
        status: "archived",
        archivedByUserId: input.actorUserId,
        archivedAt: now,
        archiveReason: input.archiveReason ?? null,
        updatedAt: now,
      };
      registryById.set(archived.id, archived);
      return archived;
    },
  };
}

export function createInMemoryModelRegistryCatalogReader(
  catalogRecords: ModelCatalogRecord[] = [],
): ModelRegistryCatalogReader {
  const catalogById = new Map(catalogRecords.map((catalog) => [catalog.id, catalog]));
  return {
    async findById(catalogModelId) {
      return catalogById.get(catalogModelId) ?? null;
    },
  };
}

function buildConditions(filters: ModelRegistryListFilters): SQL[] {
  const conditions: SQL[] = [];
  if (!filters.includeArchived && !filters.status) {
    conditions.push(eq(modelRegistry.status, "registered"));
    conditions.push(isNull(modelRegistry.archivedAt));
  }
  if (filters.status) {
    conditions.push(eq(modelRegistry.status, filters.status));
  }
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
  return conditions;
}

function getOrderBy(filters: ModelRegistryListFilters) {
  const column = (() => {
    if (filters.sort === "displayName") return modelCatalog.displayName;
    if (filters.sort === "providerId") return modelCatalog.providerId;
    if (filters.sort === "updatedAt") return modelRegistry.updatedAt;
    return modelRegistry.approvedAt;
  })();
  return filters.direction === "asc" ? asc(column) : desc(column);
}

function paginateEntries(
  entries: ModelRegistryEntry[],
  filters: ModelRegistryListFilters,
): PaginatedModelRegistryResult {
  const search = filters.search?.toLowerCase();
  const filtered = entries.filter((entry) => {
    if (!filters.includeArchived && !filters.status) {
      if (entry.registry.status !== "registered" || entry.registry.archivedAt) return false;
    }
    if (filters.status && entry.registry.status !== filters.status) return false;
    if (filters.providerId && entry.catalog.providerId !== filters.providerId) return false;
    if (
      search &&
      !`${entry.catalog.displayName} ${entry.catalog.externalModelKey}`
        .toLowerCase()
        .includes(search)
    ) {
      return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((left, right) => {
    const modifier = filters.direction === "asc" ? 1 : -1;
    if (filters.sort === "displayName") {
      return left.catalog.displayName.localeCompare(right.catalog.displayName) * modifier;
    }
    if (filters.sort === "providerId") {
      return left.catalog.providerId.localeCompare(right.catalog.providerId) * modifier;
    }
    if (filters.sort === "updatedAt") {
      return (left.registry.updatedAt.getTime() - right.registry.updatedAt.getTime()) * modifier;
    }
    return (left.registry.approvedAt.getTime() - right.registry.approvedAt.getTime()) * modifier;
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

function mapRegistryRow(row: RegistryRow): ModelRegistryRecord {
  return {
    id: row.id,
    catalogModelId: row.catalogModelId,
    status: normalizeRegistryStatus(row.status),
    approvedByUserId: row.approvedByUserId,
    approvedAt: row.approvedAt,
    archivedByUserId: row.archivedByUserId,
    archivedAt: row.archivedAt,
    archiveReason: row.archiveReason,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapCatalogRow(row: CatalogRow): ModelCatalogRecord {
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

function normalizeRegistryStatus(status: string): ModelRegistryStatus {
  if (status === "registered" || status === "archived") return status;
  return "archived";
}

function normalizeCapabilities(row: CatalogRow): ModelCapabilities {
  return {
    chat: row.supportsChat,
    agent: row.supportsAgent,
    vision: row.supportsVision,
    toolUse: row.supportsToolUse,
    jsonMode: row.supportsJsonMode,
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

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
