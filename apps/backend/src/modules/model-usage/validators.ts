import { badRequest } from "../../lib/http-errors.js";
import type {
  RecordModelUsageInput,
  UsageCounterDirection,
  UsageCounterGranularity,
  UsageCounterListFilters,
  UsageCounterSort,
  UsageMode,
  UsageStatus,
  UsageSummaryFilters,
} from "./domain.js";

const MAX_PAGE_SIZE = 100;
const MAX_COUNTER_VALUE = 1_000_000_000;

export function parseRecordModelUsageBody(body: unknown): RecordModelUsageInput {
  const input = parseBodyObject(body);
  return {
    registryModelId: requiredString(input.registryModelId, "registryModelId", 50),
    providerId: requiredString(input.providerId, "providerId", 50),
    mode: parseMode(input.mode),
    status: parseStatus(input.status),
    usedFallback: parseBoolean(input.usedFallback, false),
    failureCode: nullableString(input.failureCode, "failureCode", 80),
    latencyMs: nullableInteger(input.latencyMs, "latencyMs", 0, MAX_COUNTER_VALUE),
    inputTokens: requiredInteger(input.inputTokens, "inputTokens", 0, MAX_COUNTER_VALUE),
    outputTokens: requiredInteger(input.outputTokens, "outputTokens", 0, MAX_COUNTER_VALUE),
    totalTokens: requiredInteger(input.totalTokens, "totalTokens", 0, MAX_COUNTER_VALUE),
    costUsdMicros: requiredInteger(input.costUsdMicros, "costUsdMicros", 0, MAX_COUNTER_VALUE),
    occurredAt: optionalDate(input.occurredAt, "occurredAt"),
  };
}

export function parseUsageCounterListQuery(
  query: Record<string, unknown>,
): UsageCounterListFilters {
  const filters = {
    registryModelId: optionalTrimmedString(query.registryModelId, 50),
    providerId: optionalTrimmedString(query.providerId, 50),
    granularity: parseGranularity(optionalString(query.granularity), "hour"),
    from: optionalQueryDate(query.from, "from"),
    to: optionalQueryDate(query.to, "to"),
    page: parsePositiveInt(optionalString(query.page), 1),
    pageSize: Math.min(parsePositiveInt(optionalString(query.pageSize), 50), MAX_PAGE_SIZE),
    sort: parseSort(optionalString(query.sort)),
    direction: parseDirection(optionalString(query.direction)),
  };
  assertDateRange(filters.from, filters.to);
  return filters;
}

export function parseUsageSummaryQuery(
  query: Record<string, unknown>,
): UsageSummaryFilters {
  const filters = {
    registryModelId: optionalTrimmedString(query.registryModelId, 50),
    providerId: optionalTrimmedString(query.providerId, 50),
    from: optionalQueryDate(query.from, "from"),
    to: optionalQueryDate(query.to, "to"),
  };
  assertDateRange(filters.from, filters.to);
  return filters;
}

function parseBodyObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("Request body must be an object.");
  }
  return value as Record<string, unknown>;
}

function parseMode(value: unknown): UsageMode {
  if (value === "chat" || value === "agent" || value === "test_connection") return value;
  throw badRequest("mode must be chat, agent, or test_connection.");
}

function parseStatus(value: unknown): UsageStatus {
  if (value === "success" || value === "failed" || value === "blocked") return value;
  throw badRequest("status must be success, failed, or blocked.");
}

function parseGranularity(
  value: string | undefined,
  fallback: UsageCounterGranularity,
): UsageCounterGranularity {
  if (!value) return fallback;
  if (value === "hour" || value === "day") return value;
  throw badRequest("granularity must be hour or day.");
}

function parseSort(value: string | undefined): UsageCounterSort {
  if (!value || value === "bucketStart") return "bucketStart";
  if (value === "requestCount" || value === "totalTokens" || value === "updatedAt") {
    return value;
  }
  throw badRequest("Invalid model usage sort field.");
}

function parseDirection(value: string | undefined): UsageCounterDirection {
  if (!value || value === "desc") return "desc";
  if (value === "asc") return "asc";
  throw badRequest("direction must be asc or desc.");
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (value === undefined) return fallback;
  if (value === true || value === false) return value;
  throw badRequest("Boolean fields must be true or false.");
}

function requiredInteger(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw badRequest(`${field} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function nullableInteger(value: unknown, field: string, min: number, max: number) {
  if (value === undefined || value === null) return null;
  return requiredInteger(value, field, min, max);
}

function requiredString(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string") throw badRequest(`${field} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw badRequest(`${field} must be between 1 and ${maxLength} characters.`);
  }
  return trimmed;
}

function nullableString(value: unknown, field: string, maxLength: number) {
  if (value === undefined || value === null) return null;
  return requiredString(value, field, maxLength);
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function optionalTrimmedString(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredString(value, "filter", maxLength);
}

function optionalDate(value: unknown, field: string) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw badRequest(`${field} must be an ISO date string.`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest(`${field} must be a valid ISO date.`);
  return date;
}

function optionalQueryDate(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return undefined;
  return optionalDate(value, field);
}

function assertDateRange(from: Date | undefined, to: Date | undefined) {
  if (from && to && from.getTime() > to.getTime()) {
    throw badRequest("from must be before or equal to to.");
  }
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw badRequest("Pagination values must be positive integers.");
  }
  return parsed;
}
