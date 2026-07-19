import type {
  EligibilityRequestContext,
  EligibilityResult,
  EligibilitySourceModel,
  ProviderHealthSnapshot,
  RuntimeHealthSnapshot,
} from "./domain.js";

export interface EligibilitySourceReader {
  listRegistryModels(): Promise<EligibilitySourceModel[]>;
}

export interface RuntimeHealthReader {
  getRuntimeHealth(registryModelIds: string[]): Promise<Map<string, RuntimeHealthSnapshot>>;
}

export interface ProviderHealthReader {
  getProviderHealth(providerIds: string[]): Promise<Map<string, ProviderHealthSnapshot>>;
}

export interface ModelEligibilityLogger {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
}

export interface ModelEligibilityService {
  evaluate(context: EligibilityRequestContext): Promise<EligibilityResult>;
}
