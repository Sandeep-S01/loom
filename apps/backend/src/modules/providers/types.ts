export interface ProviderModelCandidate {
  providerId: string;
  providerName: string;
  modelId: string;
  modelName: string;
  externalModelKey: string;
  providerPriority: number;
  modelPriority: number;
  baseType: string;
  secretRef?: string | null;
}

export type ProviderFailureCode =
  | "provider_unavailable"
  | "provider_timeout"
  | "provider_rate_limited"
  | "invalid_api_key"
  | "model_not_found"
  | "context_too_large"
  | "provider_4xx"
  | "unknown_provider_error"
  | "rate_limited_transient"
  | "quota_exhausted"
  | "provider_unreachable"
  | "provider_5xx"
  | "invalid_response"
  | "auth_invalid"
  | "policy_blocked";

export type NormalizedProviderErrorCode =
  | "provider_unavailable"
  | "provider_timeout"
  | "provider_rate_limited"
  | "invalid_api_key"
  | "model_not_found"
  | "context_too_large"
  | "provider_5xx"
  | "provider_4xx"
  | "unknown_provider_error";

export type ProviderStatusState =
  | "connected"
  | "missing_key"
  | "invalid_key"
  | "degraded"
  | "unavailable"
  | "disabled";

export interface NormalizedProviderError {
  code: NormalizedProviderErrorCode;
  retryable: boolean;
  message: string;
  providerName?: string;
  modelId?: string;
  retryAfterMs?: number;
  statusCode?: number;
}

export type ProviderInvocationResult =
  | {
      ok: true;
      text: string;
      usage?: ProviderUsage;
    }
  | {
      ok: false;
      failureCode: ProviderFailureCode;
      error?: NormalizedProviderError;
      retryAfterSeconds?: number | null;
      attempts?: number;
      latencyMs?: number;
    };

export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}
