import "dotenv/config";
import { loadBackendEnv } from "./src/config/load-env.js";
import { defineConfig } from "drizzle-kit";

loadBackendEnv();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
