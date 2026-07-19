import type {
  PaginatedUsageCounterResult,
  RecordModelUsageInput,
  UsageCounterListFilters,
  UsageCounterListResponse,
  UsageCounterRecord,
  UsageSummary,
  UsageSummaryFilters,
} from "./domain.js";

export interface ModelUsageRepository {
  record(input: RecordModelUsageInput): Promise<UsageCounterRecord[]>;
  listCounters(filters: UsageCounterListFilters): Promise<PaginatedUsageCounterResult>;
  summarize(filters: UsageSummaryFilters): Promise<UsageSummary>;
}

export interface ModelUsageLogger {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
}

export interface ModelUsageService {
  recordUsage(input: RecordModelUsageInput): Promise<{ counters: UsageCounterRecord[] }>;
  listCounters(filters: UsageCounterListFilters): Promise<UsageCounterListResponse>;
  getSummary(filters: UsageSummaryFilters): Promise<UsageSummary>;
}
