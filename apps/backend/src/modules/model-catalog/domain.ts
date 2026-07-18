export const MODEL_CATALOG_COST_TIERS = ["free", "paid", "unknown"] as const;
export type ModelCatalogCostTier = (typeof MODEL_CATALOG_COST_TIERS)[number];

export const MODEL_CATALOG_RELEASE_STAGES = [
  "stable",
  "preview",
  "experimental",
  "legacy",
] as const;
export type ModelCatalogReleaseStage =
  (typeof MODEL_CATALOG_RELEASE_STAGES)[number];

export interface ModelCapabilities {
  chat: boolean;
  agent: boolean;
  vision: boolean;
  toolUse: boolean;
  jsonMode: boolean;
}

export interface ModelPricingMetadata {
  inputPer1mUsdMicros: number | null;
  outputPer1mUsdMicros: number | null;
  currency: "USD";
  raw: unknown;
}

export interface ModelCatalogRecord {
  id: string;
  providerId: string;
  externalModelKey: string;
  displayName: string;
  description: string | null;
  capabilities: ModelCapabilities;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  costTier: ModelCatalogCostTier;
  pricing: ModelPricingMetadata;
  releaseStage: ModelCatalogReleaseStage;
  releasedAt: Date | null;
  deprecatedAt: Date | null;
  deprecationReason: string | null;
  providerMetadata: unknown;
  firstDiscoveredAt: Date;
  lastDiscoveredAt: Date;
  lastChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelCatalogListFilters {
  providerId?: string;
  search?: string;
  capability?: keyof ModelCapabilities;
  costTier?: ModelCatalogCostTier;
  releaseStage?: ModelCatalogReleaseStage;
  deprecated?: boolean;
  discoveredAfter?: Date;
  discoveredBefore?: Date;
  page: number;
  pageSize: number;
  sort:
    | "displayName"
    | "providerId"
    | "contextWindow"
    | "lastDiscoveredAt"
    | "updatedAt";
  direction: "asc" | "desc";
}

export interface UpsertDiscoveredModelInput {
  providerId: string;
  externalModelKey: string;
  displayName: string;
  description?: string | null;
  capabilities: ModelCapabilities;
  contextWindow?: number | null;
  maxOutputTokens?: number | null;
  costTier: ModelCatalogCostTier;
  pricing?: Partial<ModelPricingMetadata> | null;
  releaseStage?: ModelCatalogReleaseStage;
  releasedAt?: Date | string | null;
  deprecatedAt?: Date | string | null;
  deprecationReason?: string | null;
  providerMetadata?: unknown;
  discoveredAt?: Date;
}

export interface ModelCatalogDTO {
  id: string;
  providerId: string;
  externalModelKey: string;
  displayName: string;
  description: string | null;
  capabilities: ModelCapabilities;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  costTier: ModelCatalogCostTier;
  pricing: ModelPricingMetadata;
  releaseStage: ModelCatalogReleaseStage;
  releasedAt: string | null;
  deprecatedAt: string | null;
  deprecationReason: string | null;
  providerMetadata: unknown;
  firstDiscoveredAt: string;
  lastDiscoveredAt: string;
  lastChangedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedModelCatalogResult {
  items: ModelCatalogRecord[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface ModelCatalogListResponse {
  items: ModelCatalogDTO[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}
