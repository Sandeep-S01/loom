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
import { routingAttempts } from "../../db/schema.js";
import type {
  CreateRoutingAttemptInput,
  PaginatedRoutingAttemptsResult,
  RoutingAttemptListFilters,
  RoutingAttemptRecord,
  RoutingAttemptStatus,
  RoutingMode,
} from "./domain.js";
import type { RoutingAttemptRepository } from "./interfaces.js";

type RoutingAttemptRow = typeof routingAttempts.$inferSelect;

export function createDatabaseRoutingAttemptRepository(): RoutingAttemptRepository {
  return {
    async list(filters) {
      const conditions = buildConditions(filters);
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const offset = (filters.page - 1) * filters.pageSize;
      const db = getDb();
      const [{ total }] = await db
        .select({ total: count() })
        .from(routingAttempts)
        .where(whereClause);
      const rows = await db
        .select()
        .from(routingAttempts)
        .where(whereClause)
        .orderBy(
          filters.direction === "asc"
            ? asc(routingAttempts.createdAt)
            : desc(routingAttempts.createdAt),
        )
        .limit(filters.pageSize)
        .offset(offset);
      return {
        items: rows.map(mapRoutingAttemptRow),
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        hasNextPage: offset + rows.length < total,
      };
    },

    async findByRequestId(requestId) {
      const [row] = await getDb()
        .select()
        .from(routingAttempts)
        .where(eq(routingAttempts.requestId, requestId))
        .limit(1);
      return row ? mapRoutingAttemptRow(row) : null;
    },

    async create(input) {
      const now = new Date();
      const [row] = await getDb()
        .insert(routingAttempts)
        .values({
          id: `ratt_${randomUUID()}`,
          requestId: input.requestId,
          userId: input.userId,
          conversationId: input.conversationId,
          agentRunId: input.agentRunId,
          mode: input.mode,
          registryModelId: input.registryModelId,
          status: input.status,
          eligibleCount: input.eligibleCount,
          ineligibleCount: input.ineligibleCount,
          reasonCode: input.reasonCode,
          reasonMessage: input.reasonMessage,
          metadataJson: input.metadata,
          createdAt: now,
        })
        .returning();
      return mapRoutingAttemptRow(row);
    },
  };
}

export function createInMemoryRoutingAttemptRepository(
  seed: RoutingAttemptRecord[] = [],
): RoutingAttemptRepository {
  const rowsById = new Map(seed.map((row) => [row.id, row]));

  return {
    async list(filters) {
      return paginateAttempts(Array.from(rowsById.values()), filters);
    },

    async findByRequestId(requestId) {
      return (
        Array.from(rowsById.values()).find((row) => row.requestId === requestId) ??
        null
      );
    },

    async create(input) {
      const record: RoutingAttemptRecord = {
        id: `ratt_${randomUUID()}`,
        requestId: input.requestId,
        userId: input.userId,
        conversationId: input.conversationId,
        agentRunId: input.agentRunId,
        mode: input.mode,
        registryModelId: input.registryModelId,
        status: input.status,
        eligibleCount: input.eligibleCount,
        ineligibleCount: input.ineligibleCount,
        reasonCode: input.reasonCode,
        reasonMessage: input.reasonMessage,
        metadata: input.metadata,
        createdAt: new Date(),
      };
      rowsById.set(record.id, record);
      return record;
    },
  };
}

function buildConditions(filters: RoutingAttemptListFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.userId) conditions.push(eq(routingAttempts.userId, filters.userId));
  if (filters.conversationId) {
    conditions.push(eq(routingAttempts.conversationId, filters.conversationId));
  }
  if (filters.agentRunId) {
    conditions.push(eq(routingAttempts.agentRunId, filters.agentRunId));
  }
  if (filters.registryModelId) {
    conditions.push(eq(routingAttempts.registryModelId, filters.registryModelId));
  }
  if (filters.status) conditions.push(eq(routingAttempts.status, filters.status));
  if (filters.mode) conditions.push(eq(routingAttempts.mode, filters.mode));
  return conditions;
}

function paginateAttempts(
  rows: RoutingAttemptRecord[],
  filters: RoutingAttemptListFilters,
): PaginatedRoutingAttemptsResult {
  const filtered = rows.filter((row) => {
    if (filters.userId && row.userId !== filters.userId) return false;
    if (filters.conversationId && row.conversationId !== filters.conversationId) {
      return false;
    }
    if (filters.agentRunId && row.agentRunId !== filters.agentRunId) return false;
    if (filters.registryModelId && row.registryModelId !== filters.registryModelId) {
      return false;
    }
    if (filters.status && row.status !== filters.status) return false;
    if (filters.mode && row.mode !== filters.mode) return false;
    return true;
  });
  const sorted = [...filtered].sort((left, right) => {
    const modifier = filters.direction === "asc" ? 1 : -1;
    return (left.createdAt.getTime() - right.createdAt.getTime()) * modifier;
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

function mapRoutingAttemptRow(row: RoutingAttemptRow): RoutingAttemptRecord {
  return {
    id: row.id,
    requestId: row.requestId,
    userId: row.userId,
    conversationId: row.conversationId,
    agentRunId: row.agentRunId,
    mode: normalizeMode(row.mode),
    registryModelId: row.registryModelId,
    status: normalizeStatus(row.status),
    eligibleCount: row.eligibleCount,
    ineligibleCount: row.ineligibleCount,
    reasonCode: row.reasonCode,
    reasonMessage: row.reasonMessage,
    metadata: row.metadataJson,
    createdAt: row.createdAt,
  };
}

function normalizeMode(mode: string): RoutingMode {
  return mode === "agent" ? "agent" : "chat";
}

function normalizeStatus(status: string): RoutingAttemptStatus {
  return status === "selected" || status === "no_eligible_models"
    ? status
    : "no_eligible_models";
}
