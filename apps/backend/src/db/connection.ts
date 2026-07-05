/**
 * Lazy database connection helpers.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!dbInstance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not configured");
    }

    const queryClient = postgres(connectionString);
    dbInstance = drizzle(queryClient, { schema });
  }

  return dbInstance;
}

export function createMigrationClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  const migrationClient = postgres(connectionString, { max: 1 });
  return drizzle(migrationClient, { schema });
}
