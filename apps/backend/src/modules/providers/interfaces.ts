import type {
  CheckProviderCredentialInput,
  PaginatedResult,
  ProviderCredentialDTO,
  ProviderCredentialListFilters,
  ProviderCredentialRecord,
  ProviderDTO,
  ProviderListFilters,
  ProviderRecord,
  UpdateProviderInput,
} from "./domain.js";

export interface ProviderRepository {
  list(filters: ProviderListFilters): Promise<PaginatedResult<ProviderRecord>>;
  findById(providerId: string): Promise<ProviderRecord | null>;
  update(providerId: string, input: UpdateProviderInput): Promise<ProviderRecord | null>;
}

export interface ProviderCredentialRepository {
  list(filters: ProviderCredentialListFilters): Promise<ProviderCredentialRecord[]>;
  findById(credentialId: string): Promise<ProviderCredentialRecord | null>;
  findPrimaryForProvider(providerId: string): Promise<ProviderCredentialRecord | null>;
  findForProviderSecret(input: {
    providerId: string;
    secretRef: string;
  }): Promise<ProviderCredentialRecord | null>;
  upsertProviderDefault(input: {
    providerId: string;
    secretRef: string;
  }): Promise<ProviderCredentialRecord>;
  updateCheckResult(input: {
    credentialId: string;
    configured: boolean;
    failureCode: string | null;
  }): Promise<ProviderCredentialRecord | null>;
}

export interface SecretReader {
  hasSecret(secretRef: string): Promise<boolean>;
}

export interface ProviderLogger {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
}

export interface ProviderManagementService {
  listProviders(filters: ProviderListFilters): Promise<PaginatedResult<ProviderDTO>>;
  updateProvider(input: {
    providerId: string;
    update: UpdateProviderInput;
    actorUserId: string;
  }): Promise<ProviderDTO>;
  listCredentials(filters: ProviderCredentialListFilters): Promise<{
    credentials: ProviderCredentialDTO[];
  }>;
  checkCredential(input: CheckProviderCredentialInput & {
    actorUserId: string;
  }): Promise<ProviderCredentialDTO>;
}
