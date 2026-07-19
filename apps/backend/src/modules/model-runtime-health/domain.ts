export const MODEL_RUNTIME_HEALTH_STATUSES = [
  "healthy",
  "degraded",
  "rate_limited",
  "open_circuit",
  "auth_invalid",
  "unknown",
] as const;

export type ModelRuntimeHealthStatus =
  (typeof MODEL_RUNTIME_HEALTH_STATUSES)[number];

export interface ModelRuntimeHealthRecord {
  id: string;
  registryModelId: string;
  status: ModelRuntimeHealthStatus;
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

export interface ModelRuntimeHealthDTO {
  id: string;
  registryModelId: string;
  status: ModelRuntimeHealthStatus;
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

export interface ModelRuntimeHealthSnapshot {
  registryModelId: string;
  status: ModelRuntimeHealthStatus;
  cooldownUntil: Date | null;
  checkedAt: Date | null;
  reason: string | null;
}

export interface ModelRuntimeHealthListFilters {
  registryModelId?: string;
  status?: ModelRuntimeHealthStatus;
  page: number;
  pageSize: number;
  sort: "updatedAt" | "lastCheckedAt" | "consecutiveFailures";
  direction: "asc" | "desc";
}

export interface ModelRuntimeHealthPatch {
  status?: ModelRuntimeHealthStatus;
  cooldownUntil?: Date | null;
  consecutiveFailures?: number;
  lastFailureCode?: string | null;
  lastFailureAt?: Date | null;
  lastSuccessAt?: Date | null;
  lastCheckedAt?: Date | null;
  reason?: string | null;
}

export interface UpsertModelRuntimeHealthInput {
  registryModelId: string;
  patch: ModelRuntimeHealthPatch;
  actorUserId: string | null;
}

export interface ResetModelRuntimeHealthInput {
  registryModelId: string;
  actorUserId: string | null;
}

export interface ModelRuntimeHealthRegistryReference {
  id: string;
  status: "registered" | "archived";
  archivedAt: Date | null;
}

export interface PaginatedModelRuntimeHealthResult {
  items: ModelRuntimeHealthRecord[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface ModelRuntimeHealthListResponse {
  items: ModelRuntimeHealthDTO[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}
