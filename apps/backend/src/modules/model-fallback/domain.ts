import type {
  EligibleModelCandidate,
  EligibilityMode,
} from "../model-eligibility/domain.js";

export type FallbackMode = EligibilityMode;
export type FallbackDecisionStatus = "fallback_selected" | "exhausted";
export type FallbackDecisionSort = "createdAt";
export type FallbackDecisionDirection = "asc" | "desc";

export interface SelectFallbackInput {
  mode: FallbackMode;
  userId: string;
  conversationId?: string | null;
  agentRunId?: string | null;
  requestId?: string;
  failedRoutingAttemptId?: string | null;
  failedRegistryModelIds: string[];
  failureCode: string;
  failureMessage?: string | null;
  companionAvailable: boolean;
  estimatedInputTokens?: number;
  requestedOutputTokens?: number;
}

export interface FallbackDecisionRecord {
  id: string;
  requestId: string;
  userId: string;
  conversationId: string | null;
  agentRunId: string | null;
  mode: FallbackMode;
  failedRoutingAttemptId: string | null;
  failedRegistryModelIds: string[];
  selectedRegistryModelId: string | null;
  status: FallbackDecisionStatus;
  failureCode: string;
  failureMessage: string | null;
  eligibleCount: number;
  skippedFailedCount: number;
  reasonCode: string | null;
  reasonMessage: string | null;
  metadata: unknown;
  createdAt: Date;
}

export interface FallbackDecisionDTO {
  id: string;
  requestId: string;
  userId: string;
  conversationId: string | null;
  agentRunId: string | null;
  mode: FallbackMode;
  failedRoutingAttemptId: string | null;
  failedRegistryModelIds: string[];
  selectedRegistryModelId: string | null;
  status: FallbackDecisionStatus;
  failureCode: string;
  failureMessage: string | null;
  eligibleCount: number;
  skippedFailedCount: number;
  reasonCode: string | null;
  reasonMessage: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface SelectedFallback {
  decision: FallbackDecisionDTO;
  model: EligibleModelCandidate;
  exhausted: false;
}

export interface ExhaustedFallback {
  decision: FallbackDecisionDTO;
  model: null;
  exhausted: true;
}

export type FallbackSelection = SelectedFallback | ExhaustedFallback;

export interface FallbackDecisionListFilters {
  userId?: string;
  conversationId?: string;
  agentRunId?: string;
  selectedRegistryModelId?: string;
  status?: FallbackDecisionStatus;
  mode?: FallbackMode;
  page: number;
  pageSize: number;
  sort: FallbackDecisionSort;
  direction: FallbackDecisionDirection;
}

export interface PaginatedFallbackDecisionResult {
  items: FallbackDecisionRecord[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface FallbackDecisionListResponse {
  items: FallbackDecisionDTO[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface CreateFallbackDecisionInput {
  requestId: string;
  userId: string;
  conversationId: string | null;
  agentRunId: string | null;
  mode: FallbackMode;
  failedRoutingAttemptId: string | null;
  failedRegistryModelIds: string[];
  selectedRegistryModelId: string | null;
  status: FallbackDecisionStatus;
  failureCode: string;
  failureMessage: string | null;
  eligibleCount: number;
  skippedFailedCount: number;
  reasonCode: string | null;
  reasonMessage: string | null;
  metadata: unknown;
}
