import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../db/connection.js";
import { providerCredentials, providers } from "../../db/schema.js";
import type {
  PaginatedResult,
  ProviderCredentialStatus,
  ProviderCredentialListFilters,
  ProviderCredentialRecord,
  ProviderListFilters,
  ProviderRecord,
  ProviderStatus,
  UpdateProviderInput,
} from "./domain.js";
import type {
  ProviderCredentialRepository,
  ProviderRepository,
} from "./interfaces.js";

type ProviderRow = typeof providers.$inferSelect;
type ProviderCredentialRow = typeof providerCredentials.$inferSelect;

export function createDatabaseProviderRepository(): ProviderRepository {
  return {
    async list(filters) {
      const rows = await getDb().select().from(providers);
      return paginateProviders(rows.map(mapProviderRow), filters);
    },

    async findById(providerId) {
      const [row] = await getDb()
        .select()
        .from(providers)
        .where(eq(providers.id, providerId))
        .limit(1);
      return row ? mapProviderRow(row) : null;
    },

    async update(providerId, input) {
      const patch = toProviderPatch(input);
      const [row] = await getDb()
        .update(providers)
        .set(patch)
        .where(eq(providers.id, providerId))
        .returning();
      return row ? mapProviderRow(row) : null;
    },
  };
}

export function createDatabaseProviderCredentialRepository(): ProviderCredentialRepository {
  return {
    async list(filters) {
      const query = getDb().select().from(providerCredentials);
      const rows = filters.providerId
        ? await query.where(eq(providerCredentials.providerId, filters.providerId))
        : await query;
      return rows.map(mapCredentialRow);
    },

    async findById(credentialId) {
      const [row] = await getDb()
        .select()
        .from(providerCredentials)
        .where(eq(providerCredentials.id, credentialId))
        .limit(1);
      return row ? mapCredentialRow(row) : null;
    },

    async findPrimaryForProvider(providerId) {
      const [row] = await getDb()
        .select()
        .from(providerCredentials)
        .where(eq(providerCredentials.providerId, providerId))
        .limit(1);
      return row ? mapCredentialRow(row) : null;
    },

    async findForProviderSecret(input) {
      const [row] = await getDb()
        .select()
        .from(providerCredentials)
        .where(
          and(
            eq(providerCredentials.providerId, input.providerId),
            eq(providerCredentials.secretRef, input.secretRef),
          ),
        )
        .limit(1);
      return row ? mapCredentialRow(row) : null;
    },

    async upsertProviderDefault(input) {
      const now = new Date();
      const [row] = await getDb()
        .insert(providerCredentials)
        .values({
          id: `pcr_${randomUUID()}`,
          providerId: input.providerId,
          secretRef: input.secretRef,
          status: "unchecked",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            providerCredentials.providerId,
            providerCredentials.secretRef,
          ],
          set: {
            status: "unchecked",
            lastFailureCode: null,
            updatedAt: now,
          },
        })
        .returning();
      return mapCredentialRow(row);
    },

    async updateCheckResult(input) {
      const now = new Date();
      const [row] = await getDb()
        .update(providerCredentials)
        .set({
          status: input.configured ? "configured" : "missing",
          lastCheckedAt: now,
          lastSuccessAt: input.configured ? now : undefined,
          lastFailureAt: input.configured ? undefined : now,
          lastFailureCode: input.failureCode,
          updatedAt: now,
        })
        .where(eq(providerCredentials.id, input.credentialId))
        .returning();
      return row ? mapCredentialRow(row) : null;
    },
  };
}

export function createInMemoryProviderRepository(
  seed: ProviderRecord[] = [],
): ProviderRepository {
  const providersById = new Map(seed.map((provider) => [provider.id, provider]));

  return {
    async list(filters) {
      return paginateProviders(Array.from(providersById.values()), filters);
    },

    async findById(providerId) {
      return providersById.get(providerId) ?? null;
    },

    async update(providerId, input) {
      const existing = providersById.get(providerId);
      if (!existing) return null;
      const updated: ProviderRecord = {
        ...existing,
        ...input,
        updatedAt: new Date(),
      };
      providersById.set(providerId, updated);
      return updated;
    },
  };
}

