import { badRequest } from "../../lib/http-errors.js";
import {
  PROVIDER_STATUSES,
  type CheckProviderCredentialInput,
  type ProviderListFilters,
  type ProviderStatus,
  type UpdateProviderInput,
} from "./domain.js";

const MAX_PAGE_SIZE = 100;
const SECRET_REF_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

export function parseProviderListQuery(query: Record<string, unknown>): ProviderListFilters {
  const status = parseProviderStatus(optionalString(query.status), "status", true);
  const supportsDiscovery = parseOptionalBoolean(optionalString(query.supportsDiscovery));
  const search = optionalString(query.search)?.trim();
  const page = parsePositiveInt(optionalString(query.page), 1);
  const pageSize = Math.min(parsePositiveInt(optionalString(query.pageSize), 25), MAX_PAGE_SIZE);
  const sort = parseSort(optionalString(query.sort));
  const direction = parseDirection(optionalString(query.direction));

  return {
    status,
    supportsDiscovery,
    search: search ? search : undefined,
    page,
    pageSize,
    sort,
    direction,
  };
}

export function parseUpdateProviderBody(body: unknown): UpdateProviderInput {
  if (!isObject(body)) {
    throw badRequest("Request body must be an object.");
  }

  const input: UpdateProviderInput = {};

  if ("name" in body) {
    const name = optionalString(body.name)?.trim();
    if (!name || name.length > 100) {
      throw badRequest("Provider name must be between 1 and 100 characters.");
    }
    input.name = name;
  }

  if ("status" in body) {
    input.status = parseProviderStatus(optionalString(body.status), "status", false);
  }

  if ("priorityRank" in body) {
    const value = Number(body.priorityRank);
    if (!Number.isInteger(value) || value < 0 || value > 10_000) {
      throw badRequest("Priority rank must be an integer between 0 and 10000.");
    }
    input.priorityRank = value;
  }

  if ("defaultSecretRef" in body) {
    if (body.defaultSecretRef === null) {
      input.defaultSecretRef = null;
    } else {
      const secretRef = optionalString(body.defaultSecretRef)?.trim();
      if (!secretRef || !SECRET_REF_PATTERN.test(secretRef)) {
        throw badRequest("Default secret reference must be an uppercase environment variable name.");
      }
      input.defaultSecretRef = secretRef;
    }
  }

  if ("metadataJson" in body) {
    assertMetadataJson(body.metadataJson);
    input.metadataJson = body.metadataJson ?? null;
  }

  if (Object.keys(input).length === 0) {
    throw badRequest("At least one provider field must be updated.");
  }

  return input;
}

export function parseCredentialCheckBody(body: unknown): CheckProviderCredentialInput {
  if (!isObject(body)) {
    throw badRequest("Request body must be an object.");
  }

  const providerId = optionalString(body.providerId)?.trim();
  const credentialId = optionalString(body.credentialId)?.trim();

  if (!providerId && !credentialId) {
    throw badRequest("providerId or credentialId is required.");
  }

  if (providerId && credentialId) {
    throw badRequest("Provide either providerId or credentialId, not both.");
  }

  return { providerId, credentialId };
}

export function assertProviderId(value: string | undefined) {
  if (!value || value.trim().length === 0) {
    throw badRequest("Provider id is required.");
  }
  return value.trim();
}

export function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function parseProviderStatus(
  value: string | undefined,
  fieldName: string,
  optional: true,
): ProviderStatus | undefined;
function parseProviderStatus(
  value: string | undefined,
  fieldName: string,
  optional: false,
): ProviderStatus;
function parseProviderStatus(
  value: string | undefined,
  fieldName: string,
  optional: boolean,
) {
  if (!value) {
    if (optional) return undefined;
    throw badRequest(`${fieldName} is required.`);
  }

  if ((PROVIDER_STATUSES as readonly string[]).includes(value)) {
    return value as ProviderStatus;
  }

  throw badRequest(`Invalid ${fieldName}.`);
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function parseOptionalBoolean(value: string | undefined) {
  if (!value) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw badRequest("supportsDiscovery must be true or false.");
}

function parseSort(value: string | undefined): ProviderListFilters["sort"] {
  if (!value) return "priorityRank";
  if (value === "name" || value === "priorityRank" || value === "updatedAt") return value;
  throw badRequest("Invalid provider sort field.");
}

function parseDirection(value: string | undefined): ProviderListFilters["direction"] {
  if (!value) return "asc";
  if (value === "asc" || value === "desc") return value;
  throw badRequest("Invalid sort direction.");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertMetadataJson(value: unknown) {
  if (value === null || value === undefined) return;
  if (!isObject(value)) {
    throw badRequest("Provider metadata must be an object or null.");
  }

  try {
    const serialized = JSON.stringify(value);
    if (!serialized || serialized.length > 10_000) {
      throw badRequest("Provider metadata must be 10000 characters or fewer.");
    }
  } catch {
    throw badRequest("Provider metadata must be valid JSON.");
  }
}
