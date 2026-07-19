export const PROVIDER_HEALTH_STATUSES = [
  "healthy",
  "degraded",
  "unavailable",
  "auth_invalid",
  "unknown",
] as const;

export type ProviderHealthStatus = (typeof PROVIDER_HEALTH_STATUSES)[number];

export interface ProviderHealthRecord {
  id: string;
  providerId: string;
  status: ProviderHealthStatus;
  cooldownUntil: Date | null;
  consecutiveFailures: number;
  lastFailureCode: string | null;
  lastFailureAt: Date | null;
  lastSuccessAt: Date | null;
  lastCheckedAt: Date | null;
  reason: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderHealthDTO {
  id: string;
  providerId: string;
  status: ProviderHealthStatus;
  cooldownUntil: string | null;
  consecutiveFailures: number;
  lastFailureCode: string | null;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  lastCheckedAt: string | null;
  reason: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderHealthSnapshot {
  providerId: string;
  status: ProviderHealthStatus;
  cooldownUntil: Date | null;
  checkedAt: Date | null;
  reason: string | null;
}

export interface ProviderHealthListFilters {
  providerId?: string;
  status?: ProviderHealthStatus;
  page: number;
  pageSize: number;
  sort: "updatedAt" | "lastCheckedAt" | "consecutiveFailures";
  direction: "asc" | "desc";
}

export interface ProviderHealthPatch {
  status?: ProviderHealthStatus;
  cooldownUntil?: Date | null;
  consecutiveFailures?: number;
  lastFailureCode?: string | null;
  lastFailureAt?: Date | null;
  lastSuccessAt?: Date | null;
  lastCheckedAt?: Date | null;
  reason?: string | null;
}

export interface UpsertProviderHealthInput {
  providerId: string;
  patch: ProviderHealthPatch;
  actorUserId: string | null;
}

export interface ResetProviderHealthInput {
  providerId: string;
  actorUserId: string | null;
}

export interface ProviderHealthProviderReference {
  id: string;
}

export interface PaginatedProviderHealthResult {
  items: ProviderHealthRecord[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface ProviderHealthListResponse {
  items: ProviderHealthDTO[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}
