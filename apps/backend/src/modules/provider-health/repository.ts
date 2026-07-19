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
import { providerHealthState, providers } from "../../db/schema.js";
import type {
  PaginatedProviderHealthResult,
  ProviderHealthListFilters,
  ProviderHealthProviderReference,
  ProviderHealthRecord,
  ProviderHealthStatus,
  ResetProviderHealthInput,
  UpsertProviderHealthInput,
} from "./domain.js";
import type {
  ProviderHealthProviderReader,
  ProviderHealthRepository,
} from "./interfaces.js";

type ProviderHealthRow = typeof providerHealthState.$inferSelect;
type ProviderRow = typeof providers.$inferSelect;

export function createDatabaseProviderHealthRepository(): ProviderHealthRepository {
  return {
    async list(filters) {
      const conditions = buildConditions(filters);
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const db = getDb();
      const offset = (filters.page - 1) * filters.pageSize;

      const [{ total }] = await db
        .select({ total: count() })
        .from(providerHealthState)
        .where(whereClause);

      const rows = await db
        .select()
        .from(providerHealthState)
        .where(whereClause)
        .orderBy(getOrderBy(filters))
        .limit(filters.pageSize)
        .offset(offset);

      return {
        items: rows.map(mapProviderHealthRow),
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        hasNextPage: offset + rows.length < total,
      };
    },

    async findByProviderId(providerId) {
      const [row] = await getDb()
        .select()
        .from(providerHealthState)
        .where(eq(providerHealthState.providerId, providerId))
        .limit(1);
      return row ? mapProviderHealthRow(row) : null;
    },

    async findByProviderIds(providerIds) {
      if (providerIds.length === 0) return [];
      const rows = await getDb()
        .select()
        .from(providerHealthState)
        .where(inArray(providerHealthState.providerId, providerIds));
      return rows.map(mapProviderHealthRow);
    },

    async upsert(input) {
      const now = new Date();
      const [row] = await getDb()
        .insert(providerHealthState)
        .values({
          id: `phs_${randomUUID()}`,
          providerId: input.providerId,
          ...toUpdateValues(input, now),
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: providerHealthState.providerId,
          set: toUpdateValues(input, now),
        })
        .returning();
      return mapProviderHealthRow(row);
    },

    async reset(input) {
      const now = new Date();
      const [row] = await getDb()
        .insert(providerHealthState)
        .values({
          id: `phs_${randomUUID()}`,
          providerId: input.providerId,
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
          target: providerHealthState.providerId,
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
      return mapProviderHealthRow(row);
    },
  };
}

export function createDatabaseProviderHealthProviderReader(): ProviderHealthProviderReader {
  return {
    async findById(providerId) {
      const [row] = await getDb()
        .select()
        .from(providers)
        .where(eq(providers.id, providerId))
        .limit(1);
      return row ? mapProviderRow(row) : null;
    },
  };
}

export function createInMemoryProviderHealthRepository(
  seed: ProviderHealthRecord[] = [],
): ProviderHealthRepository {
  const rowsByProviderId = new Map(
    seed.map((row): [string, ProviderHealthRecord] => [row.providerId, row]),
  );

  return {
    async list(filters) {
      return paginateRows(Array.from(rowsByProviderId.values()), filters);
    },

    async findByProviderId(providerId) {
      return rowsByProviderId.get(providerId) ?? null;
    },

    async findByProviderIds(providerIds) {
      return providerIds.flatMap((providerId) => {
        const row = rowsByProviderId.get(providerId);
        return row ? [row] : [];
      });
    },

    async upsert(input) {
      const existing = rowsByProviderId.get(input.providerId);
      const now = new Date();
      const next: ProviderHealthRecord = {
        id: existing?.id ?? `phs_${randomUUID()}`,
        providerId: input.providerId,
        status: input.patch.status ?? existing?.status ?? "unknown",
        cooldownUntil: valueOrExisting(input.patch, "cooldownUntil", existing, null),
        consecutiveFailures:
          input.patch.consecutiveFailures ?? existing?.consecutiveFailures ?? 0,
        lastFailureCode: valueOrExisting(input.patch, "lastFailureCode", existing, null),
        lastFailureAt: valueOrExisting(input.patch, "lastFailureAt", existing, null),
        lastSuccessAt: valueOrExisting(input.patch, "lastSuccessAt", existing, null),
        lastCheckedAt: valueOrExisting(input.patch, "lastCheckedAt", existing, now),
        reason: valueOrExisting(input.patch, "reason", existing, null),
        updatedByUserId: input.actorUserId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      rowsByProviderId.set(next.providerId, next);
      return next;
    },

    async reset(input) {
      const existing = rowsByProviderId.get(input.providerId);
      const now = new Date();
      const next: ProviderHealthRecord = {
        id: existing?.id ?? `phs_${randomUUID()}`,
        providerId: input.providerId,
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
      rowsByProviderId.set(next.providerId, next);
      return next;
    },
  };
}

export function createInMemoryProviderHealthProviderReader(
  seed: ProviderHealthProviderReference[] = [],
): ProviderHealthProviderReader {
  const rowsById = new Map(seed.map((row) => [row.id, row]));
  return {
    async findById(providerId) {
      return rowsById.get(providerId) ?? null;
    },
  };
}

function buildConditions(filters: ProviderHealthListFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.providerId) {
    conditions.push(eq(providerHealthState.providerId, filters.providerId));
  }
  if (filters.status) {
    conditions.push(eq(providerHealthState.status, filters.status));
  }
  return conditions;
}

function getOrderBy(filters: ProviderHealthListFilters) {
  const column = (() => {
    if (filters.sort === "lastCheckedAt") return providerHealthState.lastCheckedAt;
    if (filters.sort === "consecutiveFailures") {
      return providerHealthState.consecutiveFailures;
    }
    return providerHealthState.updatedAt;
  })();
  return filters.direction === "asc" ? asc(column) : desc(column);
}

function toUpdateValues(input: UpsertProviderHealthInput, now: Date) {
  const values: Partial<typeof providerHealthState.$inferInsert> = {
    updatedByUserId: input.actorUserId,
    updatedAt: now,
  };
  if ("status" in input.patch) values.status = input.patch.status;
  if ("cooldownUntil" in input.patch) values.cooldownUntil = input.patch.cooldownUntil;
  if ("consecutiveFailures" in input.patch) {
    values.consecutiveFailures = input.patch.consecutiveFailures;
  }
  if ("lastFailureCode" in input.patch) values.lastFailureCode = input.patch.lastFailureCode;
  if ("lastFailureAt" in input.patch) values.lastFailureAt = input.patch.lastFailureAt;
  if ("lastSuccessAt" in input.patch) values.lastSuccessAt = input.patch.lastSuccessAt;
  if ("lastCheckedAt" in input.patch) values.lastCheckedAt = input.patch.lastCheckedAt;
  if ("reason" in input.patch) values.reason = input.patch.reason;
  if (!("lastCheckedAt" in input.patch)) values.lastCheckedAt = now;
  return values;
}

function paginateRows(
  rows: ProviderHealthRecord[],
  filters: ProviderHealthListFilters,
): PaginatedProviderHealthResult {
  const filtered = rows.filter((row) => {
    if (filters.providerId && row.providerId !== filters.providerId) return false;
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
  patch: UpsertProviderHealthInput["patch"],
  key: Key,
  existing: ProviderHealthRecord | undefined,
  fallback: ProviderHealthRecord[Key],
) {
  return key in patch ? patch[key] ?? null : existing?.[key] ?? fallback;
}

function mapProviderHealthRow(row: ProviderHealthRow): ProviderHealthRecord {
  return {
    id: row.id,
    providerId: row.providerId,
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

function mapProviderRow(row: ProviderRow): ProviderHealthProviderReference {
  return { id: row.id };
}

function normalizeStatus(status: string): ProviderHealthStatus {
  if (
    status === "healthy" ||
    status === "degraded" ||
    status === "unavailable" ||
    status === "auth_invalid" ||
    status === "unknown"
  ) {
    return status;
  }
  return "unknown";
}
