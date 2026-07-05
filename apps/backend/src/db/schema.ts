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
} from "drizzle-orm/pg-core";

// ─── 2.1 users ────────────────────────────────
export const users = pgTable("users", {
  id: varchar("id", { length: 50 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

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
  status: varchar("status", { length: 20 }).notNull().default("active"), // 'active' | 'degraded' | 'disabled'
  priorityRank: integer("priority_rank").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── 2.4 models ───────────────────────────────
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_models_provider_active").on(table.providerId, table.active),
    index("idx_models_agent_active_priority").on(
      table.supportsAgent,
      table.active,
      table.priorityRank,
    ),
  ],
);

// ─── 2.5 conversations ───────────────────────
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
    index("idx_messages_conversation_sequence").on(
      table.conversationId,
      table.sequenceNo,
    ),
  ],
);

// ─── 2.7 context_snapshots ────────────────────
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
