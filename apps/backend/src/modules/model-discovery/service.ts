import { badRequest, conflict, notFound } from "../../lib/http-errors.js";
import type { UpsertDiscoveredModelInput } from "../model-catalog/domain.js";
import type {
  DiscoveredProviderModel,
  DiscoveryJobDTO,
  DiscoveryJobRecord,
  DiscoveryProviderReference,
  ProviderSyncStatusDTO,
  ProviderSyncStatusRecord,
} from "./domain.js";
import type {
  CreateModelDiscoveryServiceOptions,
  ModelDiscoveryLogger,
  ModelDiscoveryService,
} from "./interfaces.js";

const noopLogger: ModelDiscoveryLogger = {
  info() {},
  warn() {},
  error() {},
};

export function createModelDiscoveryService(
  options: CreateModelDiscoveryServiceOptions,
): ModelDiscoveryService {
  const logger = options.logger ?? noopLogger;

  return {
    async listJobs(filters) {
      const result = await options.jobRepository.list(filters);
      return {
        ...result,
        items: result.items.map(mapJob),
      };
    },

    async getJob(jobId) {
      const job = await options.jobRepository.findById(jobId);
      if (!job) {
        throw notFound("Discovery job not found.");
      }
      return mapJob(job);
    },

    async listProviderSyncStatus(filters) {
      const result = await options.syncStatusRepository.list(filters);
      return {
        ...result,
        items: result.items.map(mapSyncStatus),
      };
    },

    async getProviderSyncStatus(providerId) {
      const status = await options.syncStatusRepository.findByProviderId(providerId);
      if (!status) {
        throw notFound("Provider sync status not found.");
      }
      return mapSyncStatus(status);
    },

    async runProviderDiscovery(input) {
      const provider = await resolveDiscoverableProvider(
        options.providerReader,
        input.providerId,
      );
      const adapter = options.adapterRegistry.getAdapter(provider.driverKey);
      if (!adapter) {
        throw conflict("No discovery adapter is registered for this provider.");
      }

      const job = await options.jobRepository.create(input);
      await options.syncStatusRepository.upsert({
        providerId: provider.id,
        lastJobId: job.id,
        status: "syncing",
        startedAt: job.startedAt,
        failureCode: null,
        failureMessage: null,
      });

      try {
        const discoveredAt = new Date();
        const discoveredModels = await adapter.discoverFreeModels(provider);
        const freeModels = discoveredModels.filter((model) => model.costTier === "free");
        const catalogInputs = freeModels.map((model) =>
          toCatalogInput(provider.id, model, discoveredAt),
        );

        const upsertResult =
          catalogInputs.length === 0
            ? { upsertedCount: 0 }
            : await options.catalogService.upsertDiscoveredModels({
                providerId: provider.id,
                models: catalogInputs,
              });
        const completedAt = new Date();
        const skippedCount = discoveredModels.length - freeModels.length;
        const updatedJob = await options.jobRepository.update(job.id, {
          status: "succeeded",
          completedAt,
          discoveredCount: discoveredModels.length,
          upsertedCount: upsertResult.upsertedCount,
          skippedCount,
          failureCode: null,
          failureMessage: null,
          metadata: {
            providerName: provider.name,
            driverKey: provider.driverKey,
            freeOnly: true,
          },
        });

        await options.syncStatusRepository.upsert({
          providerId: provider.id,
          lastJobId: job.id,
          status: "succeeded",
          succeededAt: completedAt,
          failureCode: null,
          failureMessage: null,
          discoveredCount: discoveredModels.length,
          upsertedCount: upsertResult.upsertedCount,
        });

        logger.info(
          {
            event: "model_discovery.job_succeeded",
            providerId: provider.id,
            discoveryJobId: job.id,
            discoveredCount: discoveredModels.length,
            upsertedCount: upsertResult.upsertedCount,
            skippedCount,
          },
          "Model discovery job succeeded",
        );

        return mapJob(requireUpdatedJob(updatedJob));
      } catch (error) {
        const completedAt = new Date();
        const failure = normalizeDiscoveryFailure(error);
        const updatedJob = await options.jobRepository.update(job.id, {
          status: "failed",
          completedAt,
          failureCode: failure.code,
          failureMessage: failure.message,
          metadata: {
            providerName: provider.name,
            driverKey: provider.driverKey,
            freeOnly: true,
          },
        });

        await options.syncStatusRepository.upsert({
          providerId: provider.id,
          lastJobId: job.id,
          status: "failed",
          failedAt: completedAt,
          failureCode: failure.code,
          failureMessage: failure.message,
        });

        logger.error(
          {
            event: "model_discovery.job_failed",
            providerId: provider.id,
            discoveryJobId: job.id,
            failureCode: failure.code,
          },
          "Model discovery job failed",
        );

        return mapJob(requireUpdatedJob(updatedJob));
      }
    },
  };
}

async function resolveDiscoverableProvider(
  providerReader: CreateModelDiscoveryServiceOptions["providerReader"],
  providerId: string,
) {
  if (!providerId.trim()) {
    throw badRequest("providerId is required.");
  }

  const provider = await providerReader.findById(providerId);
  if (!provider) {
    throw notFound("Provider not found.");
  }
  if (provider.status !== "active") {
    throw conflict("Provider must be active before discovery can run.");
  }
  if (!supportsDiscovery(provider)) {
    throw conflict("Provider does not support discovery.");
  }
  return provider;
}

function toCatalogInput(
  providerId: string,
  model: DiscoveredProviderModel,
  discoveredAt: Date,
): UpsertDiscoveredModelInput {
  return {
    ...model,
    providerId,
    discoveredAt,
  };
}

function supportsDiscovery(provider: DiscoveryProviderReference) {
  const metadata = provider.metadataJson;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  return (metadata as { supportsDiscovery?: unknown }).supportsDiscovery === true;
}

function normalizeDiscoveryFailure(error: unknown) {
  if (error instanceof Error) {
    return {
      code: normalizeFailureCode(error.message),
      message: error.message,
    };
  }
  return {
    code: "discovery_failed",
    message: "Discovery failed.",
  };
}

function normalizeFailureCode(message: string) {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "discovery_failed";
}

function requireUpdatedJob(job: DiscoveryJobRecord | null) {
  if (!job) {
    throw conflict("Discovery job changed while updating state.");
  }
  return job;
}

function mapJob(record: DiscoveryJobRecord): DiscoveryJobDTO {
  return {
    id: record.id,
    providerId: record.providerId,
    status: record.status,
    triggerType: record.triggerType,
    startedAt: record.startedAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    discoveredCount: record.discoveredCount,
    upsertedCount: record.upsertedCount,
    skippedCount: record.skippedCount,
    failureCode: record.failureCode,
    failureMessage: record.failureMessage,
    createdByUserId: record.createdByUserId,
    metadata: record.metadata,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapSyncStatus(record: ProviderSyncStatusRecord): ProviderSyncStatusDTO {
  return {
    id: record.id,
    providerId: record.providerId,
    lastJobId: record.lastJobId,
    status: record.status,
    lastStartedAt: record.lastStartedAt?.toISOString() ?? null,
    lastSuccessAt: record.lastSuccessAt?.toISOString() ?? null,
    lastFailureAt: record.lastFailureAt?.toISOString() ?? null,
    lastFailureCode: record.lastFailureCode,
    lastFailureMessage: record.lastFailureMessage,
    lastDiscoveredCount: record.lastDiscoveredCount,
    lastUpsertedCount: record.lastUpsertedCount,
    updatedAt: record.updatedAt.toISOString(),
  };
}
