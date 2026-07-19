import type {
  CreateFallbackDecisionInput,
  FallbackDecisionListFilters,
  FallbackDecisionListResponse,
  FallbackDecisionRecord,
  FallbackSelection,
  PaginatedFallbackDecisionResult,
  SelectFallbackInput,
} from "./domain.js";

export interface FallbackDecisionRepository {
  list(filters: FallbackDecisionListFilters): Promise<PaginatedFallbackDecisionResult>;
  findByRequestId(requestId: string): Promise<FallbackDecisionRecord | null>;
  create(input: CreateFallbackDecisionInput): Promise<FallbackDecisionRecord>;
}

export interface ModelFallbackLogger {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
}

export interface ModelFallbackService {
  selectFallback(input: SelectFallbackInput): Promise<FallbackSelection>;
  listDecisions(
    filters: FallbackDecisionListFilters,
  ): Promise<FallbackDecisionListResponse>;
}
