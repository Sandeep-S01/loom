import { generateId } from "@clm/shared-utils";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import { getDb } from "../../db/connection.js";
import { auditEvents } from "../../db/schema.js";
import type {
  AuditEventListFilters,
  AuditEventRecord,
  AuditPayload,
  PaginatedAuditEventResult,
  RecordAuditEventInput,
} from "./domain.js";
import type { AuditEventRepository } from "./interfaces.js";

type AuditEventRow = typeof auditEvents.$inferSelect;

export function createDatabaseAuditEventRepository(): AuditEventRepository {
  return {
    async create(input) {
      const [row] = await getDb()
        .insert(auditEvents)
        .values({
          id: generateId("auditEvent"),
          userId: input.userId,
          deviceId: input.deviceId ?? null,
          eventType: input.eventType,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          payloadJson: input.payload ?? null,
          createdAt: input.createdAt ?? new Date(),
        })
        .returning();
      return mapAuditEventRow(row);
    },

    async findById(id) {
      const [row] = await getDb()
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.id, id))
        .limit(1);
      return row ? mapAuditEventRow(row) : null;
    },

    async list(filters) {
      const conditions = buildConditions(filters);
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const offset = (filters.page - 1) * filters.pageSize;
      const db = getDb();
      const [{ total }] = await db
        .select({ total: count() })
        .from(auditEvents)
        .where(whereClause);
      const rows = await db
        .select()
        .from(auditEvents)
        .where(whereClause)
        .orderBy(
          filters.direction === "asc"
            ? asc(auditEvents.createdAt)
            : desc(auditEvents.createdAt),
        )
        .limit(filters.pageSize)
        .offset(offset);

      return {
        items: rows.map(mapAuditEventRow),
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        hasNextPage: offset + rows.length < total,
      };
    },
  };
}

export function createInMemoryAuditEventRepository(
  seed: AuditEventRecord[] = [],
): AuditEventRepository {
  const rowsById = new Map(seed.map((row) => [row.id, row]));

  return {
    async create(input) {
      const record: AuditEventRecord = {
        id: generateId("auditEvent"),
        userId: input.userId,
        deviceId: input.deviceId ?? null,
        eventType: input.eventType,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        payload: input.payload ?? null,
        createdAt: input.createdAt ?? new Date(),
      };
      rowsById.set(record.id, record);
      return record;
    },

    async findById(id) {
      return rowsById.get(id) ?? null;
    },

    async list(filters) {
      return paginateEvents(Array.from(rowsById.values()), filters);
    },
  };
}

function buildConditions(filters: AuditEventListFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.userId) conditions.push(eq(auditEvents.userId, filters.userId));
  if (filters.deviceId) conditions.push(eq(auditEvents.deviceId, filters.deviceId));
  if (filters.eventType) conditions.push(eq(auditEvents.eventType, filters.eventType));
  if (filters.subjectType) conditions.push(eq(auditEvents.subjectType, filters.subjectType));
  if (filters.subjectId) conditions.push(eq(auditEvents.subjectId, filters.subjectId));
  if (filters.from) conditions.push(gte(auditEvents.createdAt, filters.from));
  if (filters.to) conditions.push(lte(auditEvents.createdAt, filters.to));
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(auditEvents.eventType, pattern),
        ilike(auditEvents.subjectType, pattern),
        ilike(auditEvents.subjectId, pattern),
        ilike(auditEvents.userId, pattern),
      ) as SQL,
    );
  }
  return conditions;
}

function paginateEvents(
  rows: AuditEventRecord[],
  filters: AuditEventListFilters,
): PaginatedAuditEventResult {
  const filtered = rows.filter((row) => matchesFilters(row, filters));
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

function matchesFilters(row: AuditEventRecord, filters: AuditEventListFilters) {
  if (filters.userId && row.userId !== filters.userId) return false;
  if (filters.deviceId && row.deviceId !== filters.deviceId) return false;
  if (filters.eventType && row.eventType !== filters.eventType) return false;
  if (filters.subjectType && row.subjectType !== filters.subjectType) return false;
  if (filters.subjectId && row.subjectId !== filters.subjectId) return false;
  if (filters.from && row.createdAt < filters.from) return false;
  if (filters.to && row.createdAt > filters.to) return false;
  if (filters.search) {
    const needle = filters.search.toLowerCase();
    return [row.eventType, row.subjectType, row.subjectId, row.userId]
      .some((value) => value.toLowerCase().includes(needle));
  }
  return true;
}

function mapAuditEventRow(row: AuditEventRow): AuditEventRecord {
  return {
    id: row.id,
    userId: row.userId,
    deviceId: row.deviceId,
    eventType: row.eventType,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    payload: isAuditPayload(row.payloadJson) ? row.payloadJson : null,
    createdAt: row.createdAt,
  };
}

function isAuditPayload(value: unknown): value is AuditPayload {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
