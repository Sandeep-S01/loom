import { badRequest } from "../../lib/http-errors.js";
import {
  MODEL_CATALOG_COST_TIERS,
  MODEL_CATALOG_RELEASE_STAGES,
  type ModelCapabilities,
  type ModelCatalogCostTier,
  type ModelCatalogListFilters,
  type ModelCatalogReleaseStage,
  type UpsertDiscoveredModelInput,
} from "./domain.js";

const MAX_PAGE_SIZE = 100;
const MAX_METADATA_BYTES = 30_000;

export function parseModelCatalogListQuery(
  query: Record<string, unknown>,
): ModelCatalogListFilters {
  const discoveredAfter = parseOptionalDate(optionalString(query.discoveredAfter), "discoveredAfter");
  const discoveredBefore = parseOptionalDate(optionalString(query.discoveredBefore), "discoveredBefore");

  if (
    discoveredAfter &&
    discoveredBefore &&
    discoveredAfter.getTime() > discoveredBefore.getTime()
  ) {
    throw badRequest("discoveredAfter must not be after discoveredBefore.");
  }

  return {
    providerId: optionalTrimmedString(query.providerId, 50),
    search: optionalTrimmedString(query.search, 120),
    capability: parseCapability(optionalString(query.capability)),
    costTier: parseCostTier(optionalString(query.costTier), true),
    releaseStage: parseReleaseStage(optionalString(query.releaseStage), true),
    deprecated: parseOptionalBoolean(optionalString(query.deprecated), "deprecated"),
    discoveredAfter,
    discoveredBefore,
    page: parsePositiveInt(optionalString(query.page), 1),
    pageSize: Math.min(parsePositiveInt(optionalString(query.pageSize), 25), MAX_PAGE_SIZE),
    sort: parseSort(optionalString(query.sort)),
    direction: parseDirection(optionalString(query.direction)),
  };
}

export function assertCatalogModelId(value: string | undefined) {
  if (!value?.trim()) {
    throw badRequest("Catalog model id is required.");
  }
  return value.trim();
}

export function validateDiscoveredModelInput(
  input: UpsertDiscoveredModelInput,
): UpsertDiscoveredModelInput {
  const providerId = requiredString(input.providerId, "providerId", 50);
  const externalModelKey = requiredString(input.externalModelKey, "externalModelKey", 255);
  const displayName = requiredString(input.displayName, "displayName", 255);
  const capabilities = validateCapabilities(input.capabilities);
  const costTier = parseCostTier(input.costTier, false);

  if (costTier !== "free") {
    throw badRequest("Only free catalog models are supported in this release.");
  }

  return {
    providerId,
    externalModelKey,
    displayName,
    description: optionalNullableString(input.description, "description", 2_000),
    capabilities,
    contextWindow: optionalPositiveInteger(input.contextWindow, "contextWindow"),
    maxOutputTokens: optionalPositiveInteger(input.maxOutputTokens, "maxOutputTokens"),
    costTier,
    pricing: validatePricing(input.pricing),
    releaseStage: parseReleaseStage(input.releaseStage, false),
    releasedAt: parseNullableInputDate(input.releasedAt, "releasedAt"),
    deprecatedAt: parseNullableInputDate(input.deprecatedAt, "deprecatedAt"),
    deprecationReason: optionalNullableString(
      input.deprecationReason,
      "deprecationReason",
      1_000,
    ),
    providerMetadata: validateJsonPayload(input.providerMetadata ?? {}),
    discoveredAt: input.discoveredAt ?? new Date(),
  };
}

export function optionalString(value: unknown) {
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

function optionalTrimmedString(
  value: unknown,
  maxLength: number,
) {
  if (value === undefined || value === null || value === "") return undefined;
  const trimmed = requiredString(value, "filter", maxLength);
  return trimmed;
}

function optionalNullableString(
  value: unknown,
  field: string,
  maxLength: number,
) {
  if (value === undefined || value === null || value === "") return null;
  return requiredString(value, field, maxLength);
}

function validateCapabilities(value: unknown): ModelCapabilities {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("capabilities must be an object.");
  }
  const input = value as Partial<Record<keyof ModelCapabilities, unknown>>;
  return {
    chat: requiredBoolean(input.chat, "capabilities.chat"),
    agent: requiredBoolean(input.agent, "capabilities.agent"),
    vision: requiredBoolean(input.vision, "capabilities.vision"),
    toolUse: requiredBoolean(input.toolUse, "capabilities.toolUse"),
    jsonMode: requiredBoolean(input.jsonMode, "capabilities.jsonMode"),
  };
}

