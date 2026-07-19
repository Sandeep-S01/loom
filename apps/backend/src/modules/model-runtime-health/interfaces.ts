import type {
  ModelRuntimeHealthDTO,
  ModelRuntimeHealthListFilters,
  ModelRuntimeHealthListResponse,
  ModelRuntimeHealthRecord,
  ModelRuntimeHealthRegistryReference,
  PaginatedModelRuntimeHealthResult,
  ResetModelRuntimeHealthInput,
  UpsertModelRuntimeHealthInput,
  ModelRuntimeHealthSnapshot,
} from "./domain.js";

export interface ModelRuntimeHealthRepository {
  list(filters: ModelRuntimeHealthListFilters): Promise<PaginatedModelRuntimeHealthResult>;
  findByRegistryModelId(registryModelId: string): Promise<ModelRuntimeHealthRecord | null>;
  findByRegistryModelIds(registryModelIds: string[]): Promise<ModelRuntimeHealthRecord[]>;
  upsert(input: UpsertModelRuntimeHealthInput): Promise<ModelRuntimeHealthRecord>;
  reset(input: ResetModelRuntimeHealthInput): Promise<ModelRuntimeHealthRecord>;
}

export interface ModelRuntimeHealthRegistryReader {
  findById(registryModelId: string): Promise<ModelRuntimeHealthRegistryReference | null>;
}

export interface ModelRuntimeHealthLogger {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
}

export interface ModelRuntimeHealthService {
  listRuntimeHealth(
    filters: ModelRuntimeHealthListFilters,
  ): Promise<ModelRuntimeHealthListResponse>;
  getRuntimeHealthModel(registryModelId: string): Promise<ModelRuntimeHealthDTO>;
  upsertRuntimeHealth(input: UpsertModelRuntimeHealthInput): Promise<ModelRuntimeHealthDTO>;
  resetRuntimeHealth(input: ResetModelRuntimeHealthInput): Promise<ModelRuntimeHealthDTO>;
  getRuntimeHealth(registryModelIds: string[]): Promise<Map<string, ModelRuntimeHealthSnapshot>>;
}
