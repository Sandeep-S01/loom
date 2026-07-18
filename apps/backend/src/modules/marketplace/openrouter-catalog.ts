export interface OpenRouterCatalogModel {
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
  created?: number;
  description?: string;
}

export interface OpenRouterCatalogResponse {
  data?: OpenRouterCatalogModel[];
}

export interface FreeCatalogModel {
  providerModelId: string;
  displayName: string;
  owner: string | null;
  contextWindow: number;
  supportsChat: boolean;
  supportsAgent: boolean;
  supportsVision: boolean;
  inputModalities: string[];
  outputModalities: string[];
  costInputPer1mUsdMicros: number | null;
  costOutputPer1mUsdMicros: number | null;
  raw: Record<string, unknown>;
}

export function normalizeOpenRouterFreeModels(
  response: OpenRouterCatalogResponse,
): FreeCatalogModel[] {
  return (response.data ?? [])
    .filter(isFreeOpenRouterModel)
    .map((model) => {
      const inputModalities = model.architecture?.input_modalities ?? ["text"];
      const outputModalities = model.architecture?.output_modalities ?? ["text"];
      const owner = model.id.includes("/") ? model.id.split("/")[0] : null;
      const contextWindow =
        model.context_length ??
        model.top_provider?.context_length ??
        4096;

      return {
        providerModelId: model.id,
        displayName: model.name?.trim() || model.id,
        owner,
        contextWindow,
        supportsChat: outputModalities.includes("text"),
        supportsAgent: outputModalities.includes("text"),
        supportsVision: inputModalities.includes("image"),
        inputModalities,
        outputModalities,
        costInputPer1mUsdMicros: toCostMicrosPerMillion(model.pricing?.prompt),
        costOutputPer1mUsdMicros: toCostMicrosPerMillion(model.pricing?.completion),
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
