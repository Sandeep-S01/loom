import type {
  EligibilityReason,
  EligibilityRequestContext,
  EligibilityResult,
  EligibilitySourceModel,
  IneligibleModelCandidate,
  ProviderHealthSnapshot,
  RuntimeHealthSnapshot,
} from "./domain.js";
import type {
  EligibilitySourceReader,
  ModelEligibilityLogger,
  ModelEligibilityService,
  ProviderHealthReader,
  RuntimeHealthReader,
} from "./interfaces.js";

interface CreateModelEligibilityServiceOptions {
  sourceReader: EligibilitySourceReader;
  runtimeHealthReader: RuntimeHealthReader;
  providerHealthReader: ProviderHealthReader;
  logger?: ModelEligibilityLogger;
}

const noopLogger: ModelEligibilityLogger = {
  info() {},
  warn() {},
  error() {},
};

export function createModelEligibilityService(
  options: CreateModelEligibilityServiceOptions,
): ModelEligibilityService {
  const logger = options.logger ?? noopLogger;

  return {
    async evaluate(context) {
      const models = await options.sourceReader.listRegistryModels();
      const runtimeHealth = await options.runtimeHealthReader.getRuntimeHealth(
        models.map((model) => model.registryModelId),
      );
      const providerHealth = await options.providerHealthReader.getProviderHealth(
        Array.from(new Set(models.map((model) => model.providerId))),
      );

      const eligible = [];
      const ineligible: IneligibleModelCandidate[] = [];

      for (const model of models) {
        const runtime = getRuntimeHealth(model, runtimeHealth);
        const provider = getProviderHealth(model, providerHealth);
        const reasons = getEligibilityReasons(model, context, runtime, provider);
        if (reasons.length === 0) {
          eligible.push(toEligibleCandidate(model, runtime, provider));
        } else if (context.includeIneligible) {
          ineligible.push(toIneligibleCandidate(model, reasons));
        }
      }

      eligible.sort((left, right) => {
        if (left.priorityRank !== right.priorityRank) {
          return left.priorityRank - right.priorityRank;
        }
        if (left.providerPriorityRank !== right.providerPriorityRank) {
          return left.providerPriorityRank - right.providerPriorityRank;
        }
        return left.displayName.localeCompare(right.displayName);
      });

      logger.info(
        {
          event: "model_eligibility.evaluated",
          mode: context.mode,
          purpose: context.purpose,
          eligibleCount: eligible.length,
          ineligibleCount: ineligible.length,
        },
        "Model eligibility evaluated",
      );

      return {
        mode: context.mode,
        purpose: context.purpose,
        eligible,
        ineligible,
      };
    },
  };
}

