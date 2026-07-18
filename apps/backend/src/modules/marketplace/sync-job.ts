import type { FastifyInstance } from "fastify";
import type { MarketplaceService } from "./service.js";

interface MarketplaceSyncJobOptions {
  intervalMs: number;
  runOnStartup: boolean;
}

export function registerMarketplaceSyncJob(
  app: FastifyInstance,
  marketplaceService: MarketplaceService,
  options: MarketplaceSyncJobOptions,
) {
  if (options.intervalMs <= 0 && !options.runOnStartup) {
    return;
  }

  let isRunning = false;

  async function sync(reason: "startup" | "interval") {
    if (isRunning) {
      return;
    }

    isRunning = true;
    try {
      const result = await marketplaceService.syncOpenRouterFreeModels();
      app.log.info({
        event: "marketplace.free_models_synced",
        reason,
        importedCount: result.importedCount,
        updatedCount: result.updatedCount,
        removedCount: result.removedCount,
        totalCount: result.models.length,
      });
    } catch (error) {
      app.log.warn({
        event: "marketplace.free_models_sync_failed",
        reason,
        error: error instanceof Error ? error.message : "Unknown sync error",
      });
    } finally {
      isRunning = false;
    }
  }

  const startupTimeout = options.runOnStartup
    ? setTimeout(() => void sync("startup"), 0)
    : null;

  startupTimeout?.unref?.();

  const interval =
    options.intervalMs > 0
      ? setInterval(() => void sync("interval"), options.intervalMs)
      : null;

  if (interval) {
    interval.unref?.();
  }

  app.addHook("onClose", async () => {
    if (startupTimeout) {
      clearTimeout(startupTimeout);
    }
    if (interval) {
      clearInterval(interval);
    }
  });
}