export function createInMemoryProviderCredentialRepository(
  seed: ProviderCredentialRecord[] = [],
): ProviderCredentialRepository {
  const credentialsById = new Map(seed.map((credential) => [credential.id, credential]));

  return {
    async list(filters) {
      const credentials = Array.from(credentialsById.values());
      return filters.providerId
        ? credentials.filter((credential) => credential.providerId === filters.providerId)
        : credentials;
    },

    async findById(credentialId) {
      return credentialsById.get(credentialId) ?? null;
    },

    async findPrimaryForProvider(providerId) {
      return (
        Array.from(credentialsById.values()).find(
          (credential) => credential.providerId === providerId,
        ) ?? null
      );
    },

    async findForProviderSecret(input) {
      return (
        Array.from(credentialsById.values()).find(
          (credential) =>
            credential.providerId === input.providerId &&
            credential.secretRef === input.secretRef,
        ) ?? null
      );
    },

    async upsertProviderDefault(input) {
      const existing = await this.findPrimaryForProvider(input.providerId);
      const now = new Date();

      if (existing) {
        const updated: ProviderCredentialRecord = {
          ...existing,
          secretRef: input.secretRef,
          status: "unchecked",
          lastFailureCode: null,
          updatedAt: now,
        };
        credentialsById.set(existing.id, updated);
        return updated;
      }

      const created: ProviderCredentialRecord = {
        id: `pcr_${randomUUID()}`,
        providerId: input.providerId,
        secretRef: input.secretRef,
        status: "unchecked",
        lastCheckedAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastFailureCode: null,
        createdAt: now,
        updatedAt: now,
      };
      credentialsById.set(created.id, created);
      return created;
    },

    async updateCheckResult(input) {
      const existing = credentialsById.get(input.credentialId);
      if (!existing) return null;

      const now = new Date();
      const updated: ProviderCredentialRecord = {
        ...existing,
        status: input.configured ? "configured" : "missing",
        lastCheckedAt: now,
        lastSuccessAt: input.configured ? now : existing.lastSuccessAt,
        lastFailureAt: input.configured ? existing.lastFailureAt : now,
        lastFailureCode: input.failureCode,
        updatedAt: now,
      };
      credentialsById.set(input.credentialId, updated);
      return updated;
    },
  };
}

function paginateProviders(
  rows: ProviderRecord[],
  filters: ProviderListFilters,
): PaginatedResult<ProviderRecord> {
  const search = filters.search?.toLowerCase();
  const filtered = rows.filter((provider) => {
    if (filters.status && provider.status !== filters.status) return false;
    if (filters.supportsDiscovery !== undefined) {
      const metadata = asMetadata(provider.metadataJson);
      if (metadata.supportsDiscovery !== filters.supportsDiscovery) return false;
    }
    if (search) {
      const haystack = `${provider.name} ${provider.baseType} ${provider.driverKey}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((left, right) => {
    const modifier = filters.direction === "asc" ? 1 : -1;
    if (filters.sort === "name") {
      return left.name.localeCompare(right.name) * modifier;
    }
    if (filters.sort === "updatedAt") {
      return (left.updatedAt.getTime() - right.updatedAt.getTime()) * modifier;
    }
    return (left.priorityRank - right.priorityRank) * modifier;
  });

  const offset = (filters.page - 1) * filters.pageSize;
  const items = sorted.slice(offset, offset + filters.pageSize);
  return {
    items,
    page: filters.page,
    pageSize: filters.pageSize,
    total: filtered.length,
    hasNextPage: offset + items.length < filtered.length,
  };
}

function toProviderPatch(input: UpdateProviderInput) {
  return {
    ...input,
    metadataJson:
      input.metadataJson === undefined
        ? undefined
        : sql`${JSON.stringify(input.metadataJson)}::jsonb`,
    updatedAt: new Date(),
  };
}

function mapProviderRow(row: ProviderRow): ProviderRecord {
  return {
    id: row.id,
    name: row.name,
    baseType: row.baseType,
    driverKey: row.driverKey,
    defaultSecretRef: row.defaultSecretRef,
    metadataJson: row.metadataJson,
    status: normalizeProviderStatus(row.status),
    priorityRank: row.priorityRank,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapCredentialRow(row: ProviderCredentialRow): ProviderCredentialRecord {
  return {
    id: row.id,
    providerId: row.providerId,
    secretRef: row.secretRef,
    status: normalizeCredentialStatus(row.status),
    lastCheckedAt: row.lastCheckedAt,
    lastSuccessAt: row.lastSuccessAt,
    lastFailureAt: row.lastFailureAt,
    lastFailureCode: row.lastFailureCode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeProviderStatus(status: string): ProviderStatus {
  if (status === "active" || status === "disabled" || status === "deprecated") {
    return status;
  }
  return status === "degraded" ? "active" : "disabled";
}

function normalizeCredentialStatus(status: string): ProviderCredentialStatus {
  if (
    status === "unchecked" ||
    status === "configured" ||
    status === "missing" ||
    status === "invalid"
  ) {
    return status;
  }
  return "unchecked";
}

function asMetadata(value: unknown): { supportsDiscovery?: boolean } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as { supportsDiscovery?: boolean };
}
