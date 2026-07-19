import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb } from "../../db/connection.js";
import { modelUsageCounters } from "../../db/schema.js";
import type {
  ModelUsageRepository,
} from "./interfaces.js";
import type {
  PaginatedUsageCounterResult,
  RecordModelUsageInput,
  UsageCounterGranularity,
  UsageCounterListFilters,
  UsageCounterRecord,
  UsageSummary,
  UsageSummaryFilters,
} from "./domain.js";

type UsageCounterRow = typeof modelUsageCounters.$inferSelect;

export function createDatabaseModelUsageRepository(): ModelUsageRepository {
  return {
    async record(input) {
      const counters: UsageCounterRecord[] = [];
      for (const granularity of ["hour", "day"] as const) {
        const counter = await upsertCounter(input, granularity);
        counters.push(counter);
      }
      return counters;
    },

    async listCounters(filters) {
      const conditions = buildListConditions(filters);
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const offset = (filters.page - 1) * filters.pageSize;
      const db = getDb();
      const [{ total }] = await db
        .select({ total: count() })
        .from(modelUsageCounters)
        .where(whereClause);
      const rows = await db
        .select()
        .from(modelUsageCounters)
        .where(whereClause)
        .orderBy(getOrderBy(filters))
        .limit(filters.pageSize)
        .offset(offset);
      return {
        items: rows.map(mapCounterRow),
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        hasNextPage: offset + rows.length < total,
      };
    },

    async summarize(filters) {
      const conditions = [
        eq(modelUsageCounters.bucketGranularity, "hour"),
        ...buildSummaryConditions(filters),
      ];
      const [row] = await getDb()
        .select({
          requestCount: sql<number>`coalesce(sum(${modelUsageCounters.requestCount}), 0)`,
          successCount: sql<number>`coalesce(sum(${modelUsageCounters.successCount}), 0)`,
          failureCount: sql<number>`coalesce(sum(${modelUsageCounters.failureCount}), 0)`,
          fallbackCount: sql<number>`coalesce(sum(${modelUsageCounters.fallbackCount}), 0)`,
          rateLimitCount: sql<number>`coalesce(sum(${modelUsageCounters.rateLimitCount}), 0)`,
          inputTokens: sql<number>`coalesce(sum(${modelUsageCounters.inputTokens}), 0)`,
          outputTokens: sql<number>`coalesce(sum(${modelUsageCounters.outputTokens}), 0)`,
          totalTokens: sql<number>`coalesce(sum(${modelUsageCounters.totalTokens}), 0)`,
          latencyMsTotal: sql<number>`coalesce(sum(${modelUsageCounters.latencyMsTotal}), 0)`,
          latencySampleCount:
            sql<number>`coalesce(sum(${modelUsageCounters.latencySampleCount}), 0)`,
          costUsdMicros: sql<number>`coalesce(sum(${modelUsageCounters.costUsdMicros}), 0)`,
        })
        .from(modelUsageCounters)
        .where(and(...conditions));
      return toSummary(row);
    },
  };
}

export function createInMemoryModelUsageRepository(
  seed: UsageCounterRecord[] = [],
): ModelUsageRepository {
  const rowsByKey = new Map(seed.map((row) => [counterKey(row), row]));

  return {
    async record(input) {
      const updated: UsageCounterRecord[] = [];
      for (const granularity of ["hour", "day"] as const) {
        const bucketStart = normalizeBucket(input.occurredAt ?? new Date(), granularity);
        const key = `${input.registryModelId}:${bucketStart.toISOString()}:${granularity}`;
        const existing = rowsByKey.get(key);
        const next = accumulateCounter(existing, input, bucketStart, granularity);
        rowsByKey.set(key, next);
        updated.push(next);
      }
      return updated;
    },

    async listCounters(filters) {
      return paginateCounters(Array.from(rowsByKey.values()), filters);
    },

    async summarize(filters) {
      const rows = Array.from(rowsByKey.values()).filter((row) => {
        if (row.bucketGranularity !== "hour") return false;
        if (filters.registryModelId && row.registryModelId !== filters.registryModelId) {
          return false;
        }
        if (filters.providerId && row.providerId !== filters.providerId) return false;
        if (filters.from && row.bucketStart < filters.from) return false;
        if (filters.to && row.bucketStart > filters.to) return false;
        return true;
      });
      return summarizeRows(rows);
    },
  };
}

