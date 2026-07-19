import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  or,
  type SQL,
} from "drizzle-orm";
import { getDb } from "../../db/connection.js";
import { modelPolicy, modelRegistry } from "../../db/schema.js";
import type {
  ModelPolicyListFilters,
  ModelPolicyRecord,
  ModelPolicyRegistryReference,
  PaginatedModelPolicyResult,
  UpsertModelPolicyInput,
} from "./domain.js";
import type {
  ModelPolicyRegistryReader,
  ModelPolicyRepository,
} from "./interfaces.js";

type ModelPolicyRow = typeof modelPolicy.$inferSelect;
type ModelRegistryRow = typeof modelRegistry.$inferSelect;

export function createDatabaseModelPolicyRepository(): ModelPolicyRepository {
  return {
    async list(filters) {
      const conditions = buildConditions(filters);
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const db = getDb();
      const offset = (filters.page - 1) * filters.pageSize;

      const [{ total }] = await db
        .select({ total: count() })
        .from(modelPolicy)
        .where(whereClause);

      const rows = await db
        .select()
        .from(modelPolicy)
        .where(whereClause)
        .orderBy(getOrderBy(filters))
        .limit(filters.pageSize)
        .offset(offset);

      return {
        items: rows.map(mapPolicyRow),
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        hasNextPage: offset + rows.length < total,
      };
    },

    async findByRegistryModelId(registryModelId) {
      const [row] = await getDb()
        .select()
        .from(modelPolicy)
        .where(eq(modelPolicy.registryModelId, registryModelId))
        .limit(1);
      return row ? mapPolicyRow(row) : null;
    },

    async upsert(input) {
      const now = new Date();
      const [row] = await upsertPolicyWithSingleDefault(input, now);
      return mapPolicyRow(row);
    },

    async deleteByRegistryModelId(registryModelId) {
      const [row] = await getDb()
        .delete(modelPolicy)
        .where(eq(modelPolicy.registryModelId, registryModelId))
        .returning();
      return row ? mapPolicyRow(row) : null;
    },
  };
}

