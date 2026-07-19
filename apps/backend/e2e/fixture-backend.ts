import { randomUUID } from "node:crypto";
import { buildApp } from "../src/app.ts";
import { unauthorized } from "../src/lib/http-errors.ts";
import { createChatService } from "../src/modules/chat/service.ts";
import { createInMemoryChatIdempotencyStore } from "../src/modules/chat/load-control.ts";
import { createInMemoryConversationRepository } from "../src/modules/conversations/repository.ts";
import {
  createInMemoryModelCatalogProviderRepository,
  createInMemoryModelCatalogRepository,
} from "../src/modules/model-catalog/repository.ts";
import { createModelCatalogService } from "../src/modules/model-catalog/service.ts";
import {
  createInMemoryModelPolicyRegistryReader,
  createInMemoryModelPolicyRepository,
} from "../src/modules/model-policy/repository.ts";
import { createModelPolicyService } from "../src/modules/model-policy/service.ts";
import {
  createInMemoryModelRegistryCatalogReader,
  createInMemoryModelRegistryRepository,
} from "../src/modules/model-registry/repository.ts";
import { createModelRegistryApprovalService } from "../src/modules/model-registry/service.ts";
import {
  createInMemoryModelRuntimeHealthRegistryReader,
  createInMemoryModelRuntimeHealthRepository,
} from "../src/modules/model-runtime-health/repository.ts";
import { createModelRuntimeHealthService } from "../src/modules/model-runtime-health/service.ts";
import { createInMemoryModelRegistryService } from "../src/modules/models/service.ts";
import {
  createInMemoryModelUsageRepository,
} from "../src/modules/model-usage/repository.ts";
import { createModelUsageService } from "../src/modules/model-usage/service.ts";
import {
  createInMemoryProviderCredentialRepository,
  createInMemoryProviderRepository,
} from "../src/modules/providers/management-repository.ts";
import { createProviderManagementService } from "../src/modules/providers/management-service.ts";
import { createEnvSecretReader } from "../src/modules/providers/secret-reader.ts";
import {
  createInMemoryProviderHealthProviderReader,
  createInMemoryProviderHealthRepository,
} from "../src/modules/provider-health/repository.ts";
import { createProviderHealthService } from "../src/modules/provider-health/service.ts";
import type { SessionService } from "../src/modules/session/service.ts";

process.env.NODE_ENV = "test";
process.env.FRONTEND_URL = "http://127.0.0.1:3200";
process.env.E2E_PROVIDER_KEY = "configured-for-tests";

