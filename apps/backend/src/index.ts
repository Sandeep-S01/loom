import "dotenv/config";
import { buildProductionApp } from "./app.js";

const PORT = parseInt(process.env.BACKEND_PORT ?? "3001", 10);

async function main() {
  const app = buildProductionApp();

  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    app.log.info(`Backend listening on http://localhost:${PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

main();
