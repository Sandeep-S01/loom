import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { generateId } from "@clm/shared-utils";
import type {
  ModelFailoverAttemptItem,
  ModelFailoverAttemptsResponse,
  ModelAnalyticsResponse,
  ModelAnalyticsSeriesItem,
  ModelAnalyticsSummaryItem,
} from "@clm/shared-types";
import { getDb } from "../../db/connection.js";
import {
  modelUsageEvents,
  modelUsageRollups,
  models,
  providers,
} from "../../db/schema.js";
import type { ProviderFailureCode } from "../providers/types.js";

export interface RecordModelAttemptInput {
  conversationId: string | null;
  messageId: string | null;
  providerId: string;
  modelId: string;
  attemptNo: number;
  wasManualSelection: boolean;
  wasFailover: boolean;
  requestKind: "chat" | "agent" | "test_connection";
  status: "success" | "failed" | "skipped_cooldown" | "blocked_quota";
  failureCode?: ProviderFailureCode;
  latencyMs: number | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsdMicros: number;
  idempotencyKey: string;
  createdAt?: string;
}

export interface GetModelAnalyticsInput {
  from: string;
  to: string;
  granularity: "hour" | "day";
  modelId?: string;
}

export interface ListModelAttemptEventsInput {
  page: number;
  pageSize: number;
  modelId?: string;
  status?: "success" | "failed" | "skipped_cooldown" | "blocked_quota";
  from?: string;
  to?: string;
}

export interface ModelAnalyticsService {
  recordAttempt(input: RecordModelAttemptInput): Promise<void>;
  getAnalytics(input: GetModelAnalyticsInput): Promise<ModelAnalyticsResponse>;
  listAttemptEvents(input: ListModelAttemptEventsInput): Promise<ModelFailoverAttemptsResponse>;
}

interface InMemoryEvent extends RecordModelAttemptInput {
  createdAt: string;
}

export function createInMemoryModelAnalyticsService(): ModelAnalyticsService {
  const events: InMemoryEvent[] = [];

  return {
    async recordAttempt(input) {
      events.push({
        ...input,
        createdAt: input.createdAt ?? new Date().toISOString(),
      });
    },

    async getAnalytics(input) {
      const filtered = events.filter((event) => {
        if (event.createdAt < input.from || event.createdAt > input.to) {
          return false;
        }

        if (input.modelId && event.modelId !== input.modelId) {
          return false;
        }

        return true;
      });

      const summaryMap = new Map<string, ModelAnalyticsSummaryItem>();
      const seriesMap = new Map<string, ModelAnalyticsSeriesItem>();

      for (const event of filtered) {
        const summary = summaryMap.get(event.modelId) ?? makeEmptySummary(event.modelId);
        accumulateSummary(summary, event);
        summaryMap.set(event.modelId, summary);

        const bucketStart = normalizeBucket(event.createdAt, input.granularity);
        const seriesKey = `${event.modelId}:${bucketStart}:${input.granularity}`;
        const series =
          seriesMap.get(seriesKey) ??
          {
            ...makeEmptySummary(event.modelId),
            bucketStart,
            granularity: input.granularity,
          };
        accumulateSummary(series, event);
        seriesMap.set(seriesKey, series);
      }

      return {
        summary: Array.from(summaryMap.values()),
        series: Array.from(seriesMap.values()).sort((left, right) =>
          left.bucketStart.localeCompare(right.bucketStart),
        ),
      };
    },

    async listAttemptEvents(input) {
      const filtered = events.filter((event) => {
        if (input.modelId && event.modelId !== input.modelId) return false;
        if (input.status && event.status !== input.status) return false;
        if (input.from && event.createdAt < input.from) return false;
        if (input.to && event.createdAt > input.to) return false;
        return true;
      });
      const sorted = filtered.sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      );
      const page = normalizePage(input.page);
      const pageSize = normalizePageSize(input.pageSize);
      const start = (page - 1) * pageSize;
      const items = sorted.slice(start, start + pageSize).map((event) => ({
        id: `${event.idempotencyKey}:${event.attemptNo}:${event.modelId}`,
        conversationId: event.conversationId,
        messageId: event.messageId,
        providerId: event.providerId,
        providerName: event.providerId,
        modelId: event.modelId,
        modelName: event.modelId,
        providerModelId: event.modelId,
        attemptNo: event.attemptNo,
        wasManualSelection: event.wasManualSelection,
        wasFailover: event.wasFailover,
        requestKind: event.requestKind,
        status: event.status,
        failureCode: event.failureCode ?? null,
        latencyMs: event.latencyMs,
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        totalTokens: event.totalTokens,
        costUsdMicros: event.costUsdMicros,
        idempotencyKey: event.idempotencyKey,
        createdAt: event.createdAt,
      }));

      return {
        items,
        page,
        pageSize,
        total: filtered.length,
        hasNextPage: start + pageSize < filtered.length,
      };
    },
  };
}

