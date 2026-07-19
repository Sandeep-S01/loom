import { conflict, notFound } from "../../lib/http-errors.js";
import type {
  ModelRuntimeHealthDTO,
  ModelRuntimeHealthRecord,
  ModelRuntimeHealthSnapshot,
} from "./domain.js";
import type {
  ModelRuntimeHealthLogger,
  ModelRuntimeHealthRegistryReader,
  ModelRuntimeHealthRepository,
  ModelRuntimeHealthService,
} from "./interfaces.js";

interface CreateModelRuntimeHealthServiceOptions {
  repository: ModelRuntimeHealthRepository;
  registryReader: ModelRuntimeHealthRegistryReader;
  logger?: ModelRuntimeHealthLogger;
}

const noopLogger: ModelRuntimeHealthLogger = {
  info() {},
  warn() {},
  error() {},
};

export function createModelRuntimeHealthService(
  options: CreateModelRuntimeHealthServiceOptions,
): ModelRuntimeHealthService {
  const logger = options.logger ?? noopLogger;

  return {
    async listRuntimeHealth(filters) {
      const result = await options.repository.list(filters);
      return {
        ...result,
        items: result.items.map(mapRuntimeHealthRecord),
      };
    },

    async getRuntimeHealthModel(registryModelId) {
      const record = await options.repository.findByRegistryModelId(registryModelId);
      if (!record) {
        throw notFound("Runtime health state not found.");
      }
      return mapRuntimeHealthRecord(record);
    },

    async upsertRuntimeHealth(input) {
      await assertActiveRegistryModel(options.registryReader, input.registryModelId);
      const record = await options.repository.upsert(input);
      logger.info(
        {
          event: "model_runtime_health.state_upserted",
          actorUserId: input.actorUserId,
          registryModelId: input.registryModelId,
          status: record.status,
        },
        "Model runtime health state upserted",
      );
      return mapRuntimeHealthRecord(record);
    },

    async resetRuntimeHealth(input) {
      await assertActiveRegistryModel(options.registryReader, input.registryModelId);
      const record = await options.repository.reset(input);
      logger.info(
        {
          event: "model_runtime_health.state_reset",
          actorUserId: input.actorUserId,
          registryModelId: input.registryModelId,
        },
        "Model runtime health state reset",
      );
      return mapRuntimeHealthRecord(record);
    },

    async getRuntimeHealth(registryModelIds) {
      const uniqueRegistryModelIds = Array.from(new Set(registryModelIds));
      const records = await options.repository.findByRegistryModelIds(
        uniqueRegistryModelIds,
      );
      const recordsByRegistryModelId = new Map(
        records.map((record) => [record.registryModelId, record]),
      );
      const snapshots = new Map<string, ModelRuntimeHealthSnapshot>();
      for (const registryModelId of uniqueRegistryModelIds) {
        const record = recordsByRegistryModelId.get(registryModelId);
        snapshots.set(
          registryModelId,
          record
            ? toRuntimeHealthSnapshot(record)
            : {
                registryModelId,
                status: "unknown",
                cooldownUntil: null,
                checkedAt: null,
                reason: null,
              },
        );
      }
      return snapshots;
    },
  };
}

async function assertActiveRegistryModel(
  registryReader: ModelRuntimeHealthRegistryReader,
  registryModelId: string,
) {
  const registryModel = await registryReader.findById(registryModelId);
  if (!registryModel) {
    throw notFound("Registry model not found.");
  }
  if (registryModel.status !== "registered" || registryModel.archivedAt) {
    throw conflict("Runtime health can only be managed for registered models.");
  }
}

function mapRuntimeHealthRecord(record: ModelRuntimeHealthRecord): ModelRuntimeHealthDTO {
  return {
    id: record.id,
    registryModelId: record.registryModelId,
    status: record.status,
    cooldownUntil: record.cooldownUntil?.toISOString() ?? null,
    consecutiveFailures: record.consecutiveFailures,
    lastFailureCode: record.lastFailureCode,
    lastFailureAt: record.lastFailureAt?.toISOString() ?? null,
    lastSuccessAt: record.lastSuccessAt?.toISOString() ?? null,
    lastCheckedAt: record.lastCheckedAt?.toISOString() ?? null,
    reason: record.reason,
    updatedByUserId: record.updatedByUserId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toRuntimeHealthSnapshot(
  record: ModelRuntimeHealthRecord,
): ModelRuntimeHealthSnapshot {
  return {
    registryModelId: record.registryModelId,
    status: record.status,
    cooldownUntil: record.cooldownUntil,
    checkedAt: record.lastCheckedAt,
    reason: record.reason,
  };
}
