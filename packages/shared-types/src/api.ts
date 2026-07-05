// REST API request/response types derived from docs/API.md

import type {
  AgentRunStatus,
  Conversation,
  Message,
  User,
  WorkspaceStatus,
} from "./models.js";

// Session
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: Pick<User, "id" | "displayName">;
}

export interface SessionUserDto {
  id: string;
  displayName: string;
  email: string;
}

export interface SessionResponse {
  user: SessionUserDto;
}

// Dashboard
export interface DashboardConversationItem {
  id: string;
  mode: "chat" | "agent";
  title: string;
  lastMessageAt: string | null;
  updatedAt: string;
}

export interface DashboardRunItem {
  id: string;
  conversationId: string;
  workspaceId: string;
  objective: string;
  status: AgentRunStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardWorkspaceItem {
  id: string;
  alias: string;
  status: WorkspaceStatus;
  displayPathHint: string | null;
  lastUsedAt: string | null;
}

export interface DashboardCompanionStatus {
  connected: boolean;
  machineLabel: string | null;
}

export interface DashboardProviderSummary {
  eligibleCount: number;
  cooldownCount: number;
  lastExhaustedAt: string | null;
}

export interface DashboardResponse {
  recentConversations: DashboardConversationItem[];
  recentAgentRuns: DashboardRunItem[];
  activeWorkspace: DashboardWorkspaceItem | null;
  companion: DashboardCompanionStatus;
  providerSummary: DashboardProviderSummary;
}

// Conversations
export interface CreateConversationRequest {
  mode: "chat";
  title?: string;
}

export interface UpdateConversationRequest {
  title?: string;
  archived?: boolean;
}

export interface ConversationDetailResponse extends Conversation {
  messages: Message[];
}

export interface ConversationListItem {
  id: string;
  mode: "chat";
  title: string;
  lastMessageAt: string | null;
  updatedAt: string;
}

export interface ListConversationsResponse {
  conversations: ConversationListItem[];
}

export interface CreateConversationResponse {
  conversation: ConversationListItem;
}

export interface MessageItem {
  id: string;
  role: "system" | "user" | "assistant" | "tool" | "status";
  content: Array<{
    type: "text";
    text: string;
  }>;
  providerId?: string | null;
  modelId?: string | null;
  createdAt: string;
}

export interface ConversationMessagesResponse {
  conversation: {
    id: string;
    mode: "chat";
    title: string;
  };
  messages: MessageItem[];
}

// Messages
export interface SendMessageRequest {
  content: Array<{ type: "text"; text: string }>;
}

export interface SendMessageResponse {
  userMessage: {
    id: string;
    role: "user";
  };
  assistantMessage: MessageItem | null;
  provider: {
    providerId: string;
    modelId: string;
    modelName: string;
  } | null;
  providerSwitched: {
    switched: boolean;
    fromModelId: string;
    fromModelName: string;
    toModelId: string;
    toModelName: string;
    reason: string;
  } | null;
  capacityBlocked: boolean;
  error?: {
    code: string;
    message: string;
  };
}

// Companion Pairing
export interface PairStartResponse {
  pairingCode: string;
  expiresAt: string;
}

export interface PairCompleteRequest {
  pairingCode: string;
  machineLabel: string;
  machineFingerprintHash: string;
}

export interface PairCompleteResponse {
  deviceId: string;
  machineSessionToken: string;
}

export interface CompanionStatusResponse {
  connected: boolean;
  machineLabel: string | null;
  deviceId: string | null;
}

// Workspaces
export interface WorkspaceListItem {
  id: string;
  alias: string;
  machineId: string;
  status: string;
  displayPathHint: string | null;
}

export interface ListWorkspacesResponse {
  workspaces: WorkspaceListItem[];
}

export interface SelectWorkspaceRequest {
  machineId: string;
  alias: string;
  canonicalPathHash: string;
  displayPathHint?: string;
}

export interface SelectWorkspaceResponse {
  workspace: WorkspaceListItem;
}

// Agent Runs
export interface CreateAgentRunRequest {
  workspaceId: string;
  objective: string;
}

export interface CreateAgentRunResponse {
  runId: string;
  status: "pending";
  streamId: string;
}

// Providers
export interface ProviderModelStatus {
  id: string;
  eligible: boolean;
  cooldownUntil: string | null;
}

export interface ProviderStatusEntry {
  id: string;
  name: string;
  status: string;
  models: ProviderModelStatus[];
}

export interface ProvidersResponse {
  providers: ProviderStatusEntry[];
}

// Error Envelope
export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}