export function createDatabaseModelAnalyticsService(): ModelAnalyticsService {
  return {
    async recordAttempt(input) {
      const db = getDb();
      const createdAt = new Date(input.createdAt ?? new Date().toISOString());
      const successDelta = input.status === "success" ? 1 : 0;
      const errorDelta = input.status === "failed" ? 1 : 0;
      const rateLimitDelta =
        input.failureCode === "quota_exhausted" ||
        input.failureCode === "rate_limited_transient" ||
        input.failureCode === "provider_rate_limited"
          ? 1
          : 0;

      await db.transaction(async (tx) => {
        await tx.insert(modelUsageEvents).values({
          id: generateId("providerAttempt"),
          conversationId: input.conversationId,
          messageId: input.messageId,
          providerId: input.providerId,
          modelId: input.modelId,
          attemptNo: input.attemptNo,
          wasManualSelection: input.wasManualSelection,
          wasFailover: input.wasFailover,
          requestKind: input.requestKind,
          status: input.status,
          failureCode: input.failureCode ?? null,
          latencyMs: input.latencyMs,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          totalTokens: input.totalTokens,
          costUsdMicros: input.costUsdMicros,
          idempotencyKey: input.idempotencyKey,
          createdAt,
        });

        for (const granularity of ["hour", "day"] as const) {
          const bucketStart = new Date(normalizeBucket(createdAt.toISOString(), granularity));

          await tx
            .insert(modelUsageRollups)
            .values({
              id: generateId("provider"),
              modelId: input.modelId,
              bucketStart,
              bucketGranularity: granularity,
              requestCount: 1,
              successCount: successDelta,
              errorCount: errorDelta,
              rateLimitCount: rateLimitDelta,
              inputTokens: input.inputTokens,
              outputTokens: input.outputTokens,
              totalTokens: input.totalTokens,
              costUsdMicros: input.costUsdMicros,
            })
            .onConflictDoUpdate({
              target: [
                modelUsageRollups.modelId,
                modelUsageRollups.bucketStart,
                modelUsageRollups.bucketGranularity,
              ],
              set: {
                requestCount: sql`${modelUsageRollups.requestCount} + 1`,
                successCount: sql`${modelUsageRollups.successCount} + ${successDelta}`,
                errorCount: sql`${modelUsageRollups.errorCount} + ${errorDelta}`,
                rateLimitCount: sql`${modelUsageRollups.rateLimitCount} + ${rateLimitDelta}`,
                inputTokens: sql`${modelUsageRollups.inputTokens} + ${input.inputTokens}`,
                outputTokens: sql`${modelUsageRollups.outputTokens} + ${input.outputTokens}`,
                totalTokens: sql`${modelUsageRollups.totalTokens} + ${input.totalTokens}`,
                costUsdMicros: sql`${modelUsageRollups.costUsdMicros} + ${input.costUsdMicros}`,
              },
            });
        }
      });
    },

    async getAnalytics(input) {
      const db = getDb();
      const from = new Date(input.from);
      const to = new Date(input.to);

      const whereClause = input.modelId
        ? and(
            eq(modelUsageRollups.modelId, input.modelId),
            eq(modelUsageRollups.bucketGranularity, input.granularity),
            gte(modelUsageRollups.bucketStart, from),
            lte(modelUsageRollups.bucketStart, to),
          )
        : and(
            eq(modelUsageRollups.bucketGranularity, input.granularity),
            gte(modelUsageRollups.bucketStart, from),
            lte(modelUsageRollups.bucketStart, to),
          );

      const seriesRows = await db.query.modelUsageRollups.findMany({
        where: whereClause,
      });

      const summaryRows = await db
        .select({
          modelId: modelUsageEvents.modelId,
          requestCount: sql<number>`count(*)`,
          successCount:
            sql<number>`sum(case when ${modelUsageEvents.status} = 'success' then 1 else 0 end)`,
          errorCount:
            sql<number>`sum(case when ${modelUsageEvents.status} = 'failed' then 1 else 0 end)`,
          rateLimitCount:
            sql<number>`sum(case when ${modelUsageEvents.failureCode} in ('quota_exhausted', 'rate_limited_transient', 'provider_rate_limited') then 1 else 0 end)`,
          inputTokens: sql<number>`coalesce(sum(${modelUsageEvents.inputTokens}), 0)`,
          outputTokens: sql<number>`coalesce(sum(${modelUsageEvents.outputTokens}), 0)`,
          totalTokens: sql<number>`coalesce(sum(${modelUsageEvents.totalTokens}), 0)`,
          costUsdMicros: sql<number>`coalesce(sum(${modelUsageEvents.costUsdMicros}), 0)`,
        })
        .from(modelUsageEvents)
        .where(
          input.modelId
            ? and(
                eq(modelUsageEvents.modelId, input.modelId),
                gte(modelUsageEvents.createdAt, from),
                lte(modelUsageEvents.createdAt, to),
              )
            : and(
                gte(modelUsageEvents.createdAt, from),
                lte(modelUsageEvents.createdAt, to),
              ),
        )
        .groupBy(modelUsageEvents.modelId);

      return {
        summary: summaryRows.map((row) => ({
          modelId: row.modelId,
          requestCount: Number(row.requestCount),
          successCount: Number(row.successCount),
          errorCount: Number(row.errorCount),
          rateLimitCount: Number(row.rateLimitCount),
          inputTokens: Number(row.inputTokens),
          outputTokens: Number(row.outputTokens),
          totalTokens: Number(row.totalTokens),
          costUsdMicros: Number(row.costUsdMicros),
        })),
        series: seriesRows.map((row) => ({
          modelId: row.modelId,
          bucketStart: row.bucketStart.toISOString(),
          granularity: row.bucketGranularity as "hour" | "day",
          requestCount: row.requestCount,
          successCount: row.successCount,
          errorCount: row.errorCount,
          rateLimitCount: row.rateLimitCount,
          inputTokens: row.inputTokens,
          outputTokens: row.outputTokens,
          totalTokens: row.totalTokens,
          costUsdMicros: row.costUsdMicros,
        })),
      };
    },

    async listAttemptEvents(input) {
      const db = getDb();
      const page = normalizePage(input.page);
      const pageSize = normalizePageSize(input.pageSize);
      const offset = (page - 1) * pageSize;
      const from = input.from ? new Date(input.from) : undefined;
      const to = input.to ? new Date(input.to) : undefined;
      const whereClause = and(
        input.modelId ? eq(modelUsageEvents.modelId, input.modelId) : undefined,
        input.status ? eq(modelUsageEvents.status, input.status) : undefined,
        from ? gte(modelUsageEvents.createdAt, from) : undefined,
        to ? lte(modelUsageEvents.createdAt, to) : undefined,
      );

      const rows = await db
        .select({
          id: modelUsageEvents.id,
          conversationId: modelUsageEvents.conversationId,
          messageId: modelUsageEvents.messageId,
          providerId: modelUsageEvents.providerId,
          providerName: providers.name,
          modelId: modelUsageEvents.modelId,
          modelName: models.name,
          providerModelId: models.externalModelKey,
          attemptNo: modelUsageEvents.attemptNo,
          wasManualSelection: modelUsageEvents.wasManualSelection,
          wasFailover: modelUsageEvents.wasFailover,
          requestKind: modelUsageEvents.requestKind,
          status: modelUsageEvents.status,
          failureCode: modelUsageEvents.failureCode,
          latencyMs: modelUsageEvents.latencyMs,
          inputTokens: modelUsageEvents.inputTokens,
          outputTokens: modelUsageEvents.outputTokens,
          totalTokens: modelUsageEvents.totalTokens,
          costUsdMicros: modelUsageEvents.costUsdMicros,
          idempotencyKey: modelUsageEvents.idempotencyKey,
          createdAt: modelUsageEvents.createdAt,
        })
        .from(modelUsageEvents)
        .innerJoin(models, eq(modelUsageEvents.modelId, models.id))
        .innerJoin(providers, eq(modelUsageEvents.providerId, providers.id))
        .where(whereClause)
        .orderBy(desc(modelUsageEvents.createdAt))
        .limit(pageSize)
        .offset(offset);

      const totalRows = await db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(modelUsageEvents)
        .where(whereClause);

      const total = Number(totalRows[0]?.count ?? 0);

      return {
        items: rows.map((row) => ({
          id: row.id,
          conversationId: row.conversationId,
          messageId: row.messageId,
          providerId: row.providerId,
          providerName: row.providerName,
          modelId: row.modelId,
          modelName: row.modelName,
          providerModelId: row.providerModelId,
          attemptNo: row.attemptNo,
          wasManualSelection: row.wasManualSelection,
          wasFailover: row.wasFailover,
          requestKind: row.requestKind as ModelFailoverAttemptItem["requestKind"],
          status: row.status as ModelFailoverAttemptItem["status"],
          failureCode: row.failureCode,
          latencyMs: row.latencyMs,
          inputTokens: row.inputTokens,
          outputTokens: row.outputTokens,
          totalTokens: row.totalTokens,
          costUsdMicros: row.costUsdMicros,
          idempotencyKey: row.idempotencyKey,
          createdAt: row.createdAt.toISOString(),
        })),
        page,
        pageSize,
        total,
        hasNextPage: offset + rows.length < total,
      };
    },
  };
}

