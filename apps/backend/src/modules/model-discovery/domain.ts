import type { UpsertDiscoveredModelInput } from "../model-catalog/domain.js";

export const DISCOVERY_JOB_STATUSES = ["running", "succeeded", "failed"] as const;
export type DiscoveryJobStatus = (typeof DISCOVERY_JOB_STATUSES)[number];

export const DISCOVERY_TRIGGER_TYPES = ["manual", "scheduled", "internal"] as const;
export type DiscoveryTriggerType = (typeof DISCOVERY_TRIGGER_TYPES)[number];

export const PROVIDER_SYNC_STATUSES = [
  "never_synced",
  "syncing",
  "succeeded",
  "failed",
] as const;
export type ProviderSyncStatus = (typeof PROVIDER_SYNC_STATUSES)[number];

export interface DiscoveryProviderReference {
  id: string;
  name: string;
  driverKey: string;
  status: "active" | "disabled" | "deprecated";
  metadataJson: unknown;
}

export interface DiscoveredProviderModel
  extends Omit<UpsertDiscoveredModelInput, "providerId" | "discoveredAt"> {}

export interface DiscoveryJobRecord {
  id: string;
  providerId: string;
  status: DiscoveryJobStatus;
  triggerType: DiscoveryTriggerType;
  startedAt: Date;
  completedAt: Date | null;
  discoveredCount: number;
  upsertedCount: number;
  skippedCount: number;
  failureCode: string | null;
  failureMessage: string | null;
  createdByUserId: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscoveryJobDTO {
  id: string;
  providerId: string;
  status: DiscoveryJobStatus;
  triggerType: DiscoveryTriggerType;
  startedAt: string;
  completedAt: string | null;
  discoveredCount: number;
  upsertedCount: number;
  skippedCount: number;
  failureCode: string | null;
  failureMessage: string | null;
  createdByUserId: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderSyncStatusRecord {
  id: string;
  providerId: string;
  lastJobId: string | null;
  status: ProviderSyncStatus;
  lastStartedAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastFailureCode: string | null;
  lastFailureMessage: string | null;
  lastDiscoveredCount: number;
  lastUpsertedCount: number;
  updatedAt: Date;
}

export interface ProviderSyncStatusDTO {
  id: string;
  providerId: string;
  lastJobId: string | null;
  status: ProviderSyncStatus;
  lastStartedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureCode: string | null;
  lastFailureMessage: string | null;
  lastDiscoveredCount: number;
  lastUpsertedCount: number;
  updatedAt: string;
}

export interface DiscoveryJobListFilters {
  providerId?: string;
  status?: DiscoveryJobStatus;
  page: number;
  pageSize: number;
  sort: "startedAt" | "completedAt" | "updatedAt";
  direction: "asc" | "desc";
}

export interface ProviderSyncStatusListFilters {
  providerId?: string;
  status?: ProviderSyncStatus;
  page: number;
  pageSize: number;
  sort: "updatedAt" | "lastStartedAt" | "lastSuccessAt";
  direction: "asc" | "desc";
}

export interface PaginatedDiscoveryJobsResult {
  items: DiscoveryJobRecord[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface DiscoveryJobListResponse {
  items: DiscoveryJobDTO[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface PaginatedProviderSyncStatusResult {
  items: ProviderSyncStatusRecord[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface ProviderSyncStatusListResponse {
  items: ProviderSyncStatusDTO[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface RunDiscoveryInput {
  providerId: string;
  triggerType: DiscoveryTriggerType;
  actorUserId: string | null;
}

export interface DiscoveryJobUpdate {
  status: DiscoveryJobStatus;
  completedAt?: Date | null;
  discoveredCount?: number;
  upsertedCount?: number;
  skippedCount?: number;
  failureCode?: string | null;
  failureMessage?: string | null;
  metadata?: unknown;
}

export interface ProviderSyncStatusUpdate {
  providerId: string;
  lastJobId: string;
  status: ProviderSyncStatus;
  startedAt?: Date | null;
  succeededAt?: Date | null;
  failedAt?: Date | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  discoveredCount?: number;
  upsertedCount?: number;
}
