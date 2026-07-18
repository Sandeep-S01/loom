import { randomUUID } from "node:crypto";
import { buildApp } from "../src/app.ts";
import { unauthorized } from "../src/lib/http-errors.ts";
import { createChatService } from "../src/modules/chat/service.ts";
import { createInMemoryChatIdempotencyStore } from "../src/modules/chat/load-control.ts";
import { createInMemoryConversationRepository } from "../src/modules/conversations/repository.ts";
import { createInMemoryModelRegistryService } from "../src/modules/models/service.ts";
import type { SessionService } from "../src/modules/session/service.ts";

process.env.NODE_ENV = "test";
process.env.FRONTEND_URL = "http://127.0.0.1:3200";
process.env.E2E_PROVIDER_KEY = "configured-for-tests";

const provider = {
  id: "prv_e2e",
  name: "E2E Provider",
  baseType: "e2e",
  driverKey: "e2e",
  status: "active",
  priorityRank: 1,
  defaultSecretRef: "E2E_PROVIDER_KEY",
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