function normalizePage(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function normalizePageSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 25;
  return Math.min(100, Math.max(1, Math.floor(value)));
}

function makeEmptySummary(modelId: string): ModelAnalyticsSummaryItem {
  return {
    modelId,
    requestCount: 0,
    successCount: 0,
    errorCount: 0,
    rateLimitCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costUsdMicros: 0,
  };
}

function accumulateSummary(
  target: ModelAnalyticsSummaryItem,
  event: Pick<
    RecordModelAttemptInput,
    | "status"
    | "failureCode"
    | "inputTokens"
    | "outputTokens"
    | "totalTokens"
    | "costUsdMicros"
  >,
) {
  target.requestCount += 1;
  if (event.status === "success") target.successCount += 1;
  if (event.status === "failed") target.errorCount += 1;
  if (
    event.failureCode === "quota_exhausted" ||
    event.failureCode === "rate_limited_transient" ||
    event.failureCode === "provider_rate_limited"
  ) {
    target.rateLimitCount += 1;
  }
  target.inputTokens += event.inputTokens;
  target.outputTokens += event.outputTokens;
  target.totalTokens += event.totalTokens;
  target.costUsdMicros += event.costUsdMicros;
}

function normalizeBucket(isoString: string, granularity: "hour" | "day") {
  const date = new Date(isoString);
  date.setUTCMinutes(0, 0, 0);
  if (granularity === "day") {
    date.setUTCHours(0, 0, 0, 0);
  }
  return date.toISOString();
}
