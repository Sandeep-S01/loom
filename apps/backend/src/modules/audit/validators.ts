import { badRequest } from "../../lib/http-errors.js";
import type {
  AuditEventDirection,
  AuditEventListFilters,
  AuditEventSort,
  RecordAuditEventInput,
} from "./domain.js";

const MAX_PAGE_SIZE = 100;

export function parseRecordAuditEventBody(body: unknown): RecordAuditEventInput {
  const input = parseBodyObject(body);
  return {
    userId: requiredString(input.userId, "userId", 50),
    deviceId: nullableString(input.deviceId, "deviceId", 50),
    eventType: requiredString(input.eventType, "eventType", 50),
    subjectType: requiredString(input.subjectType, "subjectType", 50),
    subjectId: requiredString(input.subjectId, "subjectId", 50),
    payload: parsePayload(input.payload),
    createdAt: optionalDate(input.createdAt, "createdAt"),
  };
}

export function parseAuditEventListQuery(
  query: Record<string, unknown>,
): AuditEventListFilters {
  const filters = {
    userId: optionalTrimmedString(query.userId, 50),
    deviceId: optionalTrimmedString(query.deviceId, 50),
    eventType: optionalTrimmedString(query.eventType, 50),
    subjectType: optionalTrimmedString(query.subjectType, 50),
    subjectId: optionalTrimmedString(query.subjectId, 50),
    search: optionalTrimmedString(query.search, 100),
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

export function assertAuditEventId(value: string | undefined) {
  return requiredString(value, "id", 50);
}

function parseBodyObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("Request body must be an object.");
  }
  return value as Record<string, unknown>;
}

function parsePayload(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("payload must be an object when provided.");
  }
  return value as Record<string, unknown>;
}

function parseSort(value: string | undefined): AuditEventSort {
  if (!value || value === "createdAt") return "createdAt";
  throw badRequest("Invalid audit event sort field.");
}

function parseDirection(value: string | undefined): AuditEventDirection {
  if (!value || value === "desc") return "desc";
  if (value === "asc") return "asc";
  throw badRequest("direction must be asc or desc.");
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
