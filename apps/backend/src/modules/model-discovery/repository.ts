import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  type SQL,
} from "drizzle-orm";
import { getDb } from "../../db/connection.js";
import { discoveryJobs, providerSyncStatus, providers } from "../../db/schema.js";
import type {
  DiscoveryJobListFilters,
  DiscoveryJobRecord,
  DiscoveryJobStatus,
  DiscoveryJobUpdate,
  DiscoveryProviderReference,
  PaginatedDiscoveryJobsResult,
  PaginatedProviderSyncStatusResult,
  ProviderSyncStatusListFilters,
  ProviderSyncStatusRecord,
  ProviderSyncStatusUpdate,
  RunDiscoveryInput,
} from "./domain.js";
import type {
  DiscoveryJobRepository,
  DiscoveryProviderReader,
  ProviderSyncStatusRepository,
} from "./interfaces.js";

type ProviderRow = typeof providers.$inferSelect;
type DiscoveryJobRow = typeof discoveryJobs.$inferSelect;
type ProviderSyncStatusRow = typeof providerSyncStatus.$inferSelect;

export function createDatabaseDiscoveryProviderReader(): DiscoveryProviderReader {
  return {
    async findById(providerId) {
      const [row] = await getDb()
        .select()
        .from(providers)
        .where(eq(providers.id, providerId))
        .limit(1);
      return row ? mapProviderRow(row) : null;
    },

    async listDiscoverableProviders() {
      const rows = await getDb().select().from(providers);
      return rows
        .map(mapProviderRow)
        .filter((provider) => provider.status === "active" && supportsDiscovery(provider));
    },
  };
}

