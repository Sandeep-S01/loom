/**
 * Seed script — bootstraps provider/model catalog and default user.
 * Per docs/DATABASE.md §5: "Keep provider/model configuration seedable via admin bootstrap scripts."
 *
 * Run with: pnpm --filter @clm/backend db:seed
 */

import bcrypt from "bcryptjs";
const { hashSync } = bcrypt;
import { sql } from "drizzle-orm";
import { loadBackendEnv } from "../config/load-env.js";
import { getDb } from "./connection.js";
import { users, providers, models } from "./schema.js";
import { generateId } from "@clm/shared-utils";

loadBackendEnv();

async function seed() {
  const db = getDb();
  console.log("🌱 Seeding database...\n");

  // ─── Default User (V1 single-user) ─────────
  const userId = generateId("user");
  const email = process.env.DEFAULT_USER_EMAIL ?? "user@clm.local";
  const password = process.env.DEFAULT_USER_PASSWORD ?? "changeme";
  const passwordHash = hashSync(password, 10);

  await db
    .insert(users)
    .values({
      id: userId,
      email,
      displayName: "Primary User",
      passwordHash,
      role: "admin",
    })
    .onConflictDoNothing();

  console.log(`  ✓ User: ${email}`);

  // ─── Providers ──────────────────────────────
  const openrouterId = "prv_openrouter";
  const geminiId = "prv_gemini";

  await db
    .insert(providers)
    .values([
      {
        id: openrouterId,
        name: "OpenRouter",
        baseType: "openrouter",
        driverKey: "openrouter",
        defaultSecretRef: "OPENROUTER_API_KEY",
        status: "active",
        priorityRank: 1,
      },
      {
        id: geminiId,
        name: "Google Gemini",
        baseType: "gemini",
        driverKey: "gemini",
        defaultSecretRef: "GEMINI_API_KEY",
        status: "active",
        priorityRank: 2,
      },
    ])
    .onConflictDoUpdate({
      target: providers.id,
      set: {
        name: sql`excluded.name`,
        baseType: sql`excluded.base_type`,
        driverKey: sql`excluded.driver_key`,
        defaultSecretRef: sql`excluded.default_secret_ref`,
        status: sql`excluded.status`,
        priorityRank: sql`excluded.priority_rank`,
      },
    });

  console.log("  ✓ Providers: OpenRouter, Google Gemini");

  // ─── Models ─────────────────────────────────
  await db
    .insert(models)
    .values([
      // OpenRouter free models
      {
        id: "mdl_deepseek_chat_free",
        providerId: openrouterId,
        name: "DeepSeek Chat",
        externalModelKey: "deepseek/deepseek-chat-v3-0324",
        supportsChat: true,
        supportsAgent: true,
        supportsVision: false,
        contextWindow: 131072,
        priorityRank: 1,
        active: true,
        adminStatus: "active",
        runtimeStatus: "healthy",
        secretRef: null,
        costTier: "paid",
        costInputPer1mUsdMicros: 240000,
        costOutputPer1mUsdMicros: 900000,
      },
      {
        id: "mdl_qwen3_30b_free",
        providerId: openrouterId,
        name: "Qwen3 30B A3B",
        externalModelKey: "qwen/qwen3-30b-a3b",
        supportsChat: true,
        supportsAgent: true,
        supportsVision: false,
        contextWindow: 131072,
        priorityRank: 2,
        active: true,
        adminStatus: "active",
        runtimeStatus: "healthy",
        secretRef: null,
        costTier: "paid",
        costInputPer1mUsdMicros: 120000,
        costOutputPer1mUsdMicros: 500000,
      },
      // Gemini free models
      {
        id: "mdl_gemini_2_flash",
        providerId: geminiId,
        name: "Gemini 2.0 Flash",
        externalModelKey: "gemini-2.0-flash",
        supportsChat: true,
        supportsAgent: true,
        supportsVision: true,
        contextWindow: 1048576,
        priorityRank: 3,
        active: true,
        adminStatus: "active",
        runtimeStatus: "healthy",
        secretRef: null,
      },
      {
        id: "mdl_gemini_2_flash_lite",
        providerId: geminiId,
        name: "Gemini 2.0 Flash-Lite",
        externalModelKey: "gemini-2.0-flash-lite",
        supportsChat: true,
        supportsAgent: false,
        supportsVision: true,
        contextWindow: 1048576,
        priorityRank: 4,
        active: true,
        adminStatus: "active",
        runtimeStatus: "healthy",
        secretRef: null,
      },
    ])
    .onConflictDoUpdate({
      target: models.id,
      set: {
        providerId: sql`excluded.provider_id`,
        name: sql`excluded.name`,
        externalModelKey: sql`excluded.external_model_key`,
        supportsChat: sql`excluded.supports_chat`,
        supportsAgent: sql`excluded.supports_agent`,
        supportsVision: sql`excluded.supports_vision`,
        contextWindow: sql`excluded.context_window`,
        priorityRank: sql`excluded.priority_rank`,
        active: sql`excluded.active`,
        adminStatus: sql`excluded.admin_status`,
        runtimeStatus: sql`excluded.runtime_status`,
        secretRef: sql`excluded.secret_ref`,
      },
    });

  console.log("  ✓ Models: DeepSeek Chat, Qwen3 30B, Gemini 2.0 Flash, Gemini 2.0 Flash-Lite");

  console.log("\n✅ Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
