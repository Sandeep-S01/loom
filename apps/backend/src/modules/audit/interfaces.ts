import type {
  AuditEventListFilters,
  AuditEventListResponse,
  AuditEventDTO,
  AuditEventRecord,
  PaginatedAuditEventResult,
  RecordAuditEventInput,
} from "./domain.js";

export interface AuditEventRepository {
  create(input: RecordAuditEventInput): Promise<AuditEventRecord>;
  findById(id: string): Promise<AuditEventRecord | null>;
  list(filters: AuditEventListFilters): Promise<PaginatedAuditEventResult>;
}

export interface AuditLogger {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
}

export interface AuditService {
  recordEvent(input: RecordAuditEventInput): Promise<AuditEventRecord>;
  getEvent(id: string): Promise<AuditEventDTOResponse>;
  listEvents(filters: AuditEventListFilters): Promise<AuditEventListResponse>;
}

export interface AuditEventDTOResponse {
  event: AuditEventDTO;
}
