import { badRequest } from "../../lib/http-errors.js";
import {
  DISCOVERY_JOB_STATUSES,
  DISCOVERY_TRIGGER_TYPES,
  PROVIDER_SYNC_STATUSES,
  type DiscoveryJobListFilters,
  type DiscoveryJobStatus,
  type DiscoveryTriggerType,
  type ProviderSyncStatus,
  type ProviderSyncStatusListFilters,
  type RunDiscoveryInput,
} from "./domain.js";

const MAX_PAGE_SIZE = 100;

export function parseDiscoveryJobListQuery(
  query: Record<string, unknown>,
): DiscoveryJobListFilters {
  return {
    providerId: optionalTrimmedString(query.providerId, 50),
    status: parseOptionalJobStatus(optionalString(query.status)),
    page: parsePositiveInt(optionalString(query.page), 1),
    pageSize: Math.min(parsePositiveInt(optionalString(query.pageSize), 25), MAX_PAGE_SIZE),
    sort: parseJobSort(optionalString(query.sort)),
    direction: parseDirection(optionalString(query.direction), "desc"),
  };
}

export function parseProviderSyncStatusListQuery(
  query: Record<string, unknown>,
): ProviderSyncStatusListFilters {
  return {
    providerId: optionalTrimmedString(query.providerId, 50),
    status: parseOptionalSyncStatus(optionalString(query.status)),
    page: parsePositiveInt(optionalString(query.page), 1),
    pageSize: Math.min(parsePositiveInt(optionalString(query.pageSize), 25), MAX_PAGE_SIZE),
    sort: parseSyncSort(optionalString(query.sort)),
    direction: parseDirection(optionalString(query.direction), "desc"),
  };
}

export function parseRunDiscoveryBody(
  body: unknown,
  actorUserId: string | null,
): RunDiscoveryInput {
  const input = parseBodyObject(body);
  return {
    providerId: requiredString(input.providerId, "providerId", 50),
    triggerType: parseTriggerType(optionalString(input.triggerType)),
    actorUserId,
  };
}

export function assertDiscoveryJobId(value: string | undefined) {
  return requiredString(value, "jobId", 50);
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

function parseTriggerType(value: string | undefined): DiscoveryTriggerType {
  if (!value) return "manual";
  if ((DISCOVERY_TRIGGER_TYPES as readonly string[]).includes(value)) {
    return value as DiscoveryTriggerType;
  }
  throw badRequest("Invalid discovery trigger type.");
}

function parseOptionalJobStatus(value: string | undefined) {
  if (!value) return undefined;
  if ((DISCOVERY_JOB_STATUSES as readonly string[]).includes(value)) {
    return value as DiscoveryJobStatus;
  }
  throw badRequest("Invalid discovery job status.");
}

function parseOptionalSyncStatus(value: string | undefined) {
  if (!value) return undefined;
  if ((PROVIDER_SYNC_STATUSES as readonly string[]).includes(value)) {
    return value as ProviderSyncStatus;
  }
  throw badRequest("Invalid provider sync status.");
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function parseJobSort(value: string | undefined): DiscoveryJobListFilters["sort"] {
  if (!value) return "startedAt";
  if (value === "startedAt" || value === "completedAt" || value === "updatedAt") {
    return value;
  }
  throw badRequest("Invalid discovery job sort field.");
}

function parseSyncSort(value: string | undefined): ProviderSyncStatusListFilters["sort"] {
  if (!value) return "updatedAt";
  if (value === "updatedAt" || value === "lastStartedAt" || value === "lastSuccessAt") {
    return value;
  }
  throw badRequest("Invalid provider sync status sort field.");
}

function parseDirection(
  value: string | undefined,
  fallback: "asc" | "desc",
): "asc" | "desc" {
  if (!value) return fallback;
  if (value === "asc" || value === "desc") return value;
  throw badRequest("Invalid sort direction.");
}
