import { notFound } from "../../lib/http-errors.js";
import type {
  ProviderHealthDTO,
  ProviderHealthRecord,
  ProviderHealthSnapshot,
} from "./domain.js";
import type {
  ProviderHealthLogger,
  ProviderHealthProviderReader,
  ProviderHealthRepository,
  ProviderHealthService,
} from "./interfaces.js";

interface CreateProviderHealthServiceOptions {
  repository: ProviderHealthRepository;
  providerReader: ProviderHealthProviderReader;
  logger?: ProviderHealthLogger;
}

const noopLogger: ProviderHealthLogger = {
  info() {},
  warn() {},
  error() {},
};

export function createProviderHealthService(
  options: CreateProviderHealthServiceOptions,
): ProviderHealthService {
  const logger = options.logger ?? noopLogger;

  return {
    async listProviderHealth(filters) {
      const result = await options.repository.list(filters);
      return {
        ...result,
        items: result.items.map(mapProviderHealthRecord),
      };
    },

    async getProviderHealthModel(providerId) {
      const record = await options.repository.findByProviderId(providerId);
      if (!record) {
        throw notFound("Provider health state not found.");
      }
      return mapProviderHealthRecord(record);
    },

    async upsertProviderHealth(input) {
      await assertProviderExists(options.providerReader, input.providerId);
      const record = await options.repository.upsert(input);
      logger.info(
        {
          event: "provider_health.state_upserted",
          actorUserId: input.actorUserId,
          providerId: input.providerId,
          status: record.status,
        },
        "Provider health state upserted",
      );
      return mapProviderHealthRecord(record);
    },

    async resetProviderHealth(input) {
      await assertProviderExists(options.providerReader, input.providerId);
      const record = await options.repository.reset(input);
      logger.info(
        {
          event: "provider_health.state_reset",
          actorUserId: input.actorUserId,
          providerId: input.providerId,
        },
        "Provider health state reset",
      );
      return mapProviderHealthRecord(record);
    },

    async getProviderHealth(providerIds) {
      const uniqueProviderIds = Array.from(new Set(providerIds));
      const records = await options.repository.findByProviderIds(uniqueProviderIds);
      const recordsByProviderId = new Map(
        records.map((record) => [record.providerId, record]),
      );
      const snapshots = new Map<string, ProviderHealthSnapshot>();
      for (const providerId of uniqueProviderIds) {
        const record = recordsByProviderId.get(providerId);
        snapshots.set(
          providerId,
          record
            ? toProviderHealthSnapshot(record)
            : {
                providerId,
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

async function assertProviderExists(
  providerReader: ProviderHealthProviderReader,
  providerId: string,
) {
  const provider = await providerReader.findById(providerId);
  if (!provider) {
    throw notFound("Provider not found.");
  }
}

function mapProviderHealthRecord(record: ProviderHealthRecord): ProviderHealthDTO {
  return {
    id: record.id,
    providerId: record.providerId,
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

function toProviderHealthSnapshot(record: ProviderHealthRecord): ProviderHealthSnapshot {
  return {
    providerId: record.providerId,
    status: record.status,
    cooldownUntil: record.cooldownUntil,
    checkedAt: record.lastCheckedAt,
    reason: record.reason,
  };
}