function getEligibilityReasons(
  model: EligibilitySourceModel,
  context: EligibilityRequestContext,
  runtime: RuntimeHealthSnapshot,
  providerHealth: ProviderHealthSnapshot,
): EligibilityReason[] {
  const reasons: EligibilityReason[] = [];
  if (model.registryStatus !== "registered" || model.registryArchivedAt) {
    reasons.push(reason("registry_archived", "Model is archived in the registry."));
  }
  if (!model.policy) {
    reasons.push(reason("policy_missing", "No policy is configured for this model."));
    return reasons;
  }
  if (!model.policy.enabled) {
    reasons.push(reason("policy_disabled", "Model is disabled by policy."));
  }
  if (context.purpose === "selector" && !model.policy.visibleInSelector) {
    reasons.push(reason("hidden_from_selector", "Model is hidden from the selector."));
  }
  if (context.mode === "chat" && !model.capabilities.chat) {
    reasons.push(reason("unsupported_mode", "Model does not support chat mode."));
  }
  if (context.mode === "agent" && !model.capabilities.agent) {
    reasons.push(reason("unsupported_mode", "Model does not support agent mode."));
  }
  if (model.policy.requiresCompanion && !context.companionAvailable) {
    reasons.push(reason("companion_required", "Model requires the desktop companion."));
  }
  if (model.costTier !== "free") {
    reasons.push(reason("paid_model_not_supported", "Only free models are supported."));
  }
  if (model.providerStatus === "disabled") {
    reasons.push(reason("provider_disabled", "Provider is disabled."));
  }
  if (providerHealth.status === "unavailable" || providerHealth.status === "auth_invalid") {
    reasons.push(reason("provider_unavailable", "Provider is currently unavailable."));
  }
  if (
    runtime.status === "rate_limited" ||
    runtime.status === "open_circuit" ||
    runtime.status === "auth_invalid" ||
    isFutureDate(runtime.cooldownUntil)
  ) {
    reasons.push(reason("runtime_unavailable", "Model runtime is currently unavailable."));
  }
  const requestedTotalTokens =
    (context.estimatedInputTokens ?? 0) + (context.requestedOutputTokens ?? 0);
  if (model.contextWindow !== null && requestedTotalTokens > model.contextWindow) {
    reasons.push(reason("context_window_exceeded", "Request exceeds model context window."));
  }
  if (
    model.maxOutputTokens !== null &&
    (context.requestedOutputTokens ?? 0) > model.maxOutputTokens
  ) {
    reasons.push(
      reason("output_token_limit_exceeded", "Request exceeds model output token limit."),
    );
  }
  if (
    model.policy.tokensPerRequestLimit !== null &&
    requestedTotalTokens > model.policy.tokensPerRequestLimit
  ) {
    reasons.push(
      reason("request_token_limit_exceeded", "Request exceeds policy token limit."),
    );
  }
  return reasons;
}

function toEligibleCandidate(
  model: EligibilitySourceModel,
  runtime: RuntimeHealthSnapshot,
  providerHealth: ProviderHealthSnapshot,
) {
  const policy = model.policy;
  if (!policy) {
    throw new Error("Eligible model cannot be mapped without policy.");
  }

  return {
    registryModelId: model.registryModelId,
    catalogModelId: model.catalogModelId,
    providerId: model.providerId,
    providerName: model.providerName,
    externalModelKey: model.externalModelKey,
    displayName: model.displayName,
    capabilities: model.capabilities,
    contextWindow: model.contextWindow,
    maxOutputTokens: model.maxOutputTokens,
    priorityRank: policy.priorityRank,
    providerPriorityRank: model.providerPriorityRank,
    defaultForChat: policy.defaultForChat,
    defaultForAgent: policy.defaultForAgent,
    requiresCompanion: policy.requiresCompanion,
    requestsPerMinuteLimit: policy.requestsPerMinuteLimit,
    tokensPerDayLimit: policy.tokensPerDayLimit,
    tokensPerRequestLimit: policy.tokensPerRequestLimit,
    runtimeStatus: runtime.status,
    providerHealthStatus: providerHealth.status,
    reasons: [reason("eligible", "Model is eligible for this request.")],
  };
}

function toIneligibleCandidate(
  model: EligibilitySourceModel,
  reasons: EligibilityReason[],
): IneligibleModelCandidate {
  return {
    registryModelId: model.registryModelId,
    catalogModelId: model.catalogModelId,
    providerId: model.providerId,
    providerName: model.providerName,
    externalModelKey: model.externalModelKey,
    displayName: model.displayName,
    reasons,
  };
}

function getRuntimeHealth(
  model: EligibilitySourceModel,
  runtimeHealth: Map<string, RuntimeHealthSnapshot>,
) {
  return runtimeHealth.get(model.registryModelId) ?? {
    registryModelId: model.registryModelId,
    status: "healthy" as const,
    cooldownUntil: null,
    checkedAt: null,
    reason: null,
  };
}

function getProviderHealth(
  model: EligibilitySourceModel,
  providerHealth: Map<string, ProviderHealthSnapshot>,
) {
  return providerHealth.get(model.providerId) ?? {
    providerId: model.providerId,
    status: "healthy" as const,
    checkedAt: null,
    reason: null,
  };
}

function reason(code: EligibilityReason["code"], message: string): EligibilityReason {
  return { code, message };
}

function isFutureDate(value: Date | null): boolean {
  return Boolean(value && value.getTime() > Date.now());
}