export function createDatabaseDiscoveryJobRepository(): DiscoveryJobRepository {
  return {
    async list(filters) {
      const conditions = buildJobConditions(filters);
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const offset = (filters.page - 1) * filters.pageSize;
      const db = getDb();
      const [{ total }] = await db
        .select({ total: count() })
        .from(discoveryJobs)
        .where(whereClause);
      const rows = await db
        .select()
        .from(discoveryJobs)
        .where(whereClause)
        .orderBy(getJobOrderBy(filters))
        .limit(filters.pageSize)
        .offset(offset);
      return {
        items: rows.map(mapJobRow),
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        hasNextPage: offset + rows.length < total,
      };
    },

    async findById(jobId) {
      const [row] = await getDb()
        .select()
        .from(discoveryJobs)
        .where(eq(discoveryJobs.id, jobId))
        .limit(1);
      return row ? mapJobRow(row) : null;
    },

    async create(input) {
      const now = new Date();
      const [row] = await getDb()
        .insert(discoveryJobs)
        .values({
          id: `djob_${randomUUID()}`,
          providerId: input.providerId,
          status: "running",
          triggerType: input.triggerType,
          startedAt: now,
          createdByUserId: input.actorUserId,
          metadataJson: {},
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return mapJobRow(row);
    },

    async update(jobId, patch) {
      const [row] = await getDb()
        .update(discoveryJobs)
        .set({
          status: patch.status,
          completedAt: patch.completedAt,
          discoveredCount: patch.discoveredCount,
          upsertedCount: patch.upsertedCount,
          skippedCount: patch.skippedCount,
          failureCode: patch.failureCode,
          failureMessage: patch.failureMessage,
          metadataJson: patch.metadata,
          updatedAt: new Date(),
        })
        .where(eq(discoveryJobs.id, jobId))
        .returning();
      return row ? mapJobRow(row) : null;
    },
  };
}

export function createDatabaseProviderSyncStatusRepository():
  ProviderSyncStatusRepository {
  return {
    async list(filters) {
      const conditions = buildSyncConditions(filters);
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const offset = (filters.page - 1) * filters.pageSize;
      const db = getDb();
      const [{ total }] = await db
        .select({ total: count() })
        .from(providerSyncStatus)
        .where(whereClause);
      const rows = await db
        .select()
        .from(providerSyncStatus)
        .where(whereClause)
        .orderBy(getSyncOrderBy(filters))
        .limit(filters.pageSize)
        .offset(offset);
      return {
        items: rows.map(mapSyncRow),
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        hasNextPage: offset + rows.length < total,
      };
    },

    async findByProviderId(providerId) {
      const [row] = await getDb()
        .select()
        .from(providerSyncStatus)
        .where(eq(providerSyncStatus.providerId, providerId))
        .limit(1);
      return row ? mapSyncRow(row) : null;
    },

    async upsert(update) {
      const now = new Date();
      const values = toSyncValues(update, now);
      const [row] = await getDb()
        .insert(providerSyncStatus)
        .values({
          id: `psync_${randomUUID()}`,
          providerId: update.providerId,
          ...values,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: providerSyncStatus.providerId,
          set: {
            ...values,
            updatedAt: now,
          },
        })
        .returning();
      return mapSyncRow(row);
    },
  };
}

export function createInMemoryDiscoveryProviderReader(
  seed: DiscoveryProviderReference[] = [],
): DiscoveryProviderReader {
  const rowsById = new Map(seed.map((row) => [row.id, row]));
  return {
    async findById(providerId) {
      return rowsById.get(providerId) ?? null;
    },
    async listDiscoverableProviders() {
      return Array.from(rowsById.values()).filter(
        (provider) => provider.status === "active" && supportsDiscovery(provider),
      );
    },
  };
}

export function createInMemoryDiscoveryJobRepository(
  seed: DiscoveryJobRecord[] = [],
): DiscoveryJobRepository {
  const rowsById = new Map(seed.map((row) => [row.id, row]));
  return {
    async list(filters) {
      return paginateJobs(Array.from(rowsById.values()), filters);
    },
    async findById(jobId) {
      return rowsById.get(jobId) ?? null;
    },
    async create(input) {
      const now = new Date();
      const job: DiscoveryJobRecord = {
        id: `djob_${randomUUID()}`,
        providerId: input.providerId,
        status: "running",
        triggerType: input.triggerType,
        startedAt: now,
        completedAt: null,
        discoveredCount: 0,
        upsertedCount: 0,
        skippedCount: 0,
        failureCode: null,
        failureMessage: null,
        createdByUserId: input.actorUserId,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      };
      rowsById.set(job.id, job);
      return job;
    },
    async update(jobId, patch) {
      const existing = rowsById.get(jobId);
      if (!existing) return null;
      const updated: DiscoveryJobRecord = {
        ...existing,
        status: patch.status,
        completedAt: patch.completedAt ?? existing.completedAt,
        discoveredCount: patch.discoveredCount ?? existing.discoveredCount,
        upsertedCount: patch.upsertedCount ?? existing.upsertedCount,
        skippedCount: patch.skippedCount ?? existing.skippedCount,
        failureCode: patch.failureCode ?? existing.failureCode,
        failureMessage: patch.failureMessage ?? existing.failureMessage,
        metadata: patch.metadata ?? existing.metadata,
        updatedAt: new Date(),
      };
      rowsById.set(jobId, updated);
      return updated;
    },
  };
}

export function createInMemoryProviderSyncStatusRepository(
  seed: ProviderSyncStatusRecord[] = [],
): ProviderSyncStatusRepository {
  const rowsByProviderId = new Map(seed.map((row) => [row.providerId, row]));
  return {
    async list(filters) {
      return paginateSyncRows(Array.from(rowsByProviderId.values()), filters);
    },
    async findByProviderId(providerId) {
      return rowsByProviderId.get(providerId) ?? null;
    },
    async upsert(update) {
      const existing = rowsByProviderId.get(update.providerId);
      const now = new Date();
      const next: ProviderSyncStatusRecord = {
        id: existing?.id ?? `psync_${randomUUID()}`,
        providerId: update.providerId,
        lastJobId: update.lastJobId,
        status: update.status,
        lastStartedAt: update.startedAt ?? existing?.lastStartedAt ?? null,
        lastSuccessAt: update.succeededAt ?? existing?.lastSuccessAt ?? null,
        lastFailureAt: update.failedAt ?? existing?.lastFailureAt ?? null,
        lastFailureCode:
          update.failureCode === undefined
            ? existing?.lastFailureCode ?? null
            : update.failureCode,
        lastFailureMessage:
          update.failureMessage === undefined
            ? existing?.lastFailureMessage ?? null
            : update.failureMessage,
        lastDiscoveredCount:
          update.discoveredCount ?? existing?.lastDiscoveredCount ?? 0,
        lastUpsertedCount: update.upsertedCount ?? existing?.lastUpsertedCount ?? 0,
        updatedAt: now,
      };
      rowsByProviderId.set(next.providerId, next);
      return next;
    },
  };
}

function buildJobConditions(filters: DiscoveryJobListFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.providerId) conditions.push(eq(discoveryJobs.providerId, filters.providerId));
  if (filters.status) conditions.push(eq(discoveryJobs.status, filters.status));
  return conditions;
}

function buildSyncConditions(filters: ProviderSyncStatusListFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.providerId) {
    conditions.push(eq(providerSyncStatus.providerId, filters.providerId));
  }
  if (filters.status) conditions.push(eq(providerSyncStatus.status, filters.status));
  return conditions;
}

function getJobOrderBy(filters: DiscoveryJobListFilters) {
  const column = (() => {
    if (filters.sort === "completedAt") return discoveryJobs.completedAt;
    if (filters.sort === "updatedAt") return discoveryJobs.updatedAt;
    return discoveryJobs.startedAt;
  })();
  return filters.direction === "asc" ? asc(column) : desc(column);
}

