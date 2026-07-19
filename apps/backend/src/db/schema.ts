/**
 * Drizzle ORM schema — all 14 tables from docs/DATABASE.md.
 *
 * Tables:
 *   users, devices, providers, models, conversations, messages,
 *   context_snapshots, workspaces, agent_runs, agent_run_events,
 *   file_operations, command_executions, provider_attempts, audit_events
 */

import {
  pgTable,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  date,
} from "drizzle-orm/pg-core";

// ─── 2.1 users ────────────────────────────────
export const users = pgTable("users", {
  id: varchar("id", { length: 50 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("customer"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const browserSessions = pgTable(
  "browser_sessions",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    userId: varchar("user_id", { length: 50 })
      .notNull()
      .references(() => users.id),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_browser_sessions_token_hash").on(table.tokenHash),
    index("idx_browser_sessions_user_expires").on(table.userId, table.expiresAt),
  ],
);

// ─── 2.2 devices ──────────────────────────────
export const devices = pgTable(
  "devices",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    userId: varchar("user_id", { length: 50 })
      .notNull()
      .references(() => users.id),
    deviceType: varchar("device_type", { length: 30 }).notNull(), // 'browser' | 'desktop_companion'
    machineLabel: varchar("machine_label", { length: 255 }),
    machineFingerprintHash: varchar("machine_fingerprint_hash", { length: 255 }),
    machineSessionTokenHash: varchar("machine_session_token_hash", { length: 255 }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_devices_user_id").on(table.userId),
  ],
);

// ─── 2.3 providers ────────────────────────────
export const providers = pgTable("providers", {
  id: varchar("id", { length: 50 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  baseType: varchar("base_type", { length: 50 }).notNull(),
  driverKey: varchar("driver_key", { length: 50 }).notNull().default("openrouter"),
  defaultSecretRef: varchar("default_secret_ref", { length: 255 }),
  metadataJson: jsonb("metadata_json"),
  status: varchar("status", { length: 20 }).notNull().default("active"), // 'active' | 'degraded' | 'disabled'
  priorityRank: integer("priority_rank").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── 2.4 models ───────────────────────────────
export const providerCredentials = pgTable(
  "provider_credentials",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    providerId: varchar("provider_id", { length: 50 })
      .notNull()
      .references(() => providers.id),
    secretRef: varchar("secret_ref", { length: 255 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("unchecked"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    lastFailureCode: varchar("last_failure_code", { length: 80 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_provider_credentials_provider_secret").on(
      table.providerId,
      table.secretRef,
    ),
    index("idx_provider_credentials_provider").on(table.providerId),
    index("idx_provider_credentials_status").on(table.status),
    index("idx_provider_credentials_last_checked").on(table.lastCheckedAt),
  ],
);

export const models = pgTable(
  "models",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    providerId: varchar("provider_id", { length: 50 })
      .notNull()
      .references(() => providers.id),
    name: varchar("name", { length: 255 }).notNull(),
    externalModelKey: varchar("external_model_key", { length: 255 }).notNull(),
    supportsChat: boolean("supports_chat").notNull().default(true),
    supportsAgent: boolean("supports_agent").notNull().default(false),
    supportsVision: boolean("supports_vision").notNull().default(false),
    contextWindow: integer("context_window").notNull().default(4096),
    priorityRank: integer("priority_rank").notNull().default(0),
    active: boolean("active").notNull().default(true),
    adminStatus: varchar("admin_status", { length: 20 }).notNull().default("active"),
    runtimeStatus: varchar("runtime_status", { length: 30 }).notNull().default("healthy"),
    secretRef: varchar("secret_ref", { length: 255 }),
    cooldownUntil: timestamp("cooldown_until", { withTimezone: true }),
    requestsPerMinuteLimit: integer("requests_per_minute_limit"),
    tokensPerDayLimit: integer("tokens_per_day_limit"),
    tokensUsedToday: integer("tokens_used_today").notNull().default(0),
    tokensUsedDayBucket: date("tokens_used_day_bucket"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    lastFailureCode: varchar("last_failure_code", { length: 40 }),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    costInputPer1mUsdMicros: integer("cost_input_per_1m_usd_micros"),
    costOutputPer1mUsdMicros: integer("cost_output_per_1m_usd_micros"),
    sourceType: varchar("source_type", { length: 30 }).notNull().default("manual"),
    costTier: varchar("cost_tier", { length: 20 }).notNull().default("unknown"),
    marketplaceStatus: varchar("marketplace_status", { length: 30 }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
    catalogMetadataJson: jsonb("catalog_metadata_json"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_models_provider_active").on(table.providerId, table.active),
    index("idx_models_admin_deleted").on(table.adminStatus, table.deletedAt),
    index("idx_models_agent_active_priority").on(
      table.supportsAgent,
      table.active,
      table.priorityRank,
    ),
  ],
);

// ─── 2.5 conversations ───────────────────────
export const modelCatalog = pgTable(
  "model_catalog",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    providerId: varchar("provider_id", { length: 50 })
      .notNull()
      .references(() => providers.id),
    externalModelKey: varchar("external_model_key", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    description: text("description"),
    supportsChat: boolean("supports_chat").notNull().default(false),
    supportsAgent: boolean("supports_agent").notNull().default(false),
    supportsVision: boolean("supports_vision").notNull().default(false),
    supportsToolUse: boolean("supports_tool_use").notNull().default(false),
    supportsJsonMode: boolean("supports_json_mode").notNull().default(false),
    capabilitiesJson: jsonb("capabilities_json").notNull(),
    contextWindow: integer("context_window"),
    maxOutputTokens: integer("max_output_tokens"),
    costTier: varchar("cost_tier", { length: 20 }).notNull().default("free"),
    pricingJson: jsonb("pricing_json").notNull(),
    releaseStage: varchar("release_stage", { length: 30 }).notNull().default("stable"),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    deprecatedAt: timestamp("deprecated_at", { withTimezone: true }),
    deprecationReason: text("deprecation_reason"),
    providerMetadataJson: jsonb("provider_metadata_json").notNull(),
    firstDiscoveredAt: timestamp("first_discovered_at", { withTimezone: true }).notNull(),
    lastDiscoveredAt: timestamp("last_discovered_at", { withTimezone: true }).notNull(),
    lastChangedAt: timestamp("last_changed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_model_catalog_provider_external").on(
      table.providerId,
      table.externalModelKey,
    ),
    index("idx_model_catalog_provider").on(table.providerId),
    index("idx_model_catalog_provider_deprecated").on(
      table.providerId,
      table.deprecatedAt,
    ),
    index("idx_model_catalog_capabilities").on(
      table.supportsChat,
      table.supportsAgent,
      table.supportsVision,
    ),
    index("idx_model_catalog_cost_tier").on(table.costTier),
    index("idx_model_catalog_release_stage").on(table.releaseStage),
    index("idx_model_catalog_last_discovered").on(table.lastDiscoveredAt),
  ],
);

export const modelRegistry = pgTable(
  "model_registry",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    catalogModelId: varchar("catalog_model_id", { length: 50 })
      .notNull()
      .references(() => modelCatalog.id),
    status: varchar("status", { length: 20 }).notNull().default("registered"),
    approvedByUserId: varchar("approved_by_user_id", { length: 50 })
      .notNull()
      .references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }).notNull(),
    archivedByUserId: varchar("archived_by_user_id", { length: 50 }).references(
      () => users.id,
    ),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archiveReason: text("archive_reason"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_model_registry_catalog").on(table.catalogModelId),
    index("idx_model_registry_status").on(table.status),
    index("idx_model_registry_approved_at").on(table.approvedAt),
    index("idx_model_registry_archived_at").on(table.archivedAt),
  ],
);

export const modelPolicy = pgTable(
  "model_policy",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    registryModelId: varchar("registry_model_id", { length: 50 })
      .notNull()
      .references(() => modelRegistry.id),
    enabled: boolean("enabled").notNull().default(true),
    visibleInSelector: boolean("visible_in_selector").notNull().default(true),
    priorityRank: integer("priority_rank").notNull().default(100),
    defaultForChat: boolean("default_for_chat").notNull().default(false),
    defaultForAgent: boolean("default_for_agent").notNull().default(false),
    requiresCompanion: boolean("requires_companion").notNull().default(false),
    requestsPerMinuteLimit: integer("requests_per_minute_limit"),
    tokensPerDayLimit: integer("tokens_per_day_limit"),
    tokensPerRequestLimit: integer("tokens_per_request_limit"),
    notes: text("notes"),
    createdByUserId: varchar("created_by_user_id", { length: 50 })
      .notNull()
      .references(() => users.id),
    updatedByUserId: varchar("updated_by_user_id", { length: 50 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_model_policy_registry_model").on(table.registryModelId),
    index("idx_model_policy_enabled").on(table.enabled),
    index("idx_model_policy_visible").on(table.visibleInSelector),
    index("idx_model_policy_priority").on(table.priorityRank),
    index("idx_model_policy_updated_at").on(table.updatedAt),
  ],
);

export const modelRuntimeState = pgTable(
  "model_runtime_state",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    registryModelId: varchar("registry_model_id", { length: 50 })
      .notNull()
      .references(() => modelRegistry.id),
    status: varchar("status", { length: 30 }).notNull().default("unknown"),
    cooldownUntil: timestamp("cooldown_until", { withTimezone: true }),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    lastFailureCode: varchar("last_failure_code", { length: 80 }),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    reason: text("reason"),
    updatedByUserId: varchar("updated_by_user_id", { length: 50 }).references(
      () => users.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_model_runtime_state_registry_model").on(table.registryModelId),
    index("idx_model_runtime_state_status").on(table.status),
    index("idx_model_runtime_state_cooldown").on(table.cooldownUntil),
    index("idx_model_runtime_state_last_checked").on(table.lastCheckedAt),
    index("idx_model_runtime_state_updated").on(table.updatedAt),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    userId: varchar("user_id", { length: 50 })
      .notNull()
      .references(() => users.id),
    mode: varchar("mode", { length: 10 }).notNull().default("chat"), // 'chat' | 'agent'
    title: varchar("title", { length: 500 }).notNull().default("New Conversation"),
    archived: boolean("archived").notNull().default(false),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_conversations_user_updated").on(table.userId, table.updatedAt),
    index("idx_conversations_user_archived_updated").on(
      table.userId,
      table.archived,
      table.updatedAt,
    ),
  ],
);

// ─── 2.6 messages ─────────────────────────────
export const messages = pgTable(
  "messages",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    conversationId: varchar("conversation_id", { length: 50 })
      .notNull()
      .references(() => conversations.id),
    role: varchar("role", { length: 20 }).notNull(), // 'system' | 'user' | 'assistant' | 'tool' | 'status'
    contentJson: jsonb("content_json").notNull(),
    providerId: varchar("provider_id", { length: 50 }).references(() => providers.id),
    modelId: varchar("model_id", { length: 50 }).references(() => models.id),
    tokenEstimateIn: integer("token_estimate_in"),
    tokenEstimateOut: integer("token_estimate_out"),
    sequenceNo: integer("sequence_no").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_messages_conversation_sequence").on(
      table.conversationId,
      table.sequenceNo,
    ),
  ],
);

// ─── 2.7 context_snapshots ────────────────────
export const chatIdempotencyKeys = pgTable(
  "chat_idempotency_keys",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    userId: varchar("user_id", { length: 50 })
      .notNull()
      .references(() => users.id),
    conversationId: varchar("conversation_id", { length: 50 })
      .notNull()
      .references(() => conversations.id),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("processing"),
    requestId: varchar("request_id", { length: 120 }).notNull(),
    responseJson: jsonb("response_json"),
    errorCode: varchar("error_code", { length: 80 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_chat_idempotency_scope").on(
      table.userId,
      table.conversationId,
      table.idempotencyKey,
    ),
    index("idx_chat_idempotency_expires").on(table.expiresAt),
  ],
);

export const contextSnapshots = pgTable("context_snapshots", {
  id: varchar("id", { length: 50 }).primaryKey(),
  conversationId: varchar("conversation_id", { length: 50 })
    .notNull()
    .references(() => conversations.id),
  agentRunId: varchar("agent_run_id", { length: 50 }),
  summaryText: text("summary_text").notNull(),
  summaryJson: jsonb("summary_json"),
  sourceMessageId: varchar("source_message_id", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── 2.8 workspaces ──────────────────────────
export const workspaces = pgTable(
  "workspaces",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    userId: varchar("user_id", { length: 50 })
      .notNull()
      .references(() => users.id),
    deviceId: varchar("device_id", { length: 50 })
      .notNull()
      .references(() => devices.id),
    alias: varchar("alias", { length: 255 }).notNull(),
    canonicalPathHash: varchar("canonical_path_hash", { length: 255 }).notNull(),
    displayPathHint: varchar("display_path_hint", { length: 1000 }),
    status: varchar("status", { length: 20 }).notNull().default("active"), // 'active' | 'missing' | 'disconnected'
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_workspaces_user_last_used").on(table.userId, table.lastUsedAt),
    uniqueIndex("uq_workspaces_user_device_path").on(
      table.userId,
      table.deviceId,
      table.canonicalPathHash,
    ),
  ],
);

// ─── 2.9 agent_runs ──────────────────────────
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    conversationId: varchar("conversation_id", { length: 50 })
      .notNull()
      .references(() => conversations.id),
    workspaceId: varchar("workspace_id", { length: 50 })
      .notNull()
      .references(() => workspaces.id),
    objective: text("objective").notNull(),
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    finalSummary: text("final_summary"),
    stopReason: varchar("stop_reason", { length: 30 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_agent_runs_workspace_created").on(table.workspaceId, table.createdAt),
    index("idx_agent_runs_status_created").on(table.status, table.createdAt),
  ],
);

// ─── 2.10 agent_run_events ────────────────────
export const agentRunEvents = pgTable(
  "agent_run_events",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    agentRunId: varchar("agent_run_id", { length: 50 })
      .notNull()
      .references(() => agentRuns.id),
    eventType: varchar("event_type", { length: 30 }).notNull(),
    payloadJson: jsonb("payload_json").notNull(),
    sequenceNo: integer("sequence_no").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_agent_run_events_run_sequence").on(
      table.agentRunId,
      table.sequenceNo,
    ),
  ],
);

// ─── 2.11 file_operations ─────────────────────
export const fileOperations = pgTable(
  "file_operations",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    agentRunId: varchar("agent_run_id", { length: 50 })
      .notNull()
      .references(() => agentRuns.id),
    operationType: varchar("operation_type", { length: 20 }).notNull(), // 'read' | 'create' | 'update' | 'delete' | 'move'
    relativePath: varchar("relative_path", { length: 1000 }).notNull(),
    targetRelativePath: varchar("target_relative_path", { length: 1000 }),
    status: varchar("status", { length: 20 }).notNull(), // 'success' | 'denied' | 'failed'
    metadataJson: jsonb("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_file_operations_run_created").on(table.agentRunId, table.createdAt),
  ],
);

// ─── 2.12 command_executions ──────────────────
export const commandExecutions = pgTable(
  "command_executions",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    agentRunId: varchar("agent_run_id", { length: 50 })
      .notNull()
      .references(() => agentRuns.id),
    commandText: text("command_text").notNull(),
    workingDirectoryRelative: varchar("working_directory_relative", { length: 1000 }).notNull(),
    exitCode: integer("exit_code"),
    stdoutExcerpt: text("stdout_excerpt"),
    stderrExcerpt: text("stderr_excerpt"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_command_executions_run_created").on(table.agentRunId, table.createdAt),
  ],
);

// ─── 2.13 provider_attempts ───────────────────
export const providerAttempts = pgTable(
  "provider_attempts",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    conversationId: varchar("conversation_id", { length: 50 }).references(
      () => conversations.id,
    ),
    agentRunId: varchar("agent_run_id", { length: 50 }).references(
      () => agentRuns.id,
    ),
    providerId: varchar("provider_id", { length: 50 })
      .notNull()
      .references(() => providers.id),
    modelId: varchar("model_id", { length: 50 })
      .notNull()
      .references(() => models.id),
    attemptNo: integer("attempt_no").notNull(),
    status: varchar("status", { length: 20 }).notNull(), // 'success' | 'failed' | 'switched'
    failureCode: varchar("failure_code", { length: 40 }),
    latencyMs: integer("latency_ms"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_provider_attempts_provider_started").on(
      table.providerId,
      table.startedAt,
    ),
    index("idx_provider_attempts_run_started").on(
      table.agentRunId,
      table.startedAt,
    ),
    index("idx_provider_attempts_conversation_started").on(
      table.conversationId,
      table.startedAt,
    ),
  ],
);

export const modelUsageEvents = pgTable(
  "model_usage_events",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    conversationId: varchar("conversation_id", { length: 50 }).references(
      () => conversations.id,
    ),
    messageId: varchar("message_id", { length: 50 }).references(() => messages.id),
    providerId: varchar("provider_id", { length: 50 })
      .notNull()
      .references(() => providers.id),
    modelId: varchar("model_id", { length: 50 })
      .notNull()
      .references(() => models.id),
    attemptNo: integer("attempt_no").notNull(),
    wasManualSelection: boolean("was_manual_selection").notNull().default(false),
    wasFailover: boolean("was_failover").notNull().default(false),
    requestKind: varchar("request_kind", { length: 20 }).notNull(),
    status: varchar("status", { length: 30 }).notNull(),
    failureCode: varchar("failure_code", { length: 40 }),
    latencyMs: integer("latency_ms"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    costUsdMicros: integer("cost_usd_micros").notNull().default(0),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_model_usage_events_model_created").on(table.modelId, table.createdAt),
    index("idx_model_usage_events_conversation_created").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export const modelUsageRollups = pgTable(
  "model_usage_rollups",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    modelId: varchar("model_id", { length: 50 })
      .notNull()
      .references(() => models.id),
    bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
    bucketGranularity: varchar("bucket_granularity", { length: 10 }).notNull(),
    requestCount: integer("request_count").notNull().default(0),
    successCount: integer("success_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    rateLimitCount: integer("rate_limit_count").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    costUsdMicros: integer("cost_usd_micros").notNull().default(0),
  },
  (table) => [
    uniqueIndex("uq_model_usage_rollups_bucket").on(
      table.modelId,
      table.bucketStart,
      table.bucketGranularity,
    ),
    index("idx_model_usage_rollups_bucket").on(table.bucketStart, table.bucketGranularity),
  ],
);

// ─── 2.14 audit_events ───────────────────────
export const auditEvents = pgTable(
  "audit_events",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    userId: varchar("user_id", { length: 50 })
      .notNull()
      .references(() => users.id),
    deviceId: varchar("device_id", { length: 50 }).references(() => devices.id),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    subjectType: varchar("subject_type", { length: 50 }).notNull(),
    subjectId: varchar("subject_id", { length: 50 }).notNull(),
    payloadJson: jsonb("payload_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_audit_events_user_created").on(table.userId, table.createdAt),
    index("idx_audit_events_type_created").on(table.eventType, table.createdAt),
  ],
);
