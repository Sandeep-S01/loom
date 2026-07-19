import type { ModelCapabilities, ModelCatalogCostTier } from "../model-catalog/domain.js";

export type EligibilityMode = "chat" | "agent";
export type EligibilityPurpose = "selector" | "routing" | "admin_diagnostics";

export type ModelRuntimeHealthStatus =
  | "healthy"
  | "degraded"
  | "rate_limited"
  | "open_circuit"
  | "auth_invalid"
  | "unknown";

export type ProviderHealthStatus =
  | "healthy"
  | "degraded"
  | "unavailable"
  | "auth_invalid"
  | "unknown";

export type EligibilityReasonCode =
  | "eligible"
  | "registry_archived"
  | "policy_missing"
  | "policy_disabled"
  | "hidden_from_selector"
  | "unsupported_mode"
  | "companion_required"
  | "paid_model_not_supported"
  | "provider_disabled"
  | "provider_unavailable"
  | "runtime_unavailable"
  | "context_window_exceeded"
  | "output_token_limit_exceeded"
  | "request_token_limit_exceeded";

export interface EligibilityRequestContext {
  mode: EligibilityMode;
  purpose: EligibilityPurpose;
  companionAvailable: boolean;
  estimatedInputTokens?: number;
  requestedOutputTokens?: number;
  includeIneligible: boolean;
}

export interface EligibilitySourceModel {
  registryModelId: string;
  registryStatus: "registered" | "archived";
  registryArchivedAt: Date | null;
  catalogModelId: string;
  providerId: string;
  providerName: string;
  providerStatus: "active" | "degraded" | "disabled";
  providerPriorityRank: number;
  externalModelKey: string;
  displayName: string;
  capabilities: ModelCapabilities;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  costTier: ModelCatalogCostTier;
  policy: EligibilityPolicySnapshot | null;
}

export interface EligibilityPolicySnapshot {
  enabled: boolean;
  visibleInSelector: boolean;
  priorityRank: number;
  defaultForChat: boolean;
  defaultForAgent: boolean;
  requiresCompanion: boolean;
  requestsPerMinuteLimit: number | null;
  tokensPerDayLimit: number | null;
  tokensPerRequestLimit: number | null;
}

export interface RuntimeHealthSnapshot {
  registryModelId: string;
  status: ModelRuntimeHealthStatus;
  cooldownUntil: Date | null;
  checkedAt: Date | null;
  reason: string | null;
}

export interface ProviderHealthSnapshot {
  providerId: string;
  status: ProviderHealthStatus;
  cooldownUntil: Date | null;
  checkedAt: Date | null;
  reason: string | null;
}

export interface EligibilityReason {
  code: EligibilityReasonCode;
  message: string;
}

export interface EligibleModelCandidate {
  registryModelId: string;
  catalogModelId: string;
  providerId: string;
  providerName: string;
  externalModelKey: string;
  displayName: string;
  capabilities: ModelCapabilities;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  priorityRank: number;
  providerPriorityRank: number;
  defaultForChat: boolean;
  defaultForAgent: boolean;
  requiresCompanion: boolean;
  requestsPerMinuteLimit: number | null;
  tokensPerDayLimit: number | null;
  tokensPerRequestLimit: number | null;
  runtimeStatus: ModelRuntimeHealthStatus;
  providerHealthStatus: ProviderHealthStatus;
  reasons: EligibilityReason[];
}

export interface IneligibleModelCandidate {
  registryModelId: string;
  catalogModelId: string;
  providerId: string;
  providerName: string;
  externalModelKey: string;
  displayName: string;
  reasons: EligibilityReason[];
}

export interface EligibilityResult {
  mode: EligibilityMode;
  purpose: EligibilityPurpose;
  eligible: EligibleModelCandidate[];
  ineligible: IneligibleModelCandidate[];
}
