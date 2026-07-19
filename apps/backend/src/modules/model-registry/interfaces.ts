import type { ModelCatalogRecord } from "../model-catalog/domain.js";
import type {
  ArchiveRegistryModelInput,
  ModelRegistryDTO,
  ModelRegistryEntry,
  ModelRegistryListFilters,
  ModelRegistryListResponse,
  ModelRegistryRecord,
  PaginatedModelRegistryResult,
  RegisterCatalogModelInput,
} from "./domain.js";

export interface ModelRegistryRepository {
  list(filters: ModelRegistryListFilters): Promise<PaginatedModelRegistryResult>;
  findById(registryModelId: string): Promise<ModelRegistryEntry | null>;
  findActiveByCatalogModelId(catalogModelId: string): Promise<ModelRegistryRecord | null>;
  registerCatalogModel(input: RegisterCatalogModelInput): Promise<ModelRegistryRecord | null>;
  archive(input: ArchiveRegistryModelInput): Promise<ModelRegistryRecord | null>;
}

export interface ModelRegistryCatalogReader {
  findById(catalogModelId: string): Promise<ModelCatalogRecord | null>;
}

export interface ModelRegistryLogger {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
}

export interface ModelRegistryApprovalService {
  listRegistry(filters: ModelRegistryListFilters): Promise<ModelRegistryListResponse>;
  getRegistryModel(registryModelId: string): Promise<ModelRegistryDTO>;
  registerCatalogModel(input: RegisterCatalogModelInput): Promise<ModelRegistryDTO>;
  archiveRegistryModel(input: ArchiveRegistryModelInput): Promise<ModelRegistryDTO>;
}
