import { badRequest } from "../../lib/http-errors.js";
import {
  PROVIDER_HEALTH_STATUSES,
  type ProviderHealthListFilters,
  type ProviderHealthPatch,
  type ProviderHealthStatus,
  type ResetProviderHealthInput,
  type UpsertProviderHealthInput,
} from "./domain.js";

const MAX_PAGE_SIZE = 100;
const MAX_FAILURES = 1_000_000;

export function parseProviderHealthListQuery(
  query: Record<string, unknown>,
): ProviderHealthListFilters {
  return {
    providerId: optionalTrimmedString(query.providerId, 50),
    status: parseOptionalStatus(optionalString(query.status)),
    page: parsePositiveInt(optionalString(query.page), 1),
    pageSize: Math.min(parsePositiveInt(optionalString(query.pageSize), 25), MAX_PAGE_SIZE),
    sort: parseSort(optionalString(query.sort)),
    direction: parseDirection(optionalString(query.direction)),
  };
}

export function parseUpsertProviderHealthBody(
  providerId: string,
  body: unknown,
  actorUserId: string | null,
): UpsertProviderHealthInput {
  const input = parseBodyObject(body);
  const patch: ProviderHealthPatch = {};

  if ("status" in input) patch.status = parseStatus(input.status);
  assignOptionalNullableDate(patch, input, "cooldownUntil");
  assignOptionalInteger(patch, input, "consecutiveFailures", 0, MAX_FAILURES);
  assignOptionalNullableString(patch, input, "lastFailureCode", 80);
  assignOptionalNullableDate(patch, input, "lastFailureAt");
  assignOptionalNullableDate(patch, input, "lastSuccessAt");
  assignOptionalNullableDate(patch, input, "lastCheckedAt");
  assignOptionalNullableString(patch, input, "reason", 1_000);

  if (Object.keys(patch).length === 0) {
    throw badRequest("At least one provider health field is required.");
  }

  return { providerId, patch, actorUserId };
}

export function parseResetProviderHealthInput(
  providerId: string,
  actorUserId: string | null,
): ResetProviderHealthInput {
  return { providerId, actorUserId };
}

export function assertProviderId(value: string | undefined) {
  return requiredString(value, "providerId", 50);
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

function parseStatus(value: unknown): ProviderHealthStatus {
  if (
    typeof value === "string" &&
    (PROVIDER_HEALTH_STATUSES as readonly string[]).includes(value)
  ) {
    return value as ProviderHealthStatus;
  }
  throw badRequest("Invalid provider health status.");
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function parseSort(value: string | undefined): ProviderHealthListFilters["sort"] {
  if (!value) return "updatedAt";
  if (
    value === "updatedAt" ||
    value === "lastCheckedAt" ||
    value === "consecutiveFailures"
  ) {
    return value;
  }
  throw badRequest("Invalid provider health sort field.");
}

function parseDirection(value: string | undefined): ProviderHealthListFilters["direction"] {
  if (!value) return "desc";
  if (value === "asc" || value === "desc") return value;
  throw badRequest("Invalid sort direction.");
}

function assignOptionalInteger(
  patch: ProviderHealthPatch,
  input: Record<string, unknown>,
  field: keyof ProviderHealthPatch,
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
  patch: ProviderHealthPatch,
  input: Record<string, unknown>,
  field: keyof ProviderHealthPatch,
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
  patch: ProviderHealthPatch,
  input: Record<string, unknown>,
  field: keyof ProviderHealthPatch,
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
