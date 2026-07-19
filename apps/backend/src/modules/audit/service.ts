import { badRequest, notFound } from "../../lib/http-errors.js";
import type {
  AuditEventDTO,
  AuditEventRecord,
  AuditPayload,
  RecordAuditEventInput,
} from "./domain.js";
import type { AuditEventRepository, AuditLogger, AuditService } from "./interfaces.js";

interface CreateAuditServiceOptions {
  repository: AuditEventRepository;
  logger?: AuditLogger;
}

const SECRET_KEY_PATTERN = /(api[_-]?key|authorization|credential|password|secret|token)/i;

const noopLogger: AuditLogger = {
  info() {},
  warn() {},
  error() {},
};

export function createAuditService(options: CreateAuditServiceOptions): AuditService {
  const logger = options.logger ?? noopLogger;

  return {
    async recordEvent(input) {
      validateRecordAuditEventInput(input);
      const event = await options.repository.create(input);
      logger.info(
        {
          event: "audit.recorded",
          auditEventId: event.id,
          eventType: event.eventType,
          subjectType: event.subjectType,
          subjectId: event.subjectId,
          userId: event.userId,
        },
        "Audit event recorded",
      );
      return event;
    },

    async getEvent(id) {
      const eventId = requireIdentifier(id, "id");
      const event = await options.repository.findById(eventId);
      if (!event) throw notFound("Audit event not found.");
      return { event: mapAuditEventRecord(event) };
    },

    async listEvents(filters) {
      const result = await options.repository.list(filters);
      return {
        items: result.items.map(mapAuditEventRecord),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        hasNextPage: result.hasNextPage,
      };
    },
  };
}

export function mapAuditEventRecord(record: AuditEventRecord): AuditEventDTO {
  return {
    id: record.id,
    userId: record.userId,
    deviceId: record.deviceId,
    eventType: record.eventType,
    subjectType: record.subjectType,
    subjectId: record.subjectId,
    payload: record.payload,
    createdAt: record.createdAt.toISOString(),
  };
}

function validateRecordAuditEventInput(input: RecordAuditEventInput) {
  requireIdentifier(input.userId, "userId");
  if (input.deviceId !== undefined && input.deviceId !== null) {
    requireIdentifier(input.deviceId, "deviceId");
  }
  requireIdentifier(input.eventType, "eventType");
  requireIdentifier(input.subjectType, "subjectType");
  requireIdentifier(input.subjectId, "subjectId");
  if (input.createdAt && Number.isNaN(input.createdAt.getTime())) {
    throw badRequest("createdAt must be a valid date.");
  }
  if (input.payload !== undefined && input.payload !== null) {
    validatePayload(input.payload);
  }
}

function requireIdentifier(value: string, field: string) {
  return requireString(value, field, 50);
}

function requireString(value: string, field: string, maxLength: number) {
  if (typeof value !== "string") throw badRequest(`${field} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw badRequest(`${field} must be between 1 and ${maxLength} characters.`);
  }
  return trimmed;
}

function validatePayload(payload: AuditPayload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw badRequest("payload must be an object when provided.");
  }
  assertNoSecretKeys(payload);
}

function assertNoSecretKeys(value: unknown, path = "payload") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) assertNoSecretKeys(item, path);
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      throw badRequest(`${path}.${key} must not contain secret material.`);
    }
    assertNoSecretKeys(nested, `${path}.${key}`);
  }
}
