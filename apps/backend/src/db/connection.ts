/**
 * Lazy database connection helpers.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema.js";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let queryClient: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!dbInstance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not configured");
    }

    queryClient = postgres(connectionString, {
      connect_timeout: getPositiveEnvInt("DATABASE_CONNECT_TIMEOUT_SECONDS", 5),
    });
    dbInstance = drizzle(queryClient, { schema });
  }

  return dbInstance;
}

export async function checkDatabaseConnection() {
  await getDb().execute(sql`select 1`);
}

export async function closeDatabaseConnection() {
  const client = queryClient;
  queryClient = null;
  dbInstance = null;
  if (client) {
    await client.end({ timeout: 5 });
  }
}

export function createMigrationClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  const migrationClient = postgres(connectionString, { max: 1 });
  return drizzle(migrationClient, { schema });
}

function getPositiveEnvInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
