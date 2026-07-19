import type {
  CreateRoutingAttemptInput,
  ModelRouteSelection,
  PaginatedRoutingAttemptsResult,
  RoutingAttemptListResponse,
  RoutingAttemptListFilters,
  RoutingAttemptRecord,
  SelectModelRouteInput,
} from "./domain.js";

export interface RoutingAttemptRepository {
  list(filters: RoutingAttemptListFilters): Promise<PaginatedRoutingAttemptsResult>;
  findByRequestId(requestId: string): Promise<RoutingAttemptRecord | null>;
  create(input: CreateRoutingAttemptInput): Promise<RoutingAttemptRecord>;
}

export interface ModelRoutingLogger {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
}

export interface ModelRoutingService {
  selectRoute(input: SelectModelRouteInput): Promise<ModelRouteSelection>;
  listAttempts(filters: RoutingAttemptListFilters): Promise<RoutingAttemptListResponse>;
}