function validatePricing(value: unknown) {
  if (value === undefined || value === null) {
    return {
      inputPer1mUsdMicros: null,
      outputPer1mUsdMicros: null,
      currency: "USD" as const,
      raw: null,
    };
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("pricing must be an object or null.");
  }

  const pricing = value as Record<string, unknown>;
  return {
    inputPer1mUsdMicros: optionalNonNegativeInteger(
      pricing.inputPer1mUsdMicros,
      "pricing.inputPer1mUsdMicros",
    ),
    outputPer1mUsdMicros: optionalNonNegativeInteger(
      pricing.outputPer1mUsdMicros,
      "pricing.outputPer1mUsdMicros",
    ),
    currency: "USD" as const,
    raw: validateJsonPayload(pricing.raw ?? null),
  };
}

function validateJsonPayload(value: unknown) {
  try {
    const serialized = JSON.stringify(value);
    if (serialized && serialized.length > MAX_METADATA_BYTES) {
      throw badRequest("Catalog metadata is too large.");
    }
    return value;
  } catch (error) {
    if (error instanceof Error && error.message === "Catalog metadata is too large.") {
      throw error;
    }
    throw badRequest("Catalog metadata must be valid JSON.");
  }
}

function requiredBoolean(value: unknown, field: string) {
  if (typeof value !== "boolean") {
    throw badRequest(`${field} must be a boolean.`);
  }
  return value;
}

function optionalPositiveInteger(value: unknown, field: string) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw badRequest(`${field} must be a positive integer or null.`);
  }
  return value as number;
}

function optionalNonNegativeInteger(value: unknown, field: string) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw badRequest(`${field} must be a non-negative integer or null.`);
  }
  return value as number;
}

function parseCostTier(value: string | undefined, optional: true): ModelCatalogCostTier | undefined;
function parseCostTier(value: string | undefined, optional: false): ModelCatalogCostTier;
function parseCostTier(value: string | undefined, optional: boolean) {
  if (!value) {
    if (optional) return undefined;
    throw badRequest("costTier is required.");
  }
  if ((MODEL_CATALOG_COST_TIERS as readonly string[]).includes(value)) {
    return value as ModelCatalogCostTier;
  }
  throw badRequest("Invalid costTier.");
}

function parseReleaseStage(
  value: string | undefined,
  optional: true,
): ModelCatalogReleaseStage | undefined;
function parseReleaseStage(
  value: string | undefined,
  optional: false,
): ModelCatalogReleaseStage;
function parseReleaseStage(value: string | undefined, optional: boolean) {
  if (!value) {
    if (optional) return undefined;
    return "stable";
  }
  if ((MODEL_CATALOG_RELEASE_STAGES as readonly string[]).includes(value)) {
    return value as ModelCatalogReleaseStage;
  }
  throw badRequest("Invalid releaseStage.");
}

function parseCapability(value: string | undefined): keyof ModelCapabilities | undefined {
  if (!value) return undefined;
  if (
    value === "chat" ||
    value === "agent" ||
    value === "vision" ||
    value === "toolUse" ||
    value === "jsonMode"
  ) {
    return value;
  }
  throw badRequest("Invalid capability filter.");
}

function parseOptionalBoolean(value: string | undefined, field: string) {
  if (!value) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw badRequest(`${field} must be true or false.`);
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function parseSort(value: string | undefined): ModelCatalogListFilters["sort"] {
  if (!value) return "lastDiscoveredAt";
  if (
    value === "displayName" ||
    value === "providerId" ||
    value === "contextWindow" ||
    value === "lastDiscoveredAt" ||
    value === "updatedAt"
  ) {
    return value;
  }
  throw badRequest("Invalid catalog sort field.");
}

function parseDirection(value: string | undefined): ModelCatalogListFilters["direction"] {
  if (!value) return "desc";
  if (value === "asc" || value === "desc") return value;
  throw badRequest("Invalid sort direction.");
}

function parseOptionalDate(value: string | undefined, field: string) {
  if (!value) return undefined;
  return parseDate(value, field);
}

function parseNullableInputDate(value: Date | string | null | undefined, field: string) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return assertValidDate(value, field);
  return parseDate(value, field);
}

function parseDate(value: string, field: string) {
  const parsed = new Date(value);
  return assertValidDate(parsed, field);
}

function assertValidDate(value: Date, field: string) {
  if (Number.isNaN(value.getTime())) {
    throw badRequest(`Invalid ${field} timestamp.`);
  }
  return value;
}
