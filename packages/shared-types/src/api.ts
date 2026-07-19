// REST API request/response types derived from docs/API.md

import type {
  AgentRunStatus,
  Conversation,
  MessageContent,
  Message,
  User,
  WorkspaceStatus,
} from "./models.js";

// Session
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export type UserRole = "admin" | "customer";

export interface LoginResponse {
  user: Pick<User, "id" | "displayName" | "email"> & { role: UserRole };
}

export type RegisterResponse = LoginResponse;

export interface SessionUserDto {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
}

export interface SessionResponse {
  user: SessionUserDto;
}

export interface UpdateSessionRequest {
  displayName: string;
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

export interface UpdateConversationResponse {
  conversation: ConversationListItem;
}

export interface MessageItem {
  id: string;
  role: "system" | "user" | "assistant" | "tool" | "status";
  content: MessageContent[];
  providerId?: string | null;
  modelId?: string | null;
  registryModelId?: string | null;
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
export interface ChatContextBlockRequest {
  sourceType:
    | "workspace_file"
    | "selected_file"
    | "companion"
    | "attachment"
    | "summary"
    | "manual";
  path?: string;
  language?: string;
  content: string;
  lastModified?: string;
  sizeBytes?: number;
  priority?: number;
}

export interface ChatContextMetadata {
  workspaceContextUsed: boolean;
  includedContextCount: number;
  excludedContextCount: number;
  truncatedContext: boolean;
  estimatedPromptTokens: number;
  requestId?: string;
}

export interface SendMessageRequest {
  content: MessageContent[];
  modelId?: string;
  idempotencyKey?: string;
  workspaceId?: string;
  contextBlocks?: ChatContextBlockRequest[];
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
  routingTraceId?: string;
  capacityBlocked: boolean;
  context?: ChatContextMetadata;
  error?: {
    code: string;
    message: string;
    requestId?: string;
    retryAfterMs?: number;
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
  name: string;
  active: boolean;
  supportsChat: boolean;
  supportsAgent: boolean;
  eligible: boolean;
  inCooldown: boolean;
  cooldownUntil: string | null;
  effectiveStatus?: "active" | "disabled" | "rate_limited";
  availabilityReason?:
    | "connected"
    | "missing_key"
    | "invalid_key"
    | "degraded"
    | "unavailable"
    | "disabled"
    | "rate_limited";
}

export interface ProviderStatusEntry {
  id: string;
  name: string;
  baseType: string;
  status:
    | "connected"
    | "missing_key"
    | "invalid_key"
    | "degraded"
    | "unavailable"
    | "disabled";
  keyState: "configured" | "missing_key";
  keyConfigured: boolean;
  lastCheckedAt: string | null;
  models: ProviderModelStatus[];
}

export interface ProvidersResponse {
  providers: ProviderStatusEntry[];
}

export type AdminProviderStatus = "active" | "disabled" | "deprecated";
export type AdminProviderCredentialStatus =
  | "unchecked"
  | "configured"
  | "missing"
  | "invalid";

export interface AdminProviderItem {
  id: string;
  name: string;
  baseType: string;
  driverKey: string;
  defaultSecretRef: string | null;
  metadataJson: unknown;
  status: AdminProviderStatus;
  priorityRank: number;
  credentialStatus: AdminProviderCredentialStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProviderListResponse {
  items: AdminProviderItem[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface UpdateAdminProviderRequest {
  name?: string;
  status?: AdminProviderStatus;
  priorityRank?: number;
  defaultSecretRef?: string | null;
  metadataJson?: Record<string, unknown> | null;
}

export interface AdminProviderCredentialItem {
  id: string;
  providerId: string;
  secretRef: string;
  status: AdminProviderCredentialStatus;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProviderCredentialsResponse {
  credentials: AdminProviderCredentialItem[];
}

export interface CheckAdminProviderCredentialRequest {
  providerId?: string;
  credentialId?: string;
}

export type AdminDiscoveryJobStatus = "running" | "succeeded" | "failed";
export type AdminDiscoveryTriggerType = "manual" | "scheduled" | "internal";

export interface AdminDiscoveryJobItem {
  id: string;
  providerId: string;
  status: AdminDiscoveryJobStatus;
  triggerType: AdminDiscoveryTriggerType;
  startedAt: string;
  completedAt: string | null;
  discoveredCount: number;
  upsertedCount: number;
  skippedCount: number;
  failureCode: string | null;
  failureMessage: string | null;
  createdByUserId: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDiscoveryJobListResponse {
  items: AdminDiscoveryJobItem[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export type AdminProviderSyncStatus =
  | "never_synced"
  | "syncing"
  | "succeeded"
  | "failed";

export interface AdminProviderSyncStatusItem {
  id: string;
  providerId: string;
  lastJobId: string | null;
  status: AdminProviderSyncStatus;
  lastStartedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureCode: string | null;
  lastFailureMessage: string | null;
  lastDiscoveredCount: number;
  lastUpsertedCount: number;
  updatedAt: string;
}

export interface AdminProviderSyncStatusListResponse {
  items: AdminProviderSyncStatusItem[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface RunAdminDiscoveryJobRequest {
  providerId: string;
  triggerType?: AdminDiscoveryTriggerType;
}

export interface AdminModelCapabilities {
  chat: boolean;
  agent: boolean;
  vision: boolean;
  toolUse: boolean;
  jsonMode: boolean;
}

export type AdminModelCatalogCostTier = "free" | "paid" | "unknown";
export type AdminModelCatalogReleaseStage =
  | "stable"
  | "preview"
  | "experimental"
  | "legacy";

export interface AdminModelPricingMetadata {
  inputPer1mUsdMicros: number | null;
  outputPer1mUsdMicros: number | null;
  currency: "USD";
  raw: unknown;
}

export interface AdminModelCatalogItem {
  id: string;
  providerId: string;
  externalModelKey: string;
  displayName: string;
  description: string | null;
  capabilities: AdminModelCapabilities;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  costTier: AdminModelCatalogCostTier;
  pricing: AdminModelPricingMetadata;
  releaseStage: AdminModelCatalogReleaseStage;
  releasedAt: string | null;
  deprecatedAt: string | null;
  deprecationReason: string | null;
  providerMetadata: unknown;
  firstDiscoveredAt: string;
  lastDiscoveredAt: string;
  lastChangedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminModelCatalogListResponse {
  items: AdminModelCatalogItem[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export type AdminModelRegistryStatus = "registered" | "archived";

export interface AdminModelRegistryItem {
  id: string;
  catalogModelId: string;
  status: AdminModelRegistryStatus;
  approvedByUserId: string;
  approvedAt: string;
  archivedByUserId: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  notes: string | null;
  catalog: AdminModelCatalogItem;
  createdAt: string;
  updatedAt: string;
}

export interface AdminModelRegistryListResponse {
  items: AdminModelRegistryItem[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface RegisterAdminCatalogModelRequest {
  catalogModelId: string;
  notes?: string | null;
}

export interface AdminModelPolicyItem {
  id: string;
  registryModelId: string;
  enabled: boolean;
  visibleInSelector: boolean;
  priorityRank: number;
  defaultForChat: boolean;
  defaultForAgent: boolean;
  requiresCompanion: boolean;
  requestsPerMinuteLimit: number | null;
  tokensPerDayLimit: number | null;
  tokensPerRequestLimit: number | null;
  notes: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminModelPolicyListResponse {
  items: AdminModelPolicyItem[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface UpsertAdminModelPolicyRequest {
  enabled?: boolean;
  visibleInSelector?: boolean;
  priorityRank?: number;
  defaultForChat?: boolean;
  defaultForAgent?: boolean;
  requiresCompanion?: boolean;
  requestsPerMinuteLimit?: number | null;
  tokensPerDayLimit?: number | null;
  tokensPerRequestLimit?: number | null;
  notes?: string | null;
}

export interface ArchiveAdminRegistryModelRequest {
  archiveReason?: string | null;
}

export type AdminModelRuntimeHealthStatus =
  | "healthy"
  | "degraded"
  | "rate_limited"
  | "open_circuit"
  | "auth_invalid"
  | "unknown";

export interface AdminModelRuntimeHealthItem {
  id: string;
  registryModelId: string;
  status: AdminModelRuntimeHealthStatus;
  cooldownUntil: string | null;
  consecutiveFailures: number;
  lastFailureCode: string | null;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  lastCheckedAt: string | null;
  reason: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminModelRuntimeHealthListResponse {
  items: AdminModelRuntimeHealthItem[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export type AdminProviderHealthStatus =
  | "healthy"
  | "degraded"
  | "unavailable"
  | "auth_invalid"
  | "unknown";

export interface AdminProviderHealthItem {
  id: string;
  providerId: string;
  status: AdminProviderHealthStatus;
  cooldownUntil: string | null;
  consecutiveFailures: number;
  lastFailureCode: string | null;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  lastCheckedAt: string | null;
  reason: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProviderHealthListResponse {
  items: AdminProviderHealthItem[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export type AdminRoutingAttemptStatus = "selected" | "no_eligible_models";

export interface AdminRoutingAttemptItem {
  id: string;
  requestId: string;
  userId: string;
  conversationId: string | null;
  agentRunId: string | null;
  mode: "chat" | "agent";
  registryModelId: string | null;
  status: AdminRoutingAttemptStatus;
  eligibleCount: number;
  ineligibleCount: number;
  reasonCode: string | null;
  reasonMessage: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface AdminRoutingAttemptsResponse {
  items: AdminRoutingAttemptItem[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface AdminModelUsageSummaryResponse {
  requestCount: number;
  successCount: number;
  failureCount: number;
  fallbackCount: number;
  rateLimitCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMsTotal: number;
  latencySampleCount: number;
  averageLatencyMs: number | null;
  costUsdMicros: number;
}

export interface AdminModelUsageCounterItem {
  id: string;
  registryModelId: string;
  providerId: string;
  bucketStart: string;
  bucketGranularity: "hour" | "day";
  requestCount: number;
  successCount: number;
  failureCount: number;
  fallbackCount: number;
  rateLimitCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMsTotal: number;
  latencySampleCount: number;
  averageLatencyMs: number | null;
  costUsdMicros: number;
  updatedAt: string;
}

export interface AdminModelUsageCounterListResponse {
  items: AdminModelUsageCounterItem[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface AvailableModelItem {
  id: string;
  name: string;
  displayName?: string;
  providerId: string;
  providerName: string;
  supportsChat: boolean;
  supportsAgent: boolean;
  supportsVision: boolean;
  effectiveStatus?: "active" | "disabled" | "rate_limited";
}

export interface AvailableModelsResponse {
  models: AvailableModelItem[];
}

export type ModelAdminStatus = "active" | "disabled";
export type ModelRuntimeStatus =
  | "healthy"
  | "rate_limited"
  | "open_circuit"
  | "half_open"
  | "auth_invalid";
export type ModelEffectiveStatus = "active" | "disabled" | "rate_limited";
export type ModelSourceType = "manual" | "provider_catalog" | "local";
export type ModelCostTier = "free" | "paid" | "unknown";
export type ModelMarketplaceStatus =
  | "available"
  | "unavailable"
  | "removed"
  | "deprecated";

export interface ModelRegistryItem {
  id: string;
  providerId: string;
  providerName: string;
  driverKey: string;
  providerModelId: string;
  displayName: string;
  secretRef: string | null;
  secretConfigured: boolean;
  priorityRank: number;
  supportsChat: boolean;
  supportsAgent: boolean;
  supportsVision: boolean;
  adminStatus: ModelAdminStatus;
  runtimeStatus: ModelRuntimeStatus;
  effectiveStatus: ModelEffectiveStatus;
  cooldownUntil: string | null;
  requestsPerMinuteLimit: number | null;
  tokensPerDayLimit: number | null;
  tokensUsedToday: number;
  costInputPer1mUsdMicros: number | null;
  costOutputPer1mUsdMicros: number | null;
  lastFailureCode: string | null;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  sourceType: ModelSourceType;
  costTier: ModelCostTier;
  marketplaceStatus: ModelMarketplaceStatus | null;
  lastSyncedAt: string | null;
  lastTestedAt: string | null;
  catalogMetadata: Record<string, unknown> | null;
}

export interface ListModelsResponse {
  models: ModelRegistryItem[];
}

export interface CreateModelRequest {
  providerId: string;
  providerModelId: string;
  displayName: string;
  secretRef?: string | null;
  priorityRank: number;
  supportsChat: boolean;
  supportsAgent: boolean;
  supportsVision?: boolean;
  adminStatus: ModelAdminStatus;
  requestsPerMinuteLimit?: number | null;
  tokensPerDayLimit?: number | null;
  costInputPer1mUsdMicros?: number | null;
  costOutputPer1mUsdMicros?: number | null;
}

export interface UpdateModelRequest {
  providerId?: string;
  providerModelId?: string;
  displayName?: string;
  secretRef?: string | null;
  priorityRank?: number;
  supportsChat?: boolean;
  supportsAgent?: boolean;
  supportsVision?: boolean;
  adminStatus?: ModelAdminStatus;
  requestsPerMinuteLimit?: number | null;
  tokensPerDayLimit?: number | null;
  costInputPer1mUsdMicros?: number | null;
  costOutputPer1mUsdMicros?: number | null;
}

export interface ModelMutationResponse {
  model: ModelRegistryItem;
}

export interface FreeMarketplaceModelItem extends ModelRegistryItem {
  owner: string | null;
  contextWindow: number | null;
  inputModalities: string[];
  outputModalities: string[];
}

export interface FreeMarketplaceResponse {
  models: FreeMarketplaceModelItem[];
  lastSyncedAt: string | null;
}

export interface FreeMarketplaceSyncResponse extends FreeMarketplaceResponse {
  importedCount: number;
  updatedCount: number;
  removedCount: number;
}

export interface ModelAnalyticsSummaryItem {
  modelId: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  rateLimitCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsdMicros: number;
}

export interface ModelAnalyticsSeriesItem extends ModelAnalyticsSummaryItem {
  bucketStart: string;
  granularity: "hour" | "day";
}

export interface ModelAnalyticsResponse {
  summary: ModelAnalyticsSummaryItem[];
  series: ModelAnalyticsSeriesItem[];
}

export type ModelAttemptRequestKind = "chat" | "agent" | "test_connection";

export type ModelAttemptStatus =
  | "success"
  | "failed"
  | "skipped_cooldown"
  | "blocked_quota";

export interface ModelFailoverAttemptItem {
  id: string;
  conversationId: string | null;
  messageId: string | null;
  providerId: string;
  providerName: string;
  modelId: string;
  modelName: string;
  providerModelId: string;
  attemptNo: number;
  wasManualSelection: boolean;
  wasFailover: boolean;
  requestKind: ModelAttemptRequestKind;
  status: ModelAttemptStatus;
  failureCode: string | null;
  latencyMs: number | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsdMicros: number;
  idempotencyKey: string;
  createdAt: string;
}

export interface ModelFailoverAttemptsResponse {
  items: ModelFailoverAttemptItem[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

// Error Envelope
export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}
