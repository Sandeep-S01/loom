// WebSocket/SSE event types derived from docs/API.md §4

// ─── Chat Stream Events ──────────────────────
export interface MessageStartedEvent {
  type: "message.started";
  conversationId: string;
  messageId: string;
  modelId: string;
}

export interface MessageDeltaEvent {
  type: "message.delta";
  conversationId: string;
  messageId: string;
  delta: string;
}

export interface MessageCompletedEvent {
  type: "message.completed";
  conversationId: string;
  messageId: string;
}

export interface ProviderSwitchedEvent {
  type: "provider.switched";
  conversationId: string;
  fromModel: string;
  toModel: string;
  reason: string;
}

export interface ConversationBlockedCapacityEvent {
  type: "conversation.blocked_capacity";
  conversationId: string;
  message: string;
}

export interface ConversationErrorEvent {
  type: "conversation.error";
  conversationId: string;
  code: string;
  message: string;
}

export type ChatStreamEvent =
  | MessageStartedEvent
  | MessageDeltaEvent
  | MessageCompletedEvent
  | ProviderSwitchedEvent
  | ConversationBlockedCapacityEvent
  | ConversationErrorEvent;

// ─── Agent Stream Events ─────────────────────
export interface RunStartedEvent {
  type: "run.started";
  runId: string;
  workspaceId: string;
}

export interface RunStateChangedEvent {
  type: "run.state_changed";
  runId: string;
  fromState: string;
  toState: string;
}

export interface RunToolRequestedEvent {
  type: "run.tool_requested";
  runId: string;
  requestId: string;
  tool: string;
  payload: Record<string, unknown>;
}

export interface RunToolResultEvent {
  type: "run.tool_result";
  runId: string;
  requestId: string;
  status: string;
  result: Record<string, unknown>;
  durationMs: number;
}

export interface RunFileChangedEvent {
  type: "run.file_changed";
  runId: string;
  operationType: string;
  relativePath: string;
}

export interface RunCommandOutputEvent {
  type: "run.command_output";
  runId: string;
  command: string;
  exitCode: number;
  stdoutExcerpt: string | null;
  stderrExcerpt: string | null;
}

export interface RunProviderSwitchedEvent {
  type: "run.provider_switched";
  runId: string;
  fromModel: string;
  toModel: string;
  reason: string;
}

export interface RunCompletedEvent {
  type: "run.completed";
  runId: string;
  summary: string;
}

export interface RunStoppedEvent {
  type: "run.stopped";
  runId: string;
  reason: string;
}

export interface RunBlockedCapacityEvent {
  type: "run.blocked_capacity";
  runId: string;
  message: string;
}

export type AgentStreamEvent =
  | RunStartedEvent
  | RunStateChangedEvent
  | RunToolRequestedEvent
  | RunToolResultEvent
  | RunFileChangedEvent
  | RunCommandOutputEvent
  | RunProviderSwitchedEvent
  | RunCompletedEvent
  | RunStoppedEvent
  | RunBlockedCapacityEvent;

// ─── Companion Connection Events ─────────────
export interface CompanionConnectedEvent {
  type: "companion.connected";
  deviceId: string;
  machineLabel: string;
}

export interface CompanionDisconnectedEvent {
  type: "companion.disconnected";
  deviceId: string;
}

export type CompanionEvent =
  | CompanionConnectedEvent
  | CompanionDisconnectedEvent;

// ─── Union ────────────────────────────────────
export type StreamEvent =
  | ChatStreamEvent
  | AgentStreamEvent
  | CompanionEvent;
