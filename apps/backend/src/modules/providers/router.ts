export type ModelCapability = "chat" | "agent";

export interface RankedModelCandidate {
  providerId: string;
  modelId: string;
  modelName: string;
  providerPriority: number;
  modelPriority: number;
  supportsChat?: boolean;
  supportsAgent?: boolean;
}

export function rankModels(candidates: RankedModelCandidate[]) {
  return [...candidates].sort((left, right) => {
    if (left.providerPriority !== right.providerPriority) {
      return left.providerPriority - right.providerPriority;
    }

    return left.modelPriority - right.modelPriority;
  });
}

export interface SelectNextModelOptions {
  failedModelIds: Set<string>;
  /** Only return models that support this capability. */
  capability?: ModelCapability;
  /** Models currently in cooldown — modelId → cooldown expiry epoch ms. */
  cooldownMap?: Map<string, number>;
}

export function selectNextModel(
  candidates: RankedModelCandidate[],
  failedModelIds: Set<string>,
  options?: Omit<SelectNextModelOptions, "failedModelIds">,
) {
  const now = Date.now();
  const capability = options?.capability;
  const cooldownMap = options?.cooldownMap;

  return (
    rankModels(candidates).find((candidate) => {
      if (failedModelIds.has(candidate.modelId)) return false;

      // Capability filter
      if (capability === "chat" && candidate.supportsChat === false) return false;
      if (capability === "agent" && candidate.supportsAgent === false) return false;

      // Cooldown filter
      if (cooldownMap) {
        const until = cooldownMap.get(candidate.modelId);
        if (until !== undefined && until > now) return false;
      }

      return true;
    }) ?? null
  );
}
