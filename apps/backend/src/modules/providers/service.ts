import type { ProvidersResponse } from "@clm/shared-types";
import { listProviderCooldownKeys } from "../../redis/dashboard.js";
import { redisKeys } from "../../redis/keys.js";
import { listProviderCatalog } from "./repository.js";

type ProviderCatalogRow = Awaited<ReturnType<typeof listProviderCatalog>>[number];

export async function getProvidersStatus(): Promise<ProvidersResponse> {
  const [catalogRows, cooldownKeys] = await Promise.all([
    listProviderCatalog(),
    listProviderCooldownKeys().catch(() => []),
  ]);

  const cooldownModelIds = new Set(
    cooldownKeys
      .map((key) => redisKeys.parseProviderCooldownModelId(key))
      .filter((modelId): modelId is string => Boolean(modelId)),
  );

  const providers = new Map<string, ProvidersResponse["providers"][number]>();

  for (const row of catalogRows) {
    const providerEntry =
      providers.get(row.providerId) ??
      createProviderEntry(row);

    providerEntry.models.push({
      id: row.modelId,
      name: row.modelName,
      active: row.active,
      supportsChat: row.supportsChat,
      supportsAgent: row.supportsAgent,
      inCooldown: cooldownModelIds.has(row.modelId),
      eligible:
        row.active &&
        row.providerStatus !== "disabled" &&
        providerEntry.keyConfigured &&
        (row.supportsChat || row.supportsAgent) &&
        !cooldownModelIds.has(row.modelId),
      cooldownUntil: null,
      availabilityReason: !row.active
        ? "disabled"
        : !providerEntry.keyConfigured
          ? "missing_key"
          : cooldownModelIds.has(row.modelId)
            ? "rate_limited"
            : "connected",
    });

    providers.set(row.providerId, providerEntry);
  }

  return {
    providers: Array.from(providers.values()),
  };
}

function createProviderEntry(
  row: ProviderCatalogRow,
): ProvidersResponse["providers"][number] {
  const keyConfigured = isProviderKeyConfigured(row.providerBaseType);
  return {
    id: row.providerId,
    name: row.providerName,
    baseType: row.providerBaseType,
    status: row.providerStatus === "disabled"
      ? "disabled"
      : keyConfigured
        ? "connected"
        : "missing_key",
    keyConfigured,
    keyState: keyConfigured ? "configured" : "missing_key",
    lastCheckedAt: null,
    models: [],
  };
}

function isProviderKeyConfigured(baseType: string) {
  switch (baseType) {
    case "gemini":
      return Boolean(process.env.GEMINI_API_KEY);
    case "openrouter":
      return Boolean(process.env.OPENROUTER_API_KEY);
    default:
      return false;
  }
}
