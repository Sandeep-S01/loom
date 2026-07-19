export type AuditEventSort = "createdAt";
export type AuditEventDirection = "asc" | "desc";

export interface AuditPayload {
  [key: string]: unknown;
}

export interface RecordAuditEventInput {
  userId: string;
  deviceId?: string | null;
  eventType: string;
  subjectType: string;
  subjectId: string;
  payload?: AuditPayload | null;
  createdAt?: Date;
}

export interface AuditEventRecord {
  id: string;
  userId: string;
  deviceId: string | null;
  eventType: string;
  subjectType: string;
  subjectId: string;
  payload: AuditPayload | null;
  createdAt: Date;
}

export interface AuditEventDTO {
  id: string;
  userId: string;
  deviceId: string | null;
  eventType: string;
  subjectType: string;
  subjectId: string;
  payload: AuditPayload | null;
  createdAt: string;
}

export interface AuditEventListFilters {
  userId?: string;
  deviceId?: string;
  eventType?: string;
  subjectType?: string;
  subjectId?: string;
  search?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
  sort: AuditEventSort;
  direction: AuditEventDirection;
}

export interface PaginatedAuditEventResult {
  items: AuditEventRecord[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface AuditEventListResponse {
  items: AuditEventDTO[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}
