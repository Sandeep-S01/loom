import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  type SQL,
} from "drizzle-orm";
import { getDb } from "../../db/connection.js";
import { modelRegistry, modelRuntimeState } from "../../db/schema.js";
import type {
  ModelRuntimeHealthListFilters,
  ModelRuntimeHealthRecord,
  ModelRuntimeHealthRegistryReference,
  ModelRuntimeHealthStatus,
  PaginatedModelRuntimeHealthResult,
  ResetModelRuntimeHealthInput,
  UpsertModelRuntimeHealthInput,
} from "./domain.js";
import type {
  ModelRuntimeHealthRegistryReader,
  ModelRuntimeHealthRepository,
} from "./interfaces.js";

type RuntimeStateRow = typeof modelRuntimeState.$inferSelect;
type RegistryRow = typeof modelRegistry.$inferSelect;

export function createDatabaseModelRuntimeHealthRepository():
  ModelRuntimeHealthRepository {
  return {
    async list(filters) {
      const conditions = buildConditions(filters);
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const db = getDb();
      const offset = (filters.page - 1) * filters.pageSize;

      const [{ total }] = await db
        .select({ total: count() })
        .from(modelRuntimeState)
        .where(whereClause);

      const rows = await db
        .select()
        .from(modelRuntimeState)
        .where(whereClause)
        .orderBy(getOrderBy(filters))
        .limit(filters.pageSize)
        .offset(offset);

      return {
        items: rows.map(mapRuntimeStateRow),
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        hasNextPage: offset + rows.length < total,
      };
    },

    async findByRegistryModelId(registryModelId) {
      const [row] = await getDb()
        .select()
        .from(modelRuntimeState)
        .where(eq(modelRuntimeState.registryModelId, registryModelId))
        .limit(1);
      return row ? mapRuntimeStateRow(row) : null;
    },

    async findByRegistryModelIds(registryModelIds) {
      if (registryModelIds.length === 0) return [];
      const rows = await getDb()
        .select()
        .from(modelRuntimeState)
        .where(inArray(modelRuntimeState.registryModelId, registryModelIds));
      return rows.map(mapRuntimeStateRow);
    },

    async upsert(input) {
      const now = new Date();
      const [row] = await getDb()
        .insert(modelRuntimeState)
        .values({
          id: `mrts_${randomUUID()}`,
          registryModelId: input.registryModelId,
          ...toUpdateValues(input, now),
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: modelRuntimeState.registryModelId,
          set: toUpdateValues(input, now),
        })
        .returning();
      return mapRuntimeStateRow(row);
    },

    async reset(input) {
      const now = new Date();
      const [row] = await getDb()
        .insert(modelRuntimeState)
        .values({
          id: `mrts_${randomUUID()}`,
          registryModelId: input.registryModelId,
          status: "healthy",
          cooldownUntil: null,
          consecutiveFailures: 0,
          lastFailureCode: null,
          lastFailureAt: null,
          lastSuccessAt: now,
          lastCheckedAt: now,
          reason: null,
          updatedByUserId: input.actorUserId,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: modelRuntimeState.registryModelId,
          set: {
            status: "healthy",
            cooldownUntil: null,
            consecutiveFailures: 0,
            lastFailureCode: null,
            lastFailureAt: null,
            lastSuccessAt: now,
            lastCheckedAt: now,
            reason: null,
            updatedByUserId: input.actorUserId,
            updatedAt: now,
          },
        })
        .returning();
      return mapRuntimeStateRow(row);
    },
  };
}

export function createDatabaseModelRuntimeHealthRegistryReader():
  ModelRuntimeHealthRegistryReader {
  return {
    async findById(registryModelId) {
      const [row] = await getDb()
        .select()
        .from(modelRegistry)
        .where(eq(modelRegistry.id, registryModelId))
        .limit(1);
      return row ? mapRegistryRow(row) : null;
    },
  };
}

