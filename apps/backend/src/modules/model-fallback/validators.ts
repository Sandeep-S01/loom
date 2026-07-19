import { badRequest } from "../../lib/http-errors.js";
import type {
  FallbackDecisionDirection,
  FallbackDecisionListFilters,
  FallbackDecisionSort,
  FallbackDecisionStatus,
  FallbackMode,
  SelectFallbackInput,
} from "./domain.js";

const MAX_TOKEN_ESTIMATE = 10_000_000;

export function parseSelectFallbackBody(
  body: unknown,
  userId: string,
): SelectFallbackInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw badRequest("Fallback request body must be an object.");
  }
  const input = body as Record<string, unknown>;
  return {
    mode: parseMode(input.mode),
    userId,
    conversationId: parseNullableId(input.conversationId, "conversationId"),
    agentRunId: parseNullableId(input.agentRunId, "agentRunId"),
    requestId: parseOptionalString(input.requestId, "requestId", 120),
    failedRoutingAttemptId: parseNullableId(
      input.failedRoutingAttemptId,
      "failedRoutingAttemptId",
    ),
    failedRegistryModelIds: parseFailedRegistryModelIds(input.failedRegistryModelIds),
    failureCode: parseRequiredString(input.failureCode, "failureCode", 80),
    failureMessage: parseNullableString(input.failureMessage, "failureMessage", 500),
    companionAvailable: parseBoolean(input.companionAvailable, false),
    estimatedInputTokens: parseOptionalTokenEstimate(
      input.estimatedInputTokens,
      "estimatedInputTokens",
    ),
    requestedOutputTokens: parseOptionalTokenEstimate(
      input.requestedOutputTokens,
      "requestedOutputTokens",
    ),
  };
}

export function parseFallbackDecisionListQuery(
  query: Record<string, unknown>,
): FallbackDecisionListFilters {
  return {
    userId: optionalString(query.userId),
    conversationId: optionalString(query.conversationId),
    agentRunId: optionalString(query.agentRunId),
    selectedRegistryModelId: optionalString(query.selectedRegistryModelId),
    status: parseStatus(optionalString(query.status)),
    mode: parseOptionalMode(optionalString(query.mode)),
    page: parsePositiveInt(optionalString(query.page), 1),
    pageSize: Math.min(parsePositiveInt(optionalString(query.pageSize), 50), 100),
    sort: parseSort(optionalString(query.sort)),
    direction: parseDirection(optionalString(query.direction)),
  };
}

function parseMode(value: unknown): FallbackMode {
  if (!value || value === "chat") return "chat";
  if (value === "agent") return "agent";
  throw badRequest("mode must be chat or agent.");
}

function parseOptionalMode(value: string | undefined): FallbackMode | undefined {
  if (!value) return undefined;
  return parseMode(value);
}

function parseStatus(value: string | undefined): FallbackDecisionStatus | undefined {
  if (!value) return undefined;
  if (value === "fallback_selected" || value === "exhausted") return value;
  throw badRequest("status must be fallback_selected or exhausted.");
}

function parseSort(value: string | undefined): FallbackDecisionSort {
  if (!value || value === "createdAt") return "createdAt";
  throw badRequest("Invalid fallback decision sort field.");
}

function parseDirection(value: string | undefined): FallbackDecisionDirection {
  if (!value || value === "desc") return "desc";
  if (value === "asc") return "asc";
  throw badRequest("direction must be asc or desc.");
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (value === undefined) return fallback;
  if (value === true || value === false) return value;
  throw badRequest("Boolean fields must be true or false.");
}

function parseOptionalTokenEstimate(value: unknown, field: string) {
  if (value === undefined || value === null) return undefined;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_TOKEN_ESTIMATE
  ) {
    throw badRequest(`${field} must be an integer between 0 and ${MAX_TOKEN_ESTIMATE}.`);
  }
  return value;
}

function parseFailedRegistryModelIds(value: unknown) {
  if (!Array.isArray(value)) {
    throw badRequest("failedRegistryModelIds must be an array.");
  }
  const ids = value.map((item) => {
    if (typeof item !== "string") {
      throw badRequest("failedRegistryModelIds must contain only strings.");
    }
    return item.trim();
  }).filter(Boolean);
  if (ids.length === 0) {
    throw badRequest("At least one failed registry model id is required.");
  }
  if (ids.length > 20) {
    throw badRequest("failedRegistryModelIds cannot contain more than 20 ids.");
  }
  return ids;
}

function parseNullableId(value: unknown, field: string) {
  if (value === undefined || value === null) return null;
  return parseOptionalString(value, field, 50);
}

function parseRequiredString(value: unknown, field: string, maxLength: number) {
  const parsed = parseOptionalString(value, field, maxLength);
  if (!parsed) {
    throw badRequest(`${field} is required.`);
  }
  return parsed;
}

function parseNullableString(value: unknown, field: string, maxLength: number) {
  if (value === undefined || value === null) return null;
  return parseOptionalString(value, field, maxLength) ?? null;
}

function parseOptionalString(value: unknown, field: string, maxLength: number) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw badRequest(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) {
    throw badRequest(`${field} must be ${maxLength} characters or fewer.`);
  }
  return trimmed;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw badRequest("Pagination values must be positive integers.");
  }
  return parsed;
}