const now = new Date("2026-07-19T00:00:00.000Z");
const provider = {
  id: "prv_e2e",
  name: "E2E Provider",
  baseType: "e2e",
  driverKey: "e2e",
  status: "active" as const,
  priorityRank: 1,
  defaultSecretRef: "E2E_PROVIDER_KEY",
  metadataJson: { supportsDiscovery: true },
  createdAt: now,
  updatedAt: now,
};
const baseModel = {
  providerId: provider.id,
  supportsChat: true,
  supportsAgent: false,
  supportsVision: true,
  contextWindow: 8_192,
  adminStatus: "active" as const,
  runtimeStatus: "healthy" as const,
  deletedAt: null,
  cooldownUntil: null,
  secretRef: "E2E_PROVIDER_KEY",
};
const modelA = {
  ...baseModel,
  id: "mdl_e2e_a",
  externalModelKey: "e2e/model-a",
  name: "E2E Model A",
  priorityRank: 1,
};
const modelB = {
  ...baseModel,
  id: "mdl_e2e_b",
  externalModelKey: "e2e/model-b",
  name: "E2E Model B",
  priorityRank: 2,
};
const catalogModelA = {
  id: "mcat_e2e_a",
  providerId: provider.id,
  externalModelKey: modelA.externalModelKey,
  displayName: modelA.name,
  description: "Seeded e2e free chat model.",
  capabilities: {
    chat: true,
    agent: false,
    vision: true,
    toolUse: false,
    jsonMode: true,
  },
  contextWindow: 8_192,
  maxOutputTokens: 2_048,
  costTier: "free" as const,
  pricing: {
    inputPer1mUsdMicros: 0,
    outputPer1mUsdMicros: 0,
    currency: "USD" as const,
    raw: null,
  },
  releaseStage: "stable" as const,
  releasedAt: null,
  deprecatedAt: null,
  deprecationReason: null,
  providerMetadata: {},
  firstDiscoveredAt: now,
  lastDiscoveredAt: now,
  lastChangedAt: null,
  createdAt: now,
  updatedAt: now,
};
const catalogModelB = {
  ...catalogModelA,
  id: "mcat_e2e_b",
  externalModelKey: modelB.externalModelKey,
  displayName: modelB.name,
};
const registryModelA = {
  id: "mreg_e2e_a",
  catalogModelId: catalogModelA.id,
  status: "registered" as const,
  approvedByUserId: "usr_e2e_admin",
  approvedAt: now,
  archivedByUserId: null,
  archivedAt: null,
  archiveReason: null,
  notes: "Seeded for e2e admin flows.",
  createdAt: now,
  updatedAt: now,
};
const registryEntryA = {
  registry: registryModelA,
  catalog: catalogModelA,
};
const registryReferenceA = {
  id: registryModelA.id,
  status: registryModelA.status,
  archivedAt: registryModelA.archivedAt,
};
const modelPolicyA = {
  id: "mpol_e2e_a",
  registryModelId: registryModelA.id,
  enabled: true,
  visibleInSelector: true,
  priorityRank: 1,
  defaultForChat: true,
  defaultForAgent: false,
  requiresCompanion: false,
  requestsPerMinuteLimit: 60,
  tokensPerDayLimit: 100_000,
  tokensPerRequestLimit: 8_192,
  notes: "Seeded policy for e2e admin flows.",
  createdByUserId: "usr_e2e_admin",
  updatedByUserId: "usr_e2e_admin",
  createdAt: now,
  updatedAt: now,
};
const providerCredential = {
  id: "pcr_e2e",
  providerId: provider.id,
  secretRef: "E2E_PROVIDER_KEY",
  status: "configured" as const,
  lastCheckedAt: now,
  lastSuccessAt: now,
  lastFailureAt: null,
  lastFailureCode: null,
  createdAt: now,
  updatedAt: now,
};
const providerHealth = {
  id: "phs_e2e",
  providerId: provider.id,
  status: "healthy" as const,
  cooldownUntil: null,
  consecutiveFailures: 0,
  lastFailureCode: null,
  lastFailureAt: null,
  lastSuccessAt: now,
  lastCheckedAt: now,
  reason: null,
  updatedByUserId: "usr_e2e_admin",
  createdAt: now,
  updatedAt: now,
};
const modelRuntimeHealth = {
  id: "mrh_e2e",
  registryModelId: registryModelA.id,
  status: "healthy" as const,
  cooldownUntil: null,
  consecutiveFailures: 0,
  lastFailureCode: null,
  lastFailureAt: null,
  lastSuccessAt: now,
  lastCheckedAt: now,
  reason: null,
  updatedByUserId: "usr_e2e_admin",
  createdAt: now,
  updatedAt: now,
};
const usageCounterBase = {
  registryModelId: registryModelA.id,
  providerId: provider.id,
  requestCount: 3,
  successCount: 2,
  failureCount: 1,
  fallbackCount: 1,
  rateLimitCount: 0,
  inputTokens: 12,
  outputTokens: 18,
  totalTokens: 30,
  latencyMsTotal: 900,
  latencySampleCount: 3,
  costUsdMicros: 0,
  updatedAt: now,
};
const usageCounters = [
  {
    ...usageCounterBase,
    id: "muc_e2e_hour",
    bucketStart: now,
    bucketGranularity: "hour" as const,
  },
  {
    ...usageCounterBase,
    id: "muc_e2e_day",
    bucketStart: now,
    bucketGranularity: "day" as const,
  },
];

const fixtureUsers = new Map([
  ["user@clm.local", { id: "usr_e2e_admin", email: "user@clm.local", displayName: "E2E Admin", role: "admin" as const }],
  ["customer@clm.local", { id: "usr_e2e_customer", email: "customer@clm.local", displayName: "E2E Customer", role: "customer" as const }],
]);
const fixtureSessions = new Map<string, { userId: string; expiresAt: Date }>();
const sessionService: SessionService = {
  async authenticate(input) {
    const user = fixtureUsers.get(input.email.trim().toLowerCase());
    if (!user || input.password !== "changeme") throw unauthorized("Invalid email or password.");
    return user;
  },
  async createSession(userId) {
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    fixtureSessions.set(token, { userId, expiresAt });
    return { token, expiresAt };
  },
  async resolveSessionUser(token) {
    const session = token ? fixtureSessions.get(token) : undefined;
    if (!session || session.expiresAt.getTime() <= Date.now()) return null;
    return [...fixtureUsers.values()].find((user) => user.id === session.userId) ?? null;
  },
  async revokeSession(token) {
    if (token) fixtureSessions.delete(token);
  },
  async registerUser(input) {
    const email = input.email.trim().toLowerCase();
    if (fixtureUsers.has(email)) {
      throw new Error("An account with this email already exists.");
    }

    const user = {
      id: `usr_e2e_${randomUUID()}`,
      email,
      displayName: input.displayName,
      role: "customer" as const,
    };
    fixtureUsers.set(email, user);
    return user;
  },
  async updateProfile(input) {
    const entry = [...fixtureUsers.entries()].find(([, user]) => user.id === input.userId);
    if (!entry) throw unauthorized("Authentication required.");
    const [email, user] = entry;
    const updated = { ...user, displayName: input.displayName };
    fixtureUsers.set(email, updated);
    return updated;
  },
};