async function upsertCounter(
  input: RecordModelUsageInput,
  granularity: UsageCounterGranularity,
) {
  const now = new Date();
  const bucketStart = normalizeBucket(input.occurredAt ?? now, granularity);
  const successDelta = input.status === "success" ? 1 : 0;
  const failureDelta = input.status === "failed" ? 1 : 0;
  const fallbackDelta = input.usedFallback ? 1 : 0;
  const rateLimitDelta = isRateLimitFailure(input.failureCode) ? 1 : 0;
  const latencyMs = input.latencyMs ?? 0;
  const latencySampleDelta =
    input.latencyMs === undefined || input.latencyMs === null ? 0 : 1;
  const [row] = await getDb()
    .insert(modelUsageCounters)
    .values({
      id: `muc_${randomUUID()}`,
      registryModelId: input.registryModelId,
      providerId: input.providerId,
      bucketStart,
      bucketGranularity: granularity,
      requestCount: 1,
      successCount: successDelta,
      failureCount: failureDelta,
      fallbackCount: fallbackDelta,
      rateLimitCount: rateLimitDelta,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      totalTokens: input.totalTokens,
      latencyMsTotal: latencyMs,
      latencySampleCount: latencySampleDelta,
      costUsdMicros: input.costUsdMicros,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        modelUsageCounters.registryModelId,
        modelUsageCounters.bucketStart,
        modelUsageCounters.bucketGranularity,
      ],
      set: {
        requestCount: sql`${modelUsageCounters.requestCount} + 1`,
        successCount: sql`${modelUsageCounters.successCount} + ${successDelta}`,
        failureCount: sql`${modelUsageCounters.failureCount} + ${failureDelta}`,
        fallbackCount: sql`${modelUsageCounters.fallbackCount} + ${fallbackDelta}`,
        rateLimitCount: sql`${modelUsageCounters.rateLimitCount} + ${rateLimitDelta}`,
        inputTokens: sql`${modelUsageCounters.inputTokens} + ${input.inputTokens}`,
        outputTokens: sql`${modelUsageCounters.outputTokens} + ${input.outputTokens}`,
        totalTokens: sql`${modelUsageCounters.totalTokens} + ${input.totalTokens}`,
        latencyMsTotal: sql`${modelUsageCounters.latencyMsTotal} + ${latencyMs}`,
        latencySampleCount:
          sql`${modelUsageCounters.latencySampleCount} + ${latencySampleDelta}`,
        costUsdMicros: sql`${modelUsageCounters.costUsdMicros} + ${input.costUsdMicros}`,
        updatedAt: now,
      },
    })
    .returning();
  return mapCounterRow(row);
}

function buildListConditions(filters: UsageCounterListFilters): SQL[] {
  const conditions: SQL[] = [eq(modelUsageCounters.bucketGranularity, filters.granularity)];
  if (filters.registryModelId) {
    conditions.push(eq(modelUsageCounters.registryModelId, filters.registryModelId));
  }
  if (filters.providerId) conditions.push(eq(modelUsageCounters.providerId, filters.providerId));
  if (filters.from) conditions.push(gte(modelUsageCounters.bucketStart, filters.from));
  if (filters.to) conditions.push(lte(modelUsageCounters.bucketStart, filters.to));
  return conditions;
}

