import { badRequest } from "../../lib/http-errors.js";
import {
  MODEL_RUNTIME_HEALTH_STATUSES,
  type ModelRuntimeHealthListFilters,
  type ModelRuntimeHealthPatch,
  type ModelRuntimeHealthStatus,
  type ResetModelRuntimeHealthInput,
  type UpsertModelRuntimeHealthInput,
} from "./domain.js";

const MAX_PAGE_SIZE = 100;
const MAX_FAILURES = 1_000_000;

export function parseModelRuntimeHealthListQuery(
  query: Record<string, unknown>,
): ModelRuntimeHealthListFilters {
  return {
    registryModelId: optionalTrimmedString(query.registryModelId, 50),
    status: parseOptionalStatus(optionalString(query.status)),
    page: parsePositiveInt(optionalString(query.page), 1),
    pageSize: Math.min(parsePositiveInt(optionalString(query.pageSize), 25), MAX_PAGE_SIZE),
    sort: parseSort(optionalString(query.sort)),
    direction: parseDirection(optionalString(query.direction)),
  };
}

export function parseUpsertModelRuntimeHealthBody(
  registryModelId: string,
  body: unknown,
  actorUserId: string | null,
): UpsertModelRuntimeHealthInput {
  const input = parseBodyObject(body);
  const patch: ModelRuntimeHealthPatch = {};

  if ("status" in input) patch.status = parseStatus(input.status);
  assignOptionalNullableDate(patch, input, "cooldownUntil");
  assignOptionalInteger(patch, input, "consecutiveFailures", 0, MAX_FAILURES);
  assignOptionalNullableString(patch, input, "lastFailureCode", 80);
  assignOptionalNullableDate(patch, input, "lastFailureAt");
  assignOptionalNullableDate(patch, input, "lastSuccessAt");
  assignOptionalNullableDate(patch, input, "lastCheckedAt");
  assignOptionalNullableString(patch, input, "reason", 1_000);

  if (Object.keys(patch).length === 0) {
    throw badRequest("At least one runtime health field is required.");
  }

  return {
    registryModelId,
    patch,
    actorUserId,
  };
}

export function parseResetModelRuntimeHealthInput(
  registryModelId: string,
  actorUserId: string | null,
): ResetModelRuntimeHealthInput {
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

function parseOptionalStatus(value: string | undefined) {
  if (!value) return undefined;
  return parseStatus(value);
}

function parseStatus(value: unknown): ModelRuntimeHealthStatus {
  if (
    typeof value === "string" &&
    (MODEL_RUNTIME_HEALTH_STATUSES as readonly string[]).includes(value)
  ) {
    return value as ModelRuntimeHealthStatus;
  }
  throw badRequest("Invalid runtime health status.");
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function parseSort(value: string | undefined): ModelRuntimeHealthListFilters["sort"] {
  if (!value) return "updatedAt";
  if (
    value === "updatedAt" ||
    value === "lastCheckedAt" ||
    value === "consecutiveFailures"
  ) {
    return value;
  }
  throw badRequest("Invalid runtime health sort field.");
}

function parseDirection(
  value: string | undefined,
): ModelRuntimeHealthListFilters["direction"] {
  if (!value) return "desc";
  if (value === "asc" || value === "desc") return value;
  throw badRequest("Invalid sort direction.");
}

function assignOptionalInteger(
  patch: ModelRuntimeHealthPatch,
  input: Record<string, unknown>,
  field: keyof ModelRuntimeHealthPatch,
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

function assignOptionalNullableString(
  patch: ModelRuntimeHealthPatch,
  input: Record<string, unknown>,
  field: keyof ModelRuntimeHealthPatch,
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

function assignOptionalNullableDate(
  patch: ModelRuntimeHealthPatch,
  input: Record<string, unknown>,
  field: keyof ModelRuntimeHealthPatch,
) {
  if (!(field in input)) return;
  const value = input[field];
  if (value === null || value === "") {
    patch[field] = null as never;
    return;
  }
  if (typeof value !== "string") {
    throw badRequest(`${String(field)} must be an ISO timestamp or null.`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(`${String(field)} must be an ISO timestamp or null.`);
  }
  patch[field] = parsed as never;
}
