import type {
  DeleteModelPolicyInput,
  ModelPolicyDTO,
  ModelPolicyListFilters,
  ModelPolicyListResponse,
  ModelPolicyRecord,
  ModelPolicyRegistryReference,
  PaginatedModelPolicyResult,
  UpsertModelPolicyInput,
} from "./domain.js";

export interface ModelPolicyRepository {
  list(filters: ModelPolicyListFilters): Promise<PaginatedModelPolicyResult>;
  findByRegistryModelId(registryModelId: string): Promise<ModelPolicyRecord | null>;
  upsert(input: UpsertModelPolicyInput): Promise<ModelPolicyRecord>;
  deleteByRegistryModelId(registryModelId: string): Promise<ModelPolicyRecord | null>;
}

export interface ModelPolicyRegistryReader {
  findById(registryModelId: string): Promise<ModelPolicyRegistryReference | null>;
}

export interface ModelPolicyLogger {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
}

export interface ModelPolicyService {
  listPolicies(filters: ModelPolicyListFilters): Promise<ModelPolicyListResponse>;
  getPolicy(registryModelId: string): Promise<ModelPolicyDTO>;
  upsertPolicy(input: UpsertModelPolicyInput): Promise<ModelPolicyDTO>;
  deletePolicy(input: DeleteModelPolicyInput): Promise<ModelPolicyDTO>;
}
