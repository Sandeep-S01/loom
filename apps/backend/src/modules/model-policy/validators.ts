import { badRequest } from "../../lib/http-errors.js";
import type {
  DeleteModelPolicyInput,
  ModelPolicyListFilters,
  ModelPolicyPatch,
  UpsertModelPolicyInput,
} from "./domain.js";

const MAX_PAGE_SIZE = 100;
const MAX_PRIORITY_RANK = 100_000;
const MAX_LIMIT = 1_000_000_000;

export function parseModelPolicyListQuery(
  query: Record<string, unknown>,
): ModelPolicyListFilters {
  return {
    registryModelId: optionalTrimmedString(query.registryModelId, 50),
    enabled: parseOptionalBoolean(optionalString(query.enabled), "enabled"),
    visibleInSelector: parseOptionalBoolean(
      optionalString(query.visibleInSelector),
      "visibleInSelector",
    ),
    defaultsOnly: parseBoolean(optionalString(query.defaultsOnly), false),
    page: parsePositiveInt(optionalString(query.page), 1),
    pageSize: Math.min(parsePositiveInt(optionalString(query.pageSize), 25), MAX_PAGE_SIZE),
    sort: parseSort(optionalString(query.sort)),
    direction: parseDirection(optionalString(query.direction)),
  };
}

export function parseUpsertModelPolicyBody(
  registryModelId: string,
  body: unknown,
  actorUserId: string,
): UpsertModelPolicyInput {
  const input = parseBodyObject(body);
  const patch: ModelPolicyPatch = {};

  assignOptionalBoolean(patch, input, "enabled");
  assignOptionalBoolean(patch, input, "visibleInSelector");
  assignOptionalBoolean(patch, input, "defaultForChat");
  assignOptionalBoolean(patch, input, "defaultForAgent");
  assignOptionalBoolean(patch, input, "requiresCompanion");
  assignOptionalInteger(patch, input, "priorityRank", 0, MAX_PRIORITY_RANK);
  assignOptionalNullableInteger(
    patch,
    input,
    "requestsPerMinuteLimit",
    1,
    MAX_LIMIT,
  );
  assignOptionalNullableInteger(patch, input, "tokensPerDayLimit", 1, MAX_LIMIT);
  assignOptionalNullableInteger(
    patch,
    input,
    "tokensPerRequestLimit",
    1,
    MAX_LIMIT,
  );
  assignOptionalNullableString(patch, input, "notes", 1_000);

  if (Object.keys(patch).length === 0) {
    throw badRequest("At least one policy field is required.");
  }

  return {
    registryModelId,
    patch,
    actorUserId,
  };
}

export function parseDeleteModelPolicyInput(
  registryModelId: string,
  actorUserId: string,
): DeleteModelPolicyInput {
  return {
    registryModelId,
    actorUserId,
  };
}

export function assertRegistryModelId(value: string | undefined) {
  return requiredString(value, "registryModelId", 50);
}

function parseBodyObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("Request body must be an object.");
  }
  return value as Record<string, unknown>;
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function requiredString(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string") {
    throw badRequest(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw badRequest(`${field} must be between 1 and ${maxLength} characters.`);
  }
  return trimmed;
}

function optionalTrimmedString(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredString(value, "filter", maxLength);
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw badRequest("Boolean query values must be true or false.");
}

function parseOptionalBoolean(value: string | undefined, field: string) {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw badRequest(`${field} must be a boolean.`);
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function parseSort(value: string | undefined): ModelPolicyListFilters["sort"] {
  if (!value) return "priorityRank";
  if (value === "priorityRank" || value === "updatedAt" || value === "createdAt") {
    return value;
  }
  throw badRequest("Invalid model policy sort field.");
}

function parseDirection(value: string | undefined): ModelPolicyListFilters["direction"] {
  if (!value) return "asc";
  if (value === "asc" || value === "desc") return value;
  throw badRequest("Invalid sort direction.");
}

function assignOptionalBoolean(
  patch: ModelPolicyPatch,
  input: Record<string, unknown>,
  field: keyof ModelPolicyPatch,
) {
  if (!(field in input)) return;
  if (typeof input[field] !== "boolean") {
    throw badRequest(`${String(field)} must be a boolean.`);
  }
  patch[field] = input[field] as never;
}

function assignOptionalInteger(
  patch: ModelPolicyPatch,
  input: Record<string, unknown>,
  field: keyof ModelPolicyPatch,
  min: number,
  max: number,
) {
  if (!(field in input)) return;
  const value = input[field];
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw badRequest(`${String(field)} must be an integer between ${min} and ${max}.`);
  }
  patch[field] = value as never;
}

function assignOptionalNullableInteger(
  patch: ModelPolicyPatch,
  input: Record<string, unknown>,
  field: keyof ModelPolicyPatch,
  min: number,
  max: number,
) {
  if (!(field in input)) return;
  const value = input[field];
  if (value === null) {
    patch[field] = null as never;
    return;
  }
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw badRequest(`${String(field)} must be an integer between ${min} and ${max}.`);
  }
  patch[field] = value as never;
}

function assignOptionalNullableString(
  patch: ModelPolicyPatch,
  input: Record<string, unknown>,
  field: keyof ModelPolicyPatch,
  maxLength: number,
) {
  if (!(field in input)) return;
  const value = input[field];
  if (value === null || value === "") {
    patch[field] = null as never;
    return;
  }
  patch[field] = requiredString(value, String(field), maxLength) as never;
}