function getSyncOrderBy(filters: ProviderSyncStatusListFilters) {
  const column = (() => {
    if (filters.sort === "lastStartedAt") return providerSyncStatus.lastStartedAt;
    if (filters.sort === "lastSuccessAt") return providerSyncStatus.lastSuccessAt;
    return providerSyncStatus.updatedAt;
  })();
  return filters.direction === "asc" ? asc(column) : desc(column);
}

function paginateJobs(
  rows: DiscoveryJobRecord[],
  filters: DiscoveryJobListFilters,
): PaginatedDiscoveryJobsResult {
  const filtered = rows.filter((row) => {
    if (filters.providerId && row.providerId !== filters.providerId) return false;
    if (filters.status && row.status !== filters.status) return false;
    return true;
  });
  const sorted = [...filtered].sort((left, right) => {
    const modifier = filters.direction === "asc" ? 1 : -1;
    const leftTime = getJobSortDate(left, filters.sort)?.getTime() ?? 0;
    const rightTime = getJobSortDate(right, filters.sort)?.getTime() ?? 0;
    return (leftTime - rightTime) * modifier;
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

function paginateSyncRows(
  rows: ProviderSyncStatusRecord[],
  filters: ProviderSyncStatusListFilters,
): PaginatedProviderSyncStatusResult {
  const filtered = rows.filter((row) => {
    if (filters.providerId && row.providerId !== filters.providerId) return false;
    if (filters.status && row.status !== filters.status) return false;
    return true;
  });
  const sorted = [...filtered].sort((left, right) => {
    const modifier = filters.direction === "asc" ? 1 : -1;
    const leftTime = getSyncSortDate(left, filters.sort)?.getTime() ?? 0;
    const rightTime = getSyncSortDate(right, filters.sort)?.getTime() ?? 0;
    return (leftTime - rightTime) * modifier;
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

function mapProviderRow(row: ProviderRow): DiscoveryProviderReference {
  return {
    id: row.id,
    name: row.name,
    driverKey: row.driverKey,
    status:
      row.status === "active" || row.status === "deprecated" ? row.status : "disabled",
    metadataJson: row.metadataJson,
  };
}

function mapJobRow(row: DiscoveryJobRow): DiscoveryJobRecord {
  return {
    id: row.id,
    providerId: row.providerId,
    status: normalizeJobStatus(row.status),
    triggerType:
      row.triggerType === "scheduled" || row.triggerType === "internal"
        ? row.triggerType
        : "manual",
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    discoveredCount: row.discoveredCount,
    upsertedCount: row.upsertedCount,
    skippedCount: row.skippedCount,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    createdByUserId: row.createdByUserId,
    metadata: row.metadataJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapSyncRow(row: ProviderSyncStatusRow): ProviderSyncStatusRecord {
  return {
    id: row.id,
    providerId: row.providerId,
    lastJobId: row.lastJobId,
    status:
      row.status === "syncing" || row.status === "succeeded" || row.status === "failed"
        ? row.status
        : "never_synced",
    lastStartedAt: row.lastStartedAt,
    lastSuccessAt: row.lastSuccessAt,
    lastFailureAt: row.lastFailureAt,
    lastFailureCode: row.lastFailureCode,
    lastFailureMessage: row.lastFailureMessage,
    lastDiscoveredCount: row.lastDiscoveredCount,
    lastUpsertedCount: row.lastUpsertedCount,
    updatedAt: row.updatedAt,
  };
}

function toSyncValues(update: ProviderSyncStatusUpdate, now: Date) {
  return {
    lastJobId: update.lastJobId,
    status: update.status,
    lastStartedAt: update.startedAt,
    lastSuccessAt: update.succeededAt,
    lastFailureAt: update.failedAt,
    lastFailureCode: update.failureCode,
    lastFailureMessage: update.failureMessage,
    lastDiscoveredCount: update.discoveredCount,
    lastUpsertedCount: update.upsertedCount,
    updatedAt: now,
  };
}

function supportsDiscovery(provider: DiscoveryProviderReference) {
  const metadata = provider.metadataJson;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return (metadata as { supportsDiscovery?: unknown }).supportsDiscovery === true;
}

function normalizeJobStatus(status: string): DiscoveryJobStatus {
  if (status === "running" || status === "succeeded" || status === "failed") {
    return status;
  }
  return "failed";
}

function getJobSortDate(
  row: DiscoveryJobRecord,
  sort: DiscoveryJobListFilters["sort"],
) {
  if (sort === "completedAt") return row.completedAt;
  if (sort === "updatedAt") return row.updatedAt;
  return row.startedAt;
}

function getSyncSortDate(
  row: ProviderSyncStatusRecord,
  sort: ProviderSyncStatusListFilters["sort"],
) {
  if (sort === "lastStartedAt") return row.lastStartedAt;
  if (sort === "lastSuccessAt") return row.lastSuccessAt;
  return row.updatedAt;
}
