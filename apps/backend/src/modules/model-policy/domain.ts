export interface ModelPolicyRecord {
  id: string;
  registryModelId: string;
  enabled: boolean;
  visibleInSelector: boolean;
  priorityRank: number;
  defaultForChat: boolean;
  defaultForAgent: boolean;
  requiresCompanion: boolean;
  requestsPerMinuteLimit: number | null;
  tokensPerDayLimit: number | null;
  tokensPerRequestLimit: number | null;
  notes: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelPolicyDTO {
  id: string;
  registryModelId: string;
  enabled: boolean;
  visibleInSelector: boolean;
  priorityRank: number;
  defaultForChat: boolean;
  defaultForAgent: boolean;
  requiresCompanion: boolean;
  requestsPerMinuteLimit: number | null;
  tokensPerDayLimit: number | null;
  tokensPerRequestLimit: number | null;
  notes: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModelPolicyListFilters {
  registryModelId?: string;
  enabled?: boolean;
  visibleInSelector?: boolean;
  defaultsOnly: boolean;
  page: number;
  pageSize: number;
  sort: "priorityRank" | "updatedAt" | "createdAt";
  direction: "asc" | "desc";
}

export interface ModelPolicyPatch {
  enabled?: boolean;
  visibleInSelector?: boolean;
  priorityRank?: number;
  defaultForChat?: boolean;
  defaultForAgent?: boolean;
  requiresCompanion?: boolean;
  requestsPerMinuteLimit?: number | null;
  tokensPerDayLimit?: number | null;
  tokensPerRequestLimit?: number | null;
  notes?: string | null;
}

export interface UpsertModelPolicyInput {
  registryModelId: string;
  patch: ModelPolicyPatch;
  actorUserId: string;
}

export interface DeleteModelPolicyInput {
  registryModelId: string;
  actorUserId: string;
}

export interface ModelPolicyRegistryReference {
  id: string;
  status: "registered" | "archived";
  archivedAt: Date | null;
}

export interface PaginatedModelPolicyResult {
  items: ModelPolicyRecord[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface ModelPolicyListResponse {
  items: ModelPolicyDTO[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}
