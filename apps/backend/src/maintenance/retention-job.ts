import type { FastifyInstance } from "fastify";
import type { RetentionCleanupService } from "./retention.js";

export function registerRetentionCleanupJob(
  app: FastifyInstance,
  service: RetentionCleanupService,
  options: { intervalMs: number; runOnStartup: boolean },
) {
  if (options.intervalMs <= 0 && !options.runOnStartup) {
    return;
  }

  let isRunning = false;
  async function cleanup(reason: "startup" | "interval") {
    if (isRunning) return;
    isRunning = true;
    try {
      const result = await service.run();
      app.log.info({ event: "retention.cleanup_completed", reason, ...result });
    } catch (error) {
      app.log.error({
        event: "retention.cleanup_failed",
        reason,
        error: error instanceof Error ? error.message : "Unknown cleanup error",
      });
    } finally {
      isRunning = false;
    }
  }

  const startupTimeout = options.runOnStartup
    ? setTimeout(() => void cleanup("startup"), 0)
    : null;
  startupTimeout?.unref?.();

  const interval = options.intervalMs > 0
    ? setInterval(() => void cleanup("interval"), options.intervalMs)
    : null;
  interval?.unref?.();

  app.addHook("onClose", async () => {
    if (startupTimeout) clearTimeout(startupTimeout);
    if (interval) clearInterval(interval);
  });
}
