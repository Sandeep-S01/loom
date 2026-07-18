import type {
  ModelCatalogDTO,
  ModelCatalogListFilters,
  ModelCatalogListResponse,
  ModelCatalogRecord,
  PaginatedModelCatalogResult,
  UpsertDiscoveredModelInput,
} from "./domain.js";

export interface ModelCatalogRepository {
  list(filters: ModelCatalogListFilters): Promise<PaginatedModelCatalogResult>;
  findById(catalogModelId: string): Promise<ModelCatalogRecord | null>;
  findByProviderModel(input: {
    providerId: string;
    externalModelKey: string;
  }): Promise<ModelCatalogRecord | null>;
  upsertDiscoveredModel(
    input: UpsertDiscoveredModelInput,
  ): Promise<ModelCatalogRecord>;
}

export interface ModelCatalogProviderRepository {
  exists(providerId: string): Promise<boolean>;
}

export interface ModelCatalogLogger {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
}

export interface ModelCatalogService {
  listCatalog(filters: ModelCatalogListFilters): Promise<ModelCatalogListResponse>;
  getCatalogModel(catalogModelId: string): Promise<ModelCatalogDTO>;
  upsertDiscoveredModel(input: UpsertDiscoveredModelInput): Promise<ModelCatalogDTO>;
  upsertDiscoveredModels(input: {
    providerId: string;
    models: UpsertDiscoveredModelInput[];
  }): Promise<{
    items: ModelCatalogDTO[];
    upsertedCount: number;
  }>;
}
