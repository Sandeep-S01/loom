import type { FastifyInstance } from "fastify";
import type { ModelDiscoveryService } from "../model-discovery/interfaces.js";

interface ModelDiscoverySchedulerOptions {
  intervalMs: number;
  runOnStartup: boolean;
}

export function registerModelDiscoveryScheduler(
  app: FastifyInstance,
  modelDiscoveryService: ModelDiscoveryService,
  options: ModelDiscoverySchedulerOptions,
) {
  if (options.intervalMs <= 0 && !options.runOnStartup) {
    return;
  }

  let isRunning = false;

  async function run(reason: "startup" | "interval") {
    if (isRunning) {
      app.log.info({
        event: "scheduler.model_discovery_skipped",
        reason,
        skippedReason: "already_running",
      });
      return;
    }

    isRunning = true;
    try {
      const result = await modelDiscoveryService.runDiscoverableProvidersDiscovery({
        triggerType: reason === "startup" ? "internal" : "scheduled",
        actorUserId: null,
      });
      app.log.info({
        event: "scheduler.model_discovery_completed",
        reason,
        attemptedCount: result.attemptedCount,
        succeededCount: result.succeededCount,
        failedCount: result.failedCount,
      });
    } catch (error) {
      app.log.error({
        event: "scheduler.model_discovery_failed",
        reason,
        error: error instanceof Error ? error.message : "Unknown discovery scheduler error",
      });
    } finally {
      isRunning = false;
    }
  }

  const startupTimeout = options.runOnStartup
    ? setTimeout(() => void run("startup"), 0)
    : null;
  startupTimeout?.unref?.();

  const interval =
    options.intervalMs > 0
      ? setInterval(() => void run("interval"), options.intervalMs)
      : null;
  interval?.unref?.();

  app.addHook("onClose", async () => {
    if (startupTimeout) clearTimeout(startupTimeout);
    if (interval) clearInterval(interval);
  });
}
