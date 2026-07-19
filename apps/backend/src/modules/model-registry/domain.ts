import type { ModelCatalogDTO, ModelCatalogRecord } from "../model-catalog/domain.js";

export const MODEL_REGISTRY_STATUSES = ["registered", "archived"] as const;
export type ModelRegistryStatus = (typeof MODEL_REGISTRY_STATUSES)[number];

export interface ModelRegistryRecord {
  id: string;
  catalogModelId: string;
  status: ModelRegistryStatus;
  approvedByUserId: string;
  approvedAt: Date;
  archivedByUserId: string | null;
  archivedAt: Date | null;
  archiveReason: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelRegistryEntry {
  registry: ModelRegistryRecord;
  catalog: ModelCatalogRecord;
}

export interface ModelRegistryDTO {
  id: string;
  catalogModelId: string;
  status: ModelRegistryStatus;
  approvedByUserId: string;
  approvedAt: string;
  archivedByUserId: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  notes: string | null;
  catalog: ModelCatalogDTO;
  createdAt: string;
  updatedAt: string;
}

export interface ModelRegistryListFilters {
  providerId?: string;
  search?: string;
  status?: ModelRegistryStatus;
  includeArchived: boolean;
  page: number;
  pageSize: number;
  sort: "approvedAt" | "updatedAt" | "displayName" | "providerId";
  direction: "asc" | "desc";
}

export interface RegisterCatalogModelInput {
  catalogModelId: string;
  notes?: string | null;
  actorUserId: string;
}

export interface ArchiveRegistryModelInput {
  registryModelId: string;
  actorUserId: string;
  archiveReason?: string | null;
}

export interface PaginatedModelRegistryResult {
  items: ModelRegistryEntry[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface ModelRegistryListResponse {
  items: ModelRegistryDTO[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}
