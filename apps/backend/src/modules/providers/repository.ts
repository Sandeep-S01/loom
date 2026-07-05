import { and, eq, ne } from "drizzle-orm";
import { generateId } from "@clm/shared-utils";
import { getDb } from "../../db/connection.js";
import { models, providerAttempts, providers } from "../../db/schema.js";
import type {
  ProviderFailureCode,
  ProviderModelCandidate,
} from "./types.js";

export async function listEligibleChatModels(): Promise<ProviderModelCandidate[]> {
  const db = getDb();

  const rows = await db
    .select({
      providerId: providers.id,
      providerName: providers.name,
      modelId: models.id,
      modelName: models.name,
      externalModelKey: models.externalModelKey,
      providerPriority: providers.priorityRank,
      modelPriority: models.priorityRank,
      baseType: providers.baseType,
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(
      and(
        eq(models.active, true),
        eq(models.supportsChat, true),
        ne(providers.status, "disabled"),
      ),
    );

  return rows;
}

export async function listEligibleAgentModels(): Promise<ProviderModelCandidate[]> {
  const db = getDb();

  const rows = await db
    .select({
      providerId: providers.id,
      providerName: providers.name,
      modelId: models.id,
      modelName: models.name,
      externalModelKey: models.externalModelKey,
      providerPriority: providers.priorityRank,
      modelPriority: models.priorityRank,
      baseType: providers.baseType,
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(
      and(
        eq(models.active, true),
        eq(models.supportsAgent, true),
        ne(providers.status, "disabled"),
      ),
    );

  return rows;
}

export async function listEligibleModels(
  mode: "chat" | "agent",
): Promise<ProviderModelCandidate[]> {
  return mode === "agent"
    ? listEligibleAgentModels()
    : listEligibleChatModels();
}

export async function listDashboardProviderModels() {
  const db = getDb();

  return db
    .select({
      providerId: providers.id,
      modelId: models.id,
      active: models.active,
      supportsChat: models.supportsChat,
      supportsAgent: models.supportsAgent,
      providerStatus: providers.status,
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id));
}

export async function recordProviderAttempt(input: {
  conversationId: string;
  providerId: string;
  modelId: string;
  attemptNo: number;
  status: "success" | "failed" | "switched";
  failureCode?: ProviderFailureCode;
  startedAt: Date;
  endedAt: Date;
}) {
  const db = getDb();

  await db.insert(providerAttempts).values({
    id: generateId("providerAttempt"),
    conversationId: input.conversationId,
    agentRunId: null,
    providerId: input.providerId,
    modelId: input.modelId,
    attemptNo: input.attemptNo,
    status: input.status,
    failureCode: input.failureCode ?? null,
    latencyMs: input.endedAt.getTime() - input.startedAt.getTime(),
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  });
}
