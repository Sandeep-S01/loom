import type { DiscoveryAdapterRegistry, DiscoveryProviderAdapter } from "./interfaces.js";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

interface OpenRouterCatalogModel {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
  top_provider?: {
    context_length?: number;
  };
  description?: string;
}

interface OpenRouterCatalogResponse {
  data?: OpenRouterCatalogModel[];
}

export function createDiscoveryAdapterRegistry(
  adapters: DiscoveryProviderAdapter[],
): DiscoveryAdapterRegistry {
  const adaptersByDriverKey = new Map(
    adapters.map((adapter) => [adapter.driverKey, adapter]),
  );
  return {
    getAdapter(driverKey) {
      return adaptersByDriverKey.get(driverKey) ?? null;
    },
  };
}

export function createOpenRouterDiscoveryAdapter(
  fetchFn: typeof fetch = fetch,
): DiscoveryProviderAdapter {
  return {
    driverKey: "openrouter",
    async discoverFreeModels() {
      const response = await fetchFn(OPENROUTER_MODELS_URL);
      if (!response.ok) {
        throw new Error("openrouter_catalog_fetch_failed");
      }

      const body = (await response.json()) as OpenRouterCatalogResponse;
      return normalizeOpenRouterFreeModels(body).map((model) => ({
        externalModelKey: model.id,
        displayName: model.name?.trim() || model.id,
        description: model.description ?? null,
        capabilities: {
          chat: model.outputModalities.includes("text"),
          agent: model.outputModalities.includes("text"),
          vision: model.inputModalities.includes("image"),
          toolUse: false,
          jsonMode: false,
        },
        contextWindow: model.contextWindow,
        maxOutputTokens: null,
        costTier: "free",
        pricing: {
          inputPer1mUsdMicros: toCostMicrosPerMillion(model.pricing?.prompt),
          outputPer1mUsdMicros: toCostMicrosPerMillion(model.pricing?.completion),
          raw: model.pricing ?? null,
        },
        releaseStage: "stable",
        releasedAt: null,
        deprecatedAt: null,
        deprecationReason: null,
        providerMetadata: {
          source: "openrouter",
          owner: model.owner,
          inputModalities: model.inputModalities,
          outputModalities: model.outputModalities,
          raw: model.raw,
        },
      }));
    },
  };
}

function normalizeOpenRouterFreeModels(response: OpenRouterCatalogResponse) {
  return (response.data ?? [])
    .filter(isFreeOpenRouterModel)
    .map((model) => {
      const inputModalities = model.architecture?.input_modalities ?? ["text"];
      const outputModalities = model.architecture?.output_modalities ?? ["text"];
      return {
        ...model,
        owner: model.id.includes("/") ? model.id.split("/")[0] : null,
        contextWindow:
          model.context_length ?? model.top_provider?.context_length ?? 4096,
        inputModalities,
        outputModalities,
        raw: model as unknown as Record<string, unknown>,
      };
    });
}

function isFreeOpenRouterModel(model: OpenRouterCatalogModel) {
  if (model.id.endsWith(":free")) return true;
  return (
    isZeroPrice(model.pricing?.prompt) &&
    isZeroPrice(model.pricing?.completion)
  );
}

function isZeroPrice(value: string | undefined) {
  if (value == null) return false;
  return Number.parseFloat(value) === 0;
}

function toCostMicrosPerMillion(value: string | undefined) {
  if (value == null) return null;
  const pricePerToken = Number.parseFloat(value);
  if (!Number.isFinite(pricePerToken)) return null;
  return Math.round(pricePerToken * 1_000_000 * 1_000_000);
}
