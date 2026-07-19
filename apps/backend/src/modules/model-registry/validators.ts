import { badRequest } from "../../lib/http-errors.js";
import {
  MODEL_REGISTRY_STATUSES,
  type ArchiveRegistryModelInput,
  type ModelRegistryListFilters,
  type ModelRegistryStatus,
  type RegisterCatalogModelInput,
} from "./domain.js";

const MAX_PAGE_SIZE = 100;

export function parseModelRegistryListQuery(
  query: Record<string, unknown>,
): ModelRegistryListFilters {
  return {
    providerId: optionalTrimmedString(query.providerId, 50),
    search: optionalTrimmedString(query.search, 120),
    status: parseRegistryStatus(optionalString(query.status), true),
    includeArchived: parseBoolean(optionalString(query.includeArchived), false),
    page: parsePositiveInt(optionalString(query.page), 1),
    pageSize: Math.min(parsePositiveInt(optionalString(query.pageSize), 25), MAX_PAGE_SIZE),
    sort: parseSort(optionalString(query.sort)),
    direction: parseDirection(optionalString(query.direction)),
  };
}

export function parseRegisterCatalogModelBody(
  body: unknown,
  actorUserId: string,
): RegisterCatalogModelInput {
  const input = parseBodyObject(body);
  return {
    catalogModelId: requiredString(input.catalogModelId, "catalogModelId", 50),
    notes: optionalNullableString(input.notes, "notes", 1_000),
    actorUserId,
  };
}

export function parseArchiveRegistryModelBody(
  registryModelId: string,
  body: unknown,
  actorUserId: string,
): ArchiveRegistryModelInput {
  const input = body === undefined ? {} : parseBodyObject(body);
  return {
    registryModelId,
    actorUserId,
    archiveReason: optionalNullableString(input.archiveReason, "archiveReason", 1_000),
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

function optionalNullableString(value: unknown, field: string, maxLength: number) {
  if (value === undefined || value === null || value === "") return null;
  return requiredString(value, field, maxLength);
}

function parseRegistryStatus(
  value: string | undefined,
  optional: true,
): ModelRegistryStatus | undefined;
function parseRegistryStatus(value: string | undefined, optional: false): ModelRegistryStatus;
function parseRegistryStatus(value: string | undefined, optional: boolean) {
  if (!value) {
    if (optional) return undefined;
    throw badRequest("status is required.");
  }
  if ((MODEL_REGISTRY_STATUSES as readonly string[]).includes(value)) {
    return value as ModelRegistryStatus;
  }
  throw badRequest("Invalid registry status.");
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw badRequest("Boolean query values must be true or false.");
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function parseSort(value: string | undefined): ModelRegistryListFilters["sort"] {
  if (!value) return "approvedAt";
  if (
    value === "approvedAt" ||
    value === "updatedAt" ||
    value === "displayName" ||
    value === "providerId"
  ) {
    return value;
  }
  throw badRequest("Invalid registry sort field.");
}

function parseDirection(value: string | undefined): ModelRegistryListFilters["direction"] {
  if (!value) return "desc";
  if (value === "asc" || value === "desc") return value;
  throw badRequest("Invalid sort direction.");
}
