export const PROVIDER_STATUSES = ["active", "disabled", "deprecated"] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export const PROVIDER_CREDENTIAL_STATUSES = [
  "unchecked",
  "configured",
  "missing",
  "invalid",
] as const;
export type ProviderCredentialStatus = (typeof PROVIDER_CREDENTIAL_STATUSES)[number];

export interface ProviderRecord {
  id: string;
  name: string;
  baseType: string;
  driverKey: string;
  defaultSecretRef: string | null;
  metadataJson: unknown;
  status: ProviderStatus;
  priorityRank: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderCredentialRecord {
  id: string;
  providerId: string;
  secretRef: string;
  status: ProviderCredentialStatus;
  lastCheckedAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastFailureCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderListFilters {
  status?: ProviderStatus;
  supportsDiscovery?: boolean;
  search?: string;
  page: number;
  pageSize: number;
  sort: "name" | "priorityRank" | "updatedAt";
  direction: "asc" | "desc";
}

export interface ProviderCredentialListFilters {
  providerId?: string;
}

export interface UpdateProviderInput {
  name?: string;
  status?: ProviderStatus;
  priorityRank?: number;
  defaultSecretRef?: string | null;
  metadataJson?: unknown;
}

export interface CheckProviderCredentialInput {
  providerId?: string;
  credentialId?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface ProviderDTO {
  id: string;
  name: string;
  baseType: string;
  driverKey: string;
  defaultSecretRef: string | null;
  metadataJson: unknown;
  status: ProviderStatus;
  priorityRank: number;
  credentialStatus: ProviderCredentialStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderCredentialDTO {
  id: string;
  providerId: string;
  secretRef: string;
  status: ProviderCredentialStatus;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureCode: string | null;
  createdAt: string;
  updatedAt: string;
}
