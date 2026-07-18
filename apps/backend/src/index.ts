import { loadBackendEnv } from "./config/load-env.js";
import { validateProductionEnvironment } from "./config/validate-production-env.js";
import { buildLocalRuntimeApp, buildProductionApp } from "./app.js";
import { closeDatabaseConnection } from "./db/connection.js";
import { closeRedisConnection } from "./redis/client.js";

loadBackendEnv();
const useLocalRuntime = process.env.LOOM_LOCAL_RUNTIME === "true";
if (!useLocalRuntime) {
  validateProductionEnvironment();
}

const PORT = parseInt(process.env.BACKEND_PORT ?? "3001", 10);

async function main() {
  const app = useLocalRuntime ? buildLocalRuntimeApp() : buildProductionApp();
  let shuttingDown = false;

  async function shutdown(signal: NodeJS.Signals) {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ event: "service.shutdown", signal }, "Graceful shutdown started");

    const forceExit = setTimeout(() => {
      app.log.fatal({ event: "service.shutdown_timeout", signal }, "Graceful shutdown timed out");
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    try {
      await app.close();
      const results = useLocalRuntime
        ? []
        : await Promise.allSettled([
            closeDatabaseConnection(),
            closeRedisConnection(),
          ]);
      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length > 0) {
        app.log.error({ event: "service.shutdown_dependency_error", failures: failures.length });
        process.exitCode = 1;
      }
    } finally {
      clearTimeout(forceExit);
    }
  }

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));

  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    app.log.info({ event: "service.started", port: PORT }, "Backend listening");
  } catch (error) {
    app.log.error(error);
    if (!useLocalRuntime) {
      await Promise.allSettled([closeDatabaseConnection(), closeRedisConnection()]);
    }
    process.exit(1);
  }
}

main();
