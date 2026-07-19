import { badRequest } from "../../lib/http-errors.js";
import type {
  RecordModelUsageInput,
  UsageCounterDTO,
  UsageCounterRecord,
} from "./domain.js";
import type {
  ModelUsageLogger,
  ModelUsageRepository,
  ModelUsageService,
} from "./interfaces.js";

interface CreateModelUsageServiceOptions {
  repository: ModelUsageRepository;
  logger?: ModelUsageLogger;
}

const noopLogger: ModelUsageLogger = {
  info() {},
  warn() {},
  error() {},
};

export function createModelUsageService(
  options: CreateModelUsageServiceOptions,
): ModelUsageService {
  const logger = options.logger ?? noopLogger;

  return {
    async recordUsage(input) {
      validateUsageInput(input);
      const counters = await options.repository.record(input);
      logger.info(
        {
          event: "model_usage.recorded",
          registryModelId: input.registryModelId,
          providerId: input.providerId,
          mode: input.mode,
          status: input.status,
          usedFallback: input.usedFallback,
          totalTokens: input.totalTokens,
          counterCount: counters.length,
        },
        "Model usage recorded",
      );
      return { counters };
    },

    async listCounters(filters) {
      const result = await options.repository.listCounters(filters);
      return {
        items: result.items.map(mapUsageCounterRecord),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        hasNextPage: result.hasNextPage,
      };
    },

    async getSummary(filters) {
      return options.repository.summarize(filters);
    },
  };
}

export function mapUsageCounterRecord(record: UsageCounterRecord): UsageCounterDTO {
  return {
    id: record.id,
    registryModelId: record.registryModelId,
    providerId: record.providerId,
    bucketStart: record.bucketStart.toISOString(),
    bucketGranularity: record.bucketGranularity,
    requestCount: record.requestCount,
    successCount: record.successCount,
    failureCount: record.failureCount,
    fallbackCount: record.fallbackCount,
    rateLimitCount: record.rateLimitCount,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    totalTokens: record.totalTokens,
    latencyMsTotal: record.latencyMsTotal,
    latencySampleCount: record.latencySampleCount,
    averageLatencyMs:
      record.latencySampleCount > 0
        ? Math.round(record.latencyMsTotal / record.latencySampleCount)
        : null,
    costUsdMicros: record.costUsdMicros,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function validateUsageInput(input: RecordModelUsageInput) {
  requireNonEmpty(input.registryModelId, "registryModelId");
  requireNonEmpty(input.providerId, "providerId");
  if (input.failureCode !== undefined && input.failureCode !== null) {
    requireNonEmpty(input.failureCode, "failureCode");
  }
  requireNonNegativeInteger(input.inputTokens, "inputTokens");
  requireNonNegativeInteger(input.outputTokens, "outputTokens");
  requireNonNegativeInteger(input.totalTokens, "totalTokens");
  requireNonNegativeInteger(input.costUsdMicros, "costUsdMicros");
  if (input.latencyMs !== undefined && input.latencyMs !== null) {
    requireNonNegativeInteger(input.latencyMs, "latencyMs");
  }
  if (input.occurredAt && Number.isNaN(input.occurredAt.getTime())) {
    throw badRequest("occurredAt must be a valid date.");
  }
  if (input.totalTokens !== input.inputTokens + input.outputTokens) {
    throw badRequest("totalTokens must equal inputTokens plus outputTokens.");
  }
}

function requireNonEmpty(value: string, field: string) {
  if (!value.trim()) {
    throw badRequest(`${field} is required.`);
  }
}

function requireNonNegativeInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw badRequest(`${field} must be a non-negative integer.`);
  }
}
