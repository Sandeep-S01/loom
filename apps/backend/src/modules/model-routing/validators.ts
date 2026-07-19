import { badRequest } from "../../lib/http-errors.js";
import type {
  RoutingAttemptDirection,
  RoutingAttemptListFilters,
  RoutingAttemptSort,
  RoutingAttemptStatus,
  RoutingMode,
  SelectModelRouteInput,
} from "./domain.js";

const MAX_TOKEN_ESTIMATE = 10_000_000;

export function parseSelectModelRouteBody(
  body: unknown,
  userId: string,
): SelectModelRouteInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw badRequest("Routing request body must be an object.");
  }
  const input = body as Record<string, unknown>;
  return {
    mode: parseMode(input.mode),
    userId,
    conversationId: parseNullableId(input.conversationId, "conversationId"),
    agentRunId: parseNullableId(input.agentRunId, "agentRunId"),
    companionAvailable: parseBoolean(input.companionAvailable, false),
    estimatedInputTokens: parseOptionalTokenEstimate(
      input.estimatedInputTokens,
      "estimatedInputTokens",
    ),
    requestedOutputTokens: parseOptionalTokenEstimate(
      input.requestedOutputTokens,
      "requestedOutputTokens",
    ),
    requestId: parseOptionalString(input.requestId, "requestId", 120),
  };
}

export function parseRoutingAttemptListQuery(
  query: Record<string, unknown>,
): RoutingAttemptListFilters {
  return {
    userId: optionalString(query.userId),
    conversationId: optionalString(query.conversationId),
    agentRunId: optionalString(query.agentRunId),
    registryModelId: optionalString(query.registryModelId),
    status: parseStatus(optionalString(query.status)),
    mode: parseOptionalMode(optionalString(query.mode)),
    page: parsePositiveInt(optionalString(query.page), 1),
    pageSize: Math.min(parsePositiveInt(optionalString(query.pageSize), 50), 100),
    sort: parseSort(optionalString(query.sort)),
    direction: parseDirection(optionalString(query.direction)),
  };
}

function parseMode(value: unknown): RoutingMode {
  if (!value || value === "chat") return "chat";
  if (value === "agent") return "agent";
  throw badRequest("mode must be chat or agent.");
}

function parseOptionalMode(value: string | undefined): RoutingMode | undefined {
  if (!value) return undefined;
  return parseMode(value);
}

function parseStatus(value: string | undefined): RoutingAttemptStatus | undefined {
  if (!value) return undefined;
  if (value === "selected" || value === "no_eligible_models") return value;
  throw badRequest("status must be selected or no_eligible_models.");
}

function parseSort(value: string | undefined): RoutingAttemptSort {
  if (!value || value === "createdAt") return "createdAt";
  throw badRequest("Invalid routing attempt sort field.");
}

function parseDirection(value: string | undefined): RoutingAttemptDirection {
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

function parseNullableId(value: unknown, field: string) {
  if (value === undefined || value === null) return null;
  return parseOptionalString(value, field, 50);
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
