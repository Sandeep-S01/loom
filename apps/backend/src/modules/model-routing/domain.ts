import type {
  EligibleModelCandidate,
  EligibilityMode,
} from "../model-eligibility/domain.js";

export type RoutingMode = EligibilityMode;
export type RoutingAttemptStatus = "selected" | "no_eligible_models";
export type RoutingAttemptSort = "createdAt";
export type RoutingAttemptDirection = "asc" | "desc";

export interface SelectModelRouteInput {
  mode: RoutingMode;
  userId: string;
  conversationId?: string | null;
  agentRunId?: string | null;
  companionAvailable: boolean;
  estimatedInputTokens?: number;
  requestedOutputTokens?: number;
  preferredRegistryModelId?: string | null;
  requestId?: string;
}

export interface RoutingAttemptRecord {
  id: string;
  requestId: string;
  userId: string;
  conversationId: string | null;
  agentRunId: string | null;
  mode: RoutingMode;
  registryModelId: string | null;
  status: RoutingAttemptStatus;
  eligibleCount: number;
  ineligibleCount: number;
  reasonCode: string | null;
  reasonMessage: string | null;
  metadata: unknown;
  createdAt: Date;
}

export interface RoutingAttemptDTO {
  id: string;
  requestId: string;
  userId: string;
  conversationId: string | null;
  agentRunId: string | null;
  mode: RoutingMode;
  registryModelId: string | null;
  status: RoutingAttemptStatus;
  eligibleCount: number;
  ineligibleCount: number;
  reasonCode: string | null;
  reasonMessage: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface SelectedModelRoute {
  attempt: RoutingAttemptDTO;
  model: EligibleModelCandidate;
  eligibleCount: number;
  ineligibleCount: number;
}

export interface NoEligibleModelRoute {
  attempt: RoutingAttemptDTO;
  model: null;
  eligibleCount: number;
  ineligibleCount: number;
}

export type ModelRouteSelection = SelectedModelRoute | NoEligibleModelRoute;

export interface RoutingAttemptListFilters {
  userId?: string;
  conversationId?: string;
  agentRunId?: string;
  registryModelId?: string;
  status?: RoutingAttemptStatus;
  mode?: RoutingMode;
  page: number;
  pageSize: number;
  sort: RoutingAttemptSort;
  direction: RoutingAttemptDirection;
}

export interface PaginatedRoutingAttemptsResult {
  items: RoutingAttemptRecord[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface RoutingAttemptListResponse {
  items: RoutingAttemptDTO[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface CreateRoutingAttemptInput {
  requestId: string;
  userId: string;
  conversationId: string | null;
  agentRunId: string | null;
  mode: RoutingMode;
  registryModelId: string | null;
  status: RoutingAttemptStatus;
  eligibleCount: number;
  ineligibleCount: number;
  reasonCode: string | null;
  reasonMessage: string | null;
  metadata: unknown;
}
