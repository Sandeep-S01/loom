import type { ModelCatalogService } from "../model-catalog/interfaces.js";
import type {
  DiscoveredProviderModel,
  DiscoveryJobDTO,
  DiscoveryJobListFilters,
  DiscoveryJobListResponse,
  DiscoveryJobRecord,
  DiscoveryJobUpdate,
  DiscoveryProviderReference,
  DiscoverableProvidersDiscoveryResult,
  PaginatedDiscoveryJobsResult,
  PaginatedProviderSyncStatusResult,
  ProviderSyncStatusDTO,
  ProviderSyncStatusListFilters,
  ProviderSyncStatusListResponse,
  ProviderSyncStatusUpdate,
  ProviderSyncStatusRecord,
  RunDiscoveryInput,
  RunDiscoverableProvidersDiscoveryInput,
} from "./domain.js";

export interface DiscoveryProviderReader {
  findById(providerId: string): Promise<DiscoveryProviderReference | null>;
  listDiscoverableProviders(): Promise<DiscoveryProviderReference[]>;
}

export interface DiscoveryJobRepository {
  list(filters: DiscoveryJobListFilters): Promise<PaginatedDiscoveryJobsResult>;
  findById(jobId: string): Promise<DiscoveryJobRecord | null>;
  create(input: RunDiscoveryInput): Promise<DiscoveryJobRecord>;
  update(jobId: string, patch: DiscoveryJobUpdate): Promise<DiscoveryJobRecord | null>;
}

export interface ProviderSyncStatusRepository {
  list(
    filters: ProviderSyncStatusListFilters,
  ): Promise<PaginatedProviderSyncStatusResult>;
  findByProviderId(providerId: string): Promise<ProviderSyncStatusRecord | null>;
  upsert(update: ProviderSyncStatusUpdate): Promise<ProviderSyncStatusRecord>;
}

export interface DiscoveryProviderAdapter {
  driverKey: string;
  discoverFreeModels(provider: DiscoveryProviderReference): Promise<DiscoveredProviderModel[]>;
}

export interface DiscoveryAdapterRegistry {
  getAdapter(driverKey: string): DiscoveryProviderAdapter | null;
}

export interface ModelDiscoveryLogger {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
}

export interface ModelDiscoveryMetrics {
  observeDiscoveryJob(input: {
    providerId: string;
    status: string;
    triggerType: string;
    durationMs: number;
  }): void;
}

export interface ModelDiscoveryService {
  listJobs(filters: DiscoveryJobListFilters): Promise<DiscoveryJobListResponse>;
  getJob(jobId: string): Promise<DiscoveryJobDTO>;
  listProviderSyncStatus(
    filters: ProviderSyncStatusListFilters,
  ): Promise<ProviderSyncStatusListResponse>;
  getProviderSyncStatus(providerId: string): Promise<ProviderSyncStatusDTO>;
  runProviderDiscovery(input: RunDiscoveryInput): Promise<DiscoveryJobDTO>;
  runDiscoverableProvidersDiscovery(
    input: RunDiscoverableProvidersDiscoveryInput,
  ): Promise<DiscoverableProvidersDiscoveryResult>;
}

export interface CreateModelDiscoveryServiceOptions {
  providerReader: DiscoveryProviderReader;
  jobRepository: DiscoveryJobRepository;
  syncStatusRepository: ProviderSyncStatusRepository;
  adapterRegistry: DiscoveryAdapterRegistry;
  catalogService: ModelCatalogService;
  logger?: ModelDiscoveryLogger;
  metrics?: ModelDiscoveryMetrics;
}
