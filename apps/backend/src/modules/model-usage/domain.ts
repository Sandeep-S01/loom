export type UsageMode = "chat" | "agent" | "test_connection";
export type UsageStatus = "success" | "failed" | "blocked";
export type UsageCounterGranularity = "hour" | "day";
export type UsageCounterSort = "bucketStart" | "requestCount" | "totalTokens" | "updatedAt";
export type UsageCounterDirection = "asc" | "desc";

export interface RecordModelUsageInput {
  registryModelId: string;
  providerId: string;
  mode: UsageMode;
  status: UsageStatus;
  usedFallback: boolean;
  failureCode?: string | null;
  latencyMs?: number | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsdMicros: number;
  occurredAt?: Date;
}

export interface UsageCounterRecord {
  id: string;
  registryModelId: string;
  providerId: string;
  bucketStart: Date;
  bucketGranularity: UsageCounterGranularity;
  requestCount: number;
  successCount: number;
  failureCount: number;
  fallbackCount: number;
  rateLimitCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMsTotal: number;
  latencySampleCount: number;
  costUsdMicros: number;
  updatedAt: Date;
}

export interface UsageCounterDTO {
  id: string;
  registryModelId: string;
  providerId: string;
  bucketStart: string;
  bucketGranularity: UsageCounterGranularity;
  requestCount: number;
  successCount: number;
  failureCount: number;
  fallbackCount: number;
  rateLimitCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMsTotal: number;
  latencySampleCount: number;
  averageLatencyMs: number | null;
  costUsdMicros: number;
  updatedAt: string;
}

export interface UsageCounterListFilters {
  registryModelId?: string;
  providerId?: string;
  granularity: UsageCounterGranularity;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
  sort: UsageCounterSort;
  direction: UsageCounterDirection;
}

export interface PaginatedUsageCounterResult {
  items: UsageCounterRecord[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface UsageCounterListResponse {
  items: UsageCounterDTO[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface UsageSummaryFilters {
  registryModelId?: string;
  providerId?: string;
  from?: Date;
  to?: Date;
}

export interface UsageSummary {
  requestCount: number;
  successCount: number;
  failureCount: number;
  fallbackCount: number;
  rateLimitCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMsTotal: number;
  latencySampleCount: number;
  averageLatencyMs: number | null;
  costUsdMicros: number;
}