const conversationRepository = createInMemoryConversationRepository();
const modelRegistryService = createInMemoryModelRegistryService({
  providers: [provider],
  models: [modelA, modelB],
});
const providerManagementService = createProviderManagementService({
  providerRepository: createInMemoryProviderRepository([provider]),
  credentialRepository: createInMemoryProviderCredentialRepository([providerCredential]),
  secretReader: createEnvSecretReader(),
});
const catalogRecords = [catalogModelA, catalogModelB];
const modelCatalogService = createModelCatalogService({
  repository: createInMemoryModelCatalogRepository(catalogRecords),
  providerRepository: createInMemoryModelCatalogProviderRepository([provider.id]),
});
const modelRegistryApprovalService = createModelRegistryApprovalService({
  repository: createInMemoryModelRegistryRepository([registryEntryA], catalogRecords),
  catalogReader: createInMemoryModelRegistryCatalogReader(catalogRecords),
});
const modelPolicyService = createModelPolicyService({
  repository: createInMemoryModelPolicyRepository([modelPolicyA]),
  registryReader: createInMemoryModelPolicyRegistryReader([registryReferenceA]),
});
const modelRuntimeHealthService = createModelRuntimeHealthService({
  repository: createInMemoryModelRuntimeHealthRepository([modelRuntimeHealth]),
  registryReader: createInMemoryModelRuntimeHealthRegistryReader([registryReferenceA]),
});
const providerHealthService = createProviderHealthService({
  repository: createInMemoryProviderHealthRepository([providerHealth]),
  providerReader: createInMemoryProviderHealthProviderReader([provider]),
});
const modelUsageService = createModelUsageService({
  repository: createInMemoryModelUsageRepository(usageCounters),
});
const chatService = createChatService({
  conversationRepository,
  idempotencyStore: createInMemoryChatIdempotencyStore(),
  providerCandidates: [
    {
      providerId: provider.id,
      providerName: provider.name,
      modelId: modelA.id,
      modelName: modelA.name,
      modelPriority: modelA.priorityRank,
      providerPriority: provider.priorityRank,
      supportsChat: true,
      supportsVision: true,
    },
    {
      providerId: provider.id,
      providerName: provider.name,
      modelId: modelB.id,
      modelName: modelB.name,
      modelPriority: modelB.priorityRank,
      providerPriority: provider.priorityRank,
      supportsChat: true,
      supportsVision: true,
    },
  ],
  invokeProvider: async (candidate, messages) => {
    const prompt = JSON.stringify(messages.at(-1));
    if (prompt.includes("[OUTAGE]")) {
      return { ok: false, failureCode: "provider_5xx" };
    }
    if (prompt.includes("[RECOVERY]") && candidate.modelId === modelA.id) {
      return {
        ok: true,
        text: `Recovered response from ${candidate.modelName}.`,
        usage: { inputTokens: 4, outputTokens: 6, totalTokens: 10 },
      };
    }
    return candidate.modelId === modelA.id
      ? { ok: false, failureCode: "provider_5xx" }
      : {
          ok: true,
          text: `E2E response from ${candidate.modelName}.`,
          usage: { inputTokens: 4, outputTokens: 6, totalTokens: 10 },
        };
  },
});

async function main() {
  const app = buildApp({
    conversationRepository,
    modelRegistryService,
    providerManagementService,
    modelCatalogService,
    modelRegistryApprovalService,
    modelPolicyService,
    modelRuntimeHealthService,
    providerHealthService,
    modelUsageService,
    chatService,
    sessionService,
    logger: false,
  });

  await app.listen({ host: "127.0.0.1", port: 3201 });
  const shutdown = async () => {
    await app.close();
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
