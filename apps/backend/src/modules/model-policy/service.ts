import { conflict, notFound } from "../../lib/http-errors.js";
import type {
  ModelPolicyDTO,
  ModelPolicyRecord,
} from "./domain.js";
import type {
  ModelPolicyLogger,
  ModelPolicyRegistryReader,
  ModelPolicyRepository,
  ModelPolicyService,
} from "./interfaces.js";

interface CreateModelPolicyServiceOptions {
  repository: ModelPolicyRepository;
  registryReader: ModelPolicyRegistryReader;
  logger?: ModelPolicyLogger;
}

const noopLogger: ModelPolicyLogger = {
  info() {},
  warn() {},
  error() {},
};

export function createModelPolicyService(
  options: CreateModelPolicyServiceOptions,
): ModelPolicyService {
  const logger = options.logger ?? noopLogger;

  return {
    async listPolicies(filters) {
      const result = await options.repository.list(filters);
      return {
        ...result,
        items: result.items.map(mapPolicyRecord),
      };
    },

    async getPolicy(registryModelId) {
      const policy = await options.repository.findByRegistryModelId(registryModelId);
      if (!policy) {
        throw notFound("Model policy not found.");
      }
      return mapPolicyRecord(policy);
    },

    async upsertPolicy(input) {
      await assertActiveRegistryModel(options.registryReader, input.registryModelId);
      const policy = await options.repository.upsert(input);
      logger.info(
        {
          event: "model_policy.policy_upserted",
          actorUserId: input.actorUserId,
          registryModelId: input.registryModelId,
          policyId: policy.id,
        },
        "Model policy upserted",
      );
      return mapPolicyRecord(policy);
    },

    async deletePolicy(input) {
      await assertActiveRegistryModel(options.registryReader, input.registryModelId);
      const deleted = await options.repository.deleteByRegistryModelId(
        input.registryModelId,
      );
      if (!deleted) {
        throw notFound("Model policy not found.");
      }
      logger.info(
        {
          event: "model_policy.policy_deleted",
          actorUserId: input.actorUserId,
          registryModelId: input.registryModelId,
          policyId: deleted.id,
        },
        "Model policy deleted",
      );
      return mapPolicyRecord(deleted);
    },
  };
}

async function assertActiveRegistryModel(
  registryReader: ModelPolicyRegistryReader,
  registryModelId: string,
) {
  const registryModel = await registryReader.findById(registryModelId);
  if (!registryModel) {
    throw notFound("Registry model not found.");
  }
  if (registryModel.status !== "registered" || registryModel.archivedAt) {
    throw conflict("Policy can only be managed for registered models.");
  }
}

function mapPolicyRecord(record: ModelPolicyRecord): ModelPolicyDTO {
  return {
    id: record.id,
    registryModelId: record.registryModelId,
    enabled: record.enabled,
    visibleInSelector: record.visibleInSelector,
    priorityRank: record.priorityRank,
    defaultForChat: record.defaultForChat,
    defaultForAgent: record.defaultForAgent,
    requiresCompanion: record.requiresCompanion,
    requestsPerMinuteLimit: record.requestsPerMinuteLimit,
    tokensPerDayLimit: record.tokensPerDayLimit,
    tokensPerRequestLimit: record.tokensPerRequestLimit,
    notes: record.notes,
    createdByUserId: record.createdByUserId,
    updatedByUserId: record.updatedByUserId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