function buildSummaryConditions(filters: UsageSummaryFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.registryModelId) {
    conditions.push(eq(modelUsageCounters.registryModelId, filters.registryModelId));
  }
  if (filters.providerId) conditions.push(eq(modelUsageCounters.providerId, filters.providerId));
  if (filters.from) conditions.push(gte(modelUsageCounters.bucketStart, filters.from));
  if (filters.to) conditions.push(lte(modelUsageCounters.bucketStart, filters.to));
  return conditions;
}

function getOrderBy(filters: UsageCounterListFilters) {
  const column = (() => {
    if (filters.sort === "requestCount") return modelUsageCounters.requestCount;
    if (filters.sort === "totalTokens") return modelUsageCounters.totalTokens;
    if (filters.sort === "updatedAt") return modelUsageCounters.updatedAt;
    return modelUsageCounters.bucketStart;
  })();
  return filters.direction === "asc" ? asc(column) : desc(column);
}

function paginateCounters(
  rows: UsageCounterRecord[],
  filters: UsageCounterListFilters,
): PaginatedUsageCounterResult {
  const filtered = rows.filter((row) => {
    if (row.bucketGranularity !== filters.granularity) return false;
    if (filters.registryModelId && row.registryModelId !== filters.registryModelId) {
      return false;
    }
    if (filters.providerId && row.providerId !== filters.providerId) return false;
    if (filters.from && row.bucketStart < filters.from) return false;
    if (filters.to && row.bucketStart > filters.to) return false;
    return true;
  });
  const sorted = [...filtered].sort((left, right) => {
    const modifier = filters.direction === "asc" ? 1 : -1;
    const leftValue = getSortValue(left, filters.sort);
    const rightValue = getSortValue(right, filters.sort);
    return (leftValue - rightValue) * modifier;
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

function accumulateCounter(
  existing: UsageCounterRecord | undefined,
  input: RecordModelUsageInput,
  bucketStart: Date,
  granularity: UsageCounterGranularity,
): UsageCounterRecord {
  const now = new Date();
  const base =
    existing ?? {
      id: `muc_${randomUUID()}`,
      registryModelId: input.registryModelId,
      providerId: input.providerId,
      bucketStart,
      bucketGranularity: granularity,
      requestCount: 0,
      successCount: 0,
      failureCount: 0,
      fallbackCount: 0,
      rateLimitCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      latencyMsTotal: 0,
      latencySampleCount: 0,
      costUsdMicros: 0,
      updatedAt: now,
    };
  return {
    ...base,
    providerId: input.providerId,
    requestCount: base.requestCount + 1,
    successCount: base.successCount + (input.status === "success" ? 1 : 0),
    failureCount: base.failureCount + (input.status === "failed" ? 1 : 0),
    fallbackCount: base.fallbackCount + (input.usedFallback ? 1 : 0),
    rateLimitCount: base.rateLimitCount + (isRateLimitFailure(input.failureCode) ? 1 : 0),
    inputTokens: base.inputTokens + input.inputTokens,
    outputTokens: base.outputTokens + input.outputTokens,
    totalTokens: base.totalTokens + input.totalTokens,
    latencyMsTotal: base.latencyMsTotal + (input.latencyMs ?? 0),
    latencySampleCount: base.latencySampleCount + getLatencySampleDelta(input),
    costUsdMicros: base.costUsdMicros + input.costUsdMicros,
    updatedAt: now,
  };
}

function getLatencySampleDelta(input: RecordModelUsageInput) {
  return input.latencyMs === undefined || input.latencyMs === null ? 0 : 1;
}

function summarizeRows(rows: UsageCounterRecord[]): UsageSummary {
  const summary = rows.reduce(
    (acc, row) => ({
      requestCount: acc.requestCount + row.requestCount,
      successCount: acc.successCount + row.successCount,
      failureCount: acc.failureCount + row.failureCount,
      fallbackCount: acc.fallbackCount + row.fallbackCount,
      rateLimitCount: acc.rateLimitCount + row.rateLimitCount,
      inputTokens: acc.inputTokens + row.inputTokens,
      outputTokens: acc.outputTokens + row.outputTokens,
      totalTokens: acc.totalTokens + row.totalTokens,
      latencyMsTotal: acc.latencyMsTotal + row.latencyMsTotal,
      latencySampleCount: acc.latencySampleCount + row.latencySampleCount,
      costUsdMicros: acc.costUsdMicros + row.costUsdMicros,
      averageLatencyMs: null,
    }),
    emptySummary(),
  );
  return withAverageLatency(summary);
}

function toSummary(row: Omit<UsageSummary, "averageLatencyMs"> | undefined): UsageSummary {
  return withAverageLatency({
    requestCount: Number(row?.requestCount ?? 0),
    successCount: Number(row?.successCount ?? 0),
    failureCount: Number(row?.failureCount ?? 0),
    fallbackCount: Number(row?.fallbackCount ?? 0),
    rateLimitCount: Number(row?.rateLimitCount ?? 0),
    inputTokens: Number(row?.inputTokens ?? 0),
    outputTokens: Number(row?.outputTokens ?? 0),
    totalTokens: Number(row?.totalTokens ?? 0),
    latencyMsTotal: Number(row?.latencyMsTotal ?? 0),
    latencySampleCount: Number(row?.latencySampleCount ?? 0),
    costUsdMicros: Number(row?.costUsdMicros ?? 0),
    averageLatencyMs: null,
  });
}

function withAverageLatency(summary: UsageSummary): UsageSummary {
  return {
    ...summary,
    averageLatencyMs:
      summary.latencySampleCount > 0
        ? Math.round(summary.latencyMsTotal / summary.latencySampleCount)
        : null,
  };
}

function emptySummary(): UsageSummary {
  return {
    requestCount: 0,
    successCount: 0,
    failureCount: 0,
    fallbackCount: 0,
    rateLimitCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    latencyMsTotal: 0,
    latencySampleCount: 0,
    averageLatencyMs: null,
    costUsdMicros: 0,
  };
}

function mapCounterRow(row: UsageCounterRow): UsageCounterRecord {
  return {
    id: row.id,
    registryModelId: row.registryModelId,
    providerId: row.providerId,
    bucketStart: row.bucketStart,
    bucketGranularity: row.bucketGranularity === "day" ? "day" : "hour",
    requestCount: row.requestCount,
    successCount: row.successCount,
    failureCount: row.failureCount,
    fallbackCount: row.fallbackCount,
    rateLimitCount: row.rateLimitCount,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    totalTokens: row.totalTokens,
    latencyMsTotal: row.latencyMsTotal,
    latencySampleCount: row.latencySampleCount,
    costUsdMicros: row.costUsdMicros,
    updatedAt: row.updatedAt,
  };
}

function normalizeBucket(date: Date, granularity: UsageCounterGranularity) {
  const bucket = new Date(date);
  bucket.setUTCMinutes(0, 0, 0);
  if (granularity === "day") bucket.setUTCHours(0, 0, 0, 0);
  return bucket;
}

function counterKey(row: UsageCounterRecord) {
  return `${row.registryModelId}:${row.bucketStart.toISOString()}:${row.bucketGranularity}`;
}

function getSortValue(row: UsageCounterRecord, sort: UsageCounterListFilters["sort"]) {
  if (sort === "requestCount") return row.requestCount;
  if (sort === "totalTokens") return row.totalTokens;
  if (sort === "updatedAt") return row.updatedAt.getTime();
  return row.bucketStart.getTime();
}

function isRateLimitFailure(failureCode: string | null | undefined) {
  return Boolean(
    failureCode &&
      [
        "quota_exhausted",
        "rate_limited",
        "rate_limited_transient",
        "provider_rate_limited",
      ].includes(failureCode),
  );
}
