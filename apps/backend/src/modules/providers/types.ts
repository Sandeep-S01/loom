export interface ProviderModelCandidate {
  providerId: string;
  providerName: string;
  modelId: string;
  modelName: string;
  externalModelKey: string;
  providerPriority: number;
  modelPriority: number;
  baseType: string;
}

export type ProviderFailureCode =
  | "rate_limited_transient"
  | "quota_exhausted"
  | "provider_unreachable"
  | "provider_5xx"
  | "invalid_response"
  | "auth_invalid"
  | "policy_blocked";

export type ProviderInvocationResult =
  | {
      ok: true;
      text: string;
    }
  | {
      ok: false;
      failureCode: ProviderFailureCode;
    };
