// Domain model types derived from docs/DATABASE.md

// ─── Users ────────────────────────────────────
export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

// ─── Devices ──────────────────────────────────
export type DeviceType = "browser" | "desktop_companion";

export interface Device {
  id: string;
  userId: string;
  deviceType: DeviceType;
  machineLabel: string | null;
  machineFingerprintHash: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

// ─── Providers ────────────────────────────────
export type ProviderStatus = "active" | "degraded" | "disabled";

export interface Provider {
  id: string;
  name: string;
  baseType: string;
  driverKey?: string;
  defaultSecretRef?: string | null;
  metadataJson?: Record<string, unknown> | null;
  status: ProviderStatus;
  priorityRank: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Models ───────────────────────────────────
export interface Model {
  id: string;
  providerId: string;
  name: string;
  externalModelKey: string;
  supportsChat: boolean;
  supportsAgent: boolean;
  supportsVision: boolean;
  contextWindow: number;
  priorityRank: number;
  active: boolean;
  adminStatus?: "active" | "disabled";
  runtimeStatus?: "healthy" | "rate_limited" | "open_circuit" | "auth_invalid";
  secretRef?: string | null;
  cooldownUntil?: string | null;
  requestsPerMinuteLimit?: number | null;
  tokensPerDayLimit?: number | null;
  tokensUsedToday?: number;
  tokensUsedDayBucket?: string | null;
  consecutiveFailures?: number;
  lastFailureCode?: string | null;
  lastFailureAt?: string | null;
  lastSuccessAt?: string | null;
  costInputPer1mUsdMicros?: number | null;
  costOutputPer1mUsdMicros?: number | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Conversations ────────────────────────────
export type ConversationMode = "chat" | "agent";

export interface Conversation {
  id: string;
  userId: string;
  mode: ConversationMode;
  title: string;
  archived: boolean;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Messages ─────────────────────────────────
export type MessageRole = "system" | "user" | "assistant" | "tool" | "status";

export type MessageContent =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image";
      data: string;
      filename: string;
      mimeType: "image/png" | "image/jpeg" | "image/webp";
      size: number;
    };

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  contentJson: MessageContent[];
  providerId: string | null;
  modelId: string | null;
  tokenEstimateIn: number | null;
  tokenEstimateOut: number | null;
  sequenceNo: number;
  createdAt: string;
}

// ─── Context Snapshots ────────────────────────
export interface ContextSnapshot {
  id: string;
  conversationId: string;
  agentRunId: string | null;
  summaryText: string;
  summaryJson: Record<string, unknown> | null;
  sourceMessageId: string | null;
  createdAt: string;
}

// ─── Workspaces ───────────────────────────────
export type WorkspaceStatus = "active" | "missing" | "disconnected";

export interface Workspace {
  id: string;
  userId: string;
  deviceId: string;
  alias: string;
  canonicalPathHash: string;
  displayPathHint: string | null;
  status: WorkspaceStatus;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Agent Runs ───────────────────────────────
export type AgentRunStatus =
  | "pending"
  | "planning"
  | "executing"
  | "waiting_for_companion"
  | "switching_model"
  | "completed"
  | "stopped_by_user"
  | "blocked_capacity"
  | "failed_internal";

export type AgentStopReason =
  | "completed"
  | "stopped_by_user"
  | "blocked_capacity"
  | "failed_internal"
  | "companion_disconnected";

export interface AgentRun {
  id: string;
  conversationId: string;
  workspaceId: string;
  objective: string;
  status: AgentRunStatus;
  startedAt: string | null;
  endedAt: string | null;
  finalSummary: string | null;
  stopReason: AgentStopReason | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Agent Run Events ─────────────────────────
export type AgentRunEventType =
  | "state_changed"
  | "tool_requested"
  | "tool_result"
  | "file_changed"
  | "command_output"
  | "provider_switched"
  | "error"
  | "summary";

export interface AgentRunEvent {
  id: string;
  agentRunId: string;
  eventType: AgentRunEventType;
  payloadJson: Record<string, unknown>;
  sequenceNo: number;
  createdAt: string;
}

// ─── File Operations ──────────────────────────
export type FileOperationType = "read" | "create" | "update" | "delete" | "move";
export type FileOperationStatus = "success" | "denied" | "failed";

export interface FileOperation {
  id: string;
  agentRunId: string;
  operationType: FileOperationType;
  relativePath: string;
  targetRelativePath: string | null;
  status: FileOperationStatus;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
}

// ─── Command Executions ───────────────────────
export interface CommandExecution {
  id: string;
  agentRunId: string;
  commandText: string;
  workingDirectoryRelative: string;
  exitCode: number | null;
  stdoutExcerpt: string | null;
  stderrExcerpt: string | null;
  durationMs: number | null;
  createdAt: string;
}

// ─── Provider Attempts ────────────────────────
export type ProviderAttemptStatus = "success" | "failed" | "switched";

export type FailureCode =
  | "rate_limited_transient"
  | "quota_exhausted"
  | "provider_unreachable"
  | "provider_5xx"
  | "invalid_response"
  | "auth_invalid"
  | "policy_blocked";

export interface ProviderAttempt {
  id: string;
  conversationId: string | null;
  agentRunId: string | null;
  providerId: string;
  modelId: string;
  attemptNo: number;
  status: ProviderAttemptStatus;
  failureCode: FailureCode | null;
  latencyMs: number | null;
  startedAt: string;
  endedAt: string | null;
}

// ─── Audit Events ─────────────────────────────
export type AuditEventType =
  | "login"
  | "logout"
  | "folder_selected"
  | "file_created"
  | "file_updated"
  | "file_deleted"
  | "file_moved"
  | "command_executed"
  | "provider_switched"
  | "companion_paired"
  | "companion_revoked"
  | "companion_connected"
  | "companion_disconnected"
  | "config_changed"
  | "boundary_violation";

export interface AuditEvent {
  id: string;
  userId: string;
  deviceId: string | null;
  eventType: AuditEventType;
  subjectType: string;
  subjectId: string;
  payloadJson: Record<string, unknown> | null;
  createdAt: string;
}