export function createDatabaseModelPolicyRegistryReader(): ModelPolicyRegistryReader {
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

export function createInMemoryModelPolicyRepository(
  seed: ModelPolicyRecord[] = [],
): ModelPolicyRepository {
  const rowsByRegistryModelId = new Map(
    seed.map((policy): [string, ModelPolicyRecord] => [
      policy.registryModelId,
      policy,
    ]),
  );

  return {
    async list(filters) {
      return paginateRows(Array.from(rowsByRegistryModelId.values()), filters);
    },

    async findByRegistryModelId(registryModelId) {
      return rowsByRegistryModelId.get(registryModelId) ?? null;
    },

    async upsert(input) {
      if (input.patch.defaultForChat === true) {
        clearDefault(rowsByRegistryModelId, "defaultForChat", input.registryModelId);
      }
      if (input.patch.defaultForAgent === true) {
        clearDefault(rowsByRegistryModelId, "defaultForAgent", input.registryModelId);
      }

      const existing = rowsByRegistryModelId.get(input.registryModelId);
      const now = new Date();
      const next: ModelPolicyRecord = {
        id: existing?.id ?? `mpol_${randomUUID()}`,
        registryModelId: input.registryModelId,
        enabled: input.patch.enabled ?? existing?.enabled ?? true,
        visibleInSelector:
          input.patch.visibleInSelector ?? existing?.visibleInSelector ?? true,
        priorityRank: input.patch.priorityRank ?? existing?.priorityRank ?? 100,
        defaultForChat: input.patch.defaultForChat ?? existing?.defaultForChat ?? false,
        defaultForAgent:
          input.patch.defaultForAgent ?? existing?.defaultForAgent ?? false,
        requiresCompanion:
          input.patch.requiresCompanion ?? existing?.requiresCompanion ?? false,
        requestsPerMinuteLimit:
          valueOrExisting(input.patch, "requestsPerMinuteLimit", existing, null),
        tokensPerDayLimit:
          valueOrExisting(input.patch, "tokensPerDayLimit", existing, null),
        tokensPerRequestLimit:
          valueOrExisting(input.patch, "tokensPerRequestLimit", existing, null),
        notes: valueOrExisting(input.patch, "notes", existing, null),
        createdByUserId: existing?.createdByUserId ?? input.actorUserId,
        updatedByUserId: input.actorUserId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      rowsByRegistryModelId.set(next.registryModelId, next);
      return next;
    },

    async deleteByRegistryModelId(registryModelId) {
      const existing = rowsByRegistryModelId.get(registryModelId);
      if (!existing) return null;
      rowsByRegistryModelId.delete(registryModelId);
      return existing;
    },
  };
}

async function upsertPolicyWithSingleDefault(
  input: UpsertModelPolicyInput,
  now: Date,
) {
  try {
    return await runPolicyUpsertTransaction(input, now);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return runPolicyUpsertTransaction(input, new Date());
  }
}

async function runPolicyUpsertTransaction(input: UpsertModelPolicyInput, now: Date) {
  return getDb().transaction(async (tx) => {
    if (input.patch.defaultForChat === true) {
      await tx
        .update(modelPolicy)
        .set({
          defaultForChat: false,
          updatedAt: now,
          updatedByUserId: input.actorUserId,
        })
        .where(eq(modelPolicy.defaultForChat, true));
    }
    if (input.patch.defaultForAgent === true) {
      await tx
        .update(modelPolicy)
        .set({
          defaultForAgent: false,
          updatedAt: now,
          updatedByUserId: input.actorUserId,
        })
        .where(eq(modelPolicy.defaultForAgent, true));
    }

    return tx
      .insert(modelPolicy)
      .values({
        id: `mpol_${randomUUID()}`,
        registryModelId: input.registryModelId,
        ...toUpdateValues(input, now),
        createdByUserId: input.actorUserId,
        updatedByUserId: input.actorUserId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: modelPolicy.registryModelId,
        set: toUpdateValues(input, now),
      })
      .returning();
  });
}

export function createInMemoryModelPolicyRegistryReader(
  seed: ModelPolicyRegistryReference[] = [],
): ModelPolicyRegistryReader {
  const rowsById = new Map(seed.map((row) => [row.id, row]));
  return {
    async findById(registryModelId) {
      return rowsById.get(registryModelId) ?? null;
    },
  };
}

function buildConditions(filters: ModelPolicyListFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.registryModelId) {
    conditions.push(eq(modelPolicy.registryModelId, filters.registryModelId));
  }
  if (filters.enabled !== undefined) {
    conditions.push(eq(modelPolicy.enabled, filters.enabled));
  }
  if (filters.visibleInSelector !== undefined) {
    conditions.push(eq(modelPolicy.visibleInSelector, filters.visibleInSelector));
  }
  if (filters.defaultsOnly) {
    conditions.push(
      or(
        eq(modelPolicy.defaultForChat, true),
        eq(modelPolicy.defaultForAgent, true),
      ) as SQL,
    );
  }
  return conditions;
}

function getOrderBy(filters: ModelPolicyListFilters) {
  const column = (() => {
    if (filters.sort === "updatedAt") return modelPolicy.updatedAt;
    if (filters.sort === "createdAt") return modelPolicy.createdAt;
    return modelPolicy.priorityRank;
  })();
  return filters.direction === "asc" ? asc(column) : desc(column);
}

function toUpdateValues(input: UpsertModelPolicyInput, now: Date) {
  const values: Partial<typeof modelPolicy.$inferInsert> = {
    updatedByUserId: input.actorUserId,
    updatedAt: now,
  };
  if ("enabled" in input.patch) values.enabled = input.patch.enabled;
  if ("visibleInSelector" in input.patch) {
    values.visibleInSelector = input.patch.visibleInSelector;
  }
  if ("priorityRank" in input.patch) values.priorityRank = input.patch.priorityRank;
  if ("defaultForChat" in input.patch) {
    values.defaultForChat = input.patch.defaultForChat;
  }
  if ("defaultForAgent" in input.patch) {
    values.defaultForAgent = input.patch.defaultForAgent;
  }
  if ("requiresCompanion" in input.patch) {
    values.requiresCompanion = input.patch.requiresCompanion;
  }
  if ("requestsPerMinuteLimit" in input.patch) {
    values.requestsPerMinuteLimit = input.patch.requestsPerMinuteLimit;
  }
  if ("tokensPerDayLimit" in input.patch) {
    values.tokensPerDayLimit = input.patch.tokensPerDayLimit;
  }
  if ("tokensPerRequestLimit" in input.patch) {
    values.tokensPerRequestLimit = input.patch.tokensPerRequestLimit;
  }
  if ("notes" in input.patch) values.notes = input.patch.notes;
  return values;
}

function paginateRows(
  rows: ModelPolicyRecord[],
  filters: ModelPolicyListFilters,
): PaginatedModelPolicyResult {
  const filtered = rows.filter((row) => {
    if (filters.registryModelId && row.registryModelId !== filters.registryModelId) {
      return false;
    }
    if (filters.enabled !== undefined && row.enabled !== filters.enabled) return false;
    if (
      filters.visibleInSelector !== undefined &&
      row.visibleInSelector !== filters.visibleInSelector
    ) {
      return false;
    }
    if (filters.defaultsOnly && !row.defaultForChat && !row.defaultForAgent) {
      return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((left, right) => {
    const modifier = filters.direction === "asc" ? 1 : -1;
    if (filters.sort === "updatedAt") {
      return (left.updatedAt.getTime() - right.updatedAt.getTime()) * modifier;
    }
    if (filters.sort === "createdAt") {
      return (left.createdAt.getTime() - right.createdAt.getTime()) * modifier;
    }
    return (left.priorityRank - right.priorityRank) * modifier;
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

function clearDefault(
  rows: Map<string, ModelPolicyRecord>,
  field: "defaultForChat" | "defaultForAgent",
  exceptRegistryModelId: string,
) {
  for (const [registryModelId, row] of rows) {
    if (registryModelId !== exceptRegistryModelId && row[field]) {
      rows.set(registryModelId, {
        ...row,
        [field]: false,
        updatedAt: new Date(),
      });
    }
  }
}

function valueOrExisting<
  Key extends "requestsPerMinuteLimit" | "tokensPerDayLimit" | "tokensPerRequestLimit" | "notes",
>(
  patch: UpsertModelPolicyInput["patch"],
  key: Key,
  existing: ModelPolicyRecord | undefined,
  fallback: ModelPolicyRecord[Key],
) {
  return key in patch ? patch[key] ?? null : existing?.[key] ?? fallback;
}

function mapPolicyRow(row: ModelPolicyRow): ModelPolicyRecord {
  return {
    id: row.id,
    registryModelId: row.registryModelId,
    enabled: row.enabled,
    visibleInSelector: row.visibleInSelector,
    priorityRank: row.priorityRank,
    defaultForChat: row.defaultForChat,
    defaultForAgent: row.defaultForAgent,
    requiresCompanion: row.requiresCompanion,
    requestsPerMinuteLimit: row.requestsPerMinuteLimit,
    tokensPerDayLimit: row.tokensPerDayLimit,
    tokensPerRequestLimit: row.tokensPerRequestLimit,
    notes: row.notes,
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapRegistryRow(row: ModelRegistryRow): ModelPolicyRegistryReference {
  return {
    id: row.id,
    status: row.status === "registered" ? "registered" : "archived",
    archivedAt: row.archivedAt,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
