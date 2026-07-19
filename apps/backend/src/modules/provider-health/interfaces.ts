import type {
  PaginatedProviderHealthResult,
  ProviderHealthDTO,
  ProviderHealthListFilters,
  ProviderHealthListResponse,
  ProviderHealthProviderReference,
  ProviderHealthRecord,
  ProviderHealthSnapshot,
  ResetProviderHealthInput,
  UpsertProviderHealthInput,
} from "./domain.js";

export interface ProviderHealthRepository {
  list(filters: ProviderHealthListFilters): Promise<PaginatedProviderHealthResult>;
  findByProviderId(providerId: string): Promise<ProviderHealthRecord | null>;
  findByProviderIds(providerIds: string[]): Promise<ProviderHealthRecord[]>;
  upsert(input: UpsertProviderHealthInput): Promise<ProviderHealthRecord>;
  reset(input: ResetProviderHealthInput): Promise<ProviderHealthRecord>;
}

export interface ProviderHealthProviderReader {
  findById(providerId: string): Promise<ProviderHealthProviderReference | null>;
}

export interface ProviderHealthLogger {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
}

export interface ProviderHealthService {
  listProviderHealth(filters: ProviderHealthListFilters): Promise<ProviderHealthListResponse>;
  getProviderHealthModel(providerId: string): Promise<ProviderHealthDTO>;
  upsertProviderHealth(input: UpsertProviderHealthInput): Promise<ProviderHealthDTO>;
  resetProviderHealth(input: ResetProviderHealthInput): Promise<ProviderHealthDTO>;
  getProviderHealth(providerIds: string[]): Promise<Map<string, ProviderHealthSnapshot>>;
}