export function createInMemoryModelRuntimeHealthRepository(
  seed: ModelRuntimeHealthRecord[] = [],
): ModelRuntimeHealthRepository {
  const rowsByRegistryModelId = new Map(
    seed.map((row): [string, ModelRuntimeHealthRecord] => [
      row.registryModelId,
      row,
    ]),
  );

  return {
    async list(filters) {
      return paginateRows(Array.from(rowsByRegistryModelId.values()), filters);
    },

    async findByRegistryModelId(registryModelId) {
      return rowsByRegistryModelId.get(registryModelId) ?? null;
    },

    async findByRegistryModelIds(registryModelIds) {
      return registryModelIds.flatMap((registryModelId) => {
        const row = rowsByRegistryModelId.get(registryModelId);
        return row ? [row] : [];
      });
    },

    async upsert(input) {
      const existing = rowsByRegistryModelId.get(input.registryModelId);
      const now = new Date();
      const next: ModelRuntimeHealthRecord = {
        id: existing?.id ?? `mrts_${randomUUID()}`,
        registryModelId: input.registryModelId,
        status: input.patch.status ?? existing?.status ?? "unknown",
        cooldownUntil: valueOrExisting(input.patch, "cooldownUntil", existing, null),
        consecutiveFailures:
          input.patch.consecutiveFailures ?? existing?.consecutiveFailures ?? 0,
        lastFailureCode:
          valueOrExisting(input.patch, "lastFailureCode", existing, null),
        lastFailureAt: valueOrExisting(input.patch, "lastFailureAt", existing, null),
        lastSuccessAt: valueOrExisting(input.patch, "lastSuccessAt", existing, null),
        lastCheckedAt: valueOrExisting(input.patch, "lastCheckedAt", existing, now),
        reason: valueOrExisting(input.patch, "reason", existing, null),
        updatedByUserId: input.actorUserId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      rowsByRegistryModelId.set(next.registryModelId, next);
      return next;
    },

    async reset(input) {
      const existing = rowsByRegistryModelId.get(input.registryModelId);
      const now = new Date();
      const next: ModelRuntimeHealthRecord = {
        id: existing?.id ?? `mrts_${randomUUID()}`,
        registryModelId: input.registryModelId,
        status: "healthy",
        cooldownUntil: null,
        consecutiveFailures: 0,
        lastFailureCode: null,
        lastFailureAt: null,
        lastSuccessAt: now,
        lastCheckedAt: now,
        reason: null,
        updatedByUserId: input.actorUserId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      rowsByRegistryModelId.set(next.registryModelId, next);
      return next;
    },
  };
}

export function createInMemoryModelRuntimeHealthRegistryReader(
  seed: ModelRuntimeHealthRegistryReference[] = [],
): ModelRuntimeHealthRegistryReader {
  const rowsById = new Map(seed.map((row) => [row.id, row]));
  return {
    async findById(registryModelId) {
      return rowsById.get(registryModelId) ?? null;
    },
  };
}

function buildConditions(filters: ModelRuntimeHealthListFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.registryModelId) {
    conditions.push(eq(modelRuntimeState.registryModelId, filters.registryModelId));
  }
  if (filters.status) {
    conditions.push(eq(modelRuntimeState.status, filters.status));
  }
  return conditions;
}

function getOrderBy(filters: ModelRuntimeHealthListFilters) {
  const column = (() => {
    if (filters.sort === "lastCheckedAt") return modelRuntimeState.lastCheckedAt;
    if (filters.sort === "consecutiveFailures") {
      return modelRuntimeState.consecutiveFailures;
    }
    return modelRuntimeState.updatedAt;
  })();
  return filters.direction === "asc" ? asc(column) : desc(column);
}

function toUpdateValues(input: UpsertModelRuntimeHealthInput, now: Date) {
  const values: Partial<typeof modelRuntimeState.$inferInsert> = {
    updatedByUserId: input.actorUserId,
    updatedAt: now,
  };
  if ("status" in input.patch) values.status = input.patch.status;
  if ("cooldownUntil" in input.patch) values.cooldownUntil = input.patch.cooldownUntil;
  if ("consecutiveFailures" in input.patch) {
    values.consecutiveFailures = input.patch.consecutiveFailures;
  }
  if ("lastFailureCode" in input.patch) {
    values.lastFailureCode = input.patch.lastFailureCode;
  }
  if ("lastFailureAt" in input.patch) values.lastFailureAt = input.patch.lastFailureAt;
  if ("lastSuccessAt" in input.patch) values.lastSuccessAt = input.patch.lastSuccessAt;
  if ("lastCheckedAt" in input.patch) values.lastCheckedAt = input.patch.lastCheckedAt;
  if ("reason" in input.patch) values.reason = input.patch.reason;
  if (!("lastCheckedAt" in input.patch)) values.lastCheckedAt = now;
  return values;
}

function paginateRows(
  rows: ModelRuntimeHealthRecord[],
  filters: ModelRuntimeHealthListFilters,
): PaginatedModelRuntimeHealthResult {
  const filtered = rows.filter((row) => {
    if (filters.registryModelId && row.registryModelId !== filters.registryModelId) {
      return false;
    }
    if (filters.status && row.status !== filters.status) return false;
    return true;
  });

  const sorted = [...filtered].sort((left, right) => {
    const modifier = filters.direction === "asc" ? 1 : -1;
    if (filters.sort === "lastCheckedAt") {
      return compareNullableDates(left.lastCheckedAt, right.lastCheckedAt) * modifier;
    }
    if (filters.sort === "consecutiveFailures") {
      return (left.consecutiveFailures - right.consecutiveFailures) * modifier;
    }
    return (left.updatedAt.getTime() - right.updatedAt.getTime()) * modifier;
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

function compareNullableDates(left: Date | null, right: Date | null) {
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  return left.getTime() - right.getTime();
}

function valueOrExisting<
  Key extends
    | "cooldownUntil"
    | "lastFailureCode"
    | "lastFailureAt"
    | "lastSuccessAt"
    | "lastCheckedAt"
    | "reason",
>(
  patch: UpsertModelRuntimeHealthInput["patch"],
  key: Key,
  existing: ModelRuntimeHealthRecord | undefined,
  fallback: ModelRuntimeHealthRecord[Key],
) {
  return key in patch ? patch[key] ?? null : existing?.[key] ?? fallback;
}

function mapRuntimeStateRow(row: RuntimeStateRow): ModelRuntimeHealthRecord {
  return {
    id: row.id,
    registryModelId: row.registryModelId,
    status: normalizeStatus(row.status),
    cooldownUntil: row.cooldownUntil,
    consecutiveFailures: row.consecutiveFailures,
    lastFailureCode: row.lastFailureCode,
    lastFailureAt: row.lastFailureAt,
    lastSuccessAt: row.lastSuccessAt,
    lastCheckedAt: row.lastCheckedAt,
    reason: row.reason,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapRegistryRow(row: RegistryRow): ModelRuntimeHealthRegistryReference {
  return {
    id: row.id,
    status: row.status === "registered" ? "registered" : "archived",
    archivedAt: row.archivedAt,
  };
}

function normalizeStatus(status: string): ModelRuntimeHealthStatus {
  if (
    status === "healthy" ||
    status === "degraded" ||
    status === "rate_limited" ||
    status === "open_circuit" ||
    status === "auth_invalid" ||
    status === "unknown"
  ) {
    return status;
  }
  return "unknown";
}
