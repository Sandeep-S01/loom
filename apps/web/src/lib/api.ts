import type {
  AdminDiscoveryJobItem,
  AdminModelCatalogListResponse,
  AdminModelPolicyItem,
  AdminModelPolicyListResponse,
  AdminModelRegistryItem,
  AdminModelRegistryListResponse,
  AdminModelRuntimeHealthListResponse,
  AdminModelUsageCounterListResponse,
  AdminModelUsageSummaryResponse,
  AdminProviderCredentialItem,
  AdminProviderCredentialsResponse,
  AdminProviderHealthListResponse,
  AdminProviderListResponse,
  AdminProviderSyncStatusListResponse,
  AdminRoutingAttemptsResponse,
  CompanionStatusResponse,
  ConversationMessagesResponse,
  CreateConversationRequest,
  CreateConversationResponse,
  CreateModelRequest,
  DashboardResponse,
  LoginRequest,
  LoginResponse,
  ListWorkspacesResponse,
  ListConversationsResponse,
  ListModelsResponse,
  FreeMarketplaceResponse,
  FreeMarketplaceSyncResponse,
  ModelFailoverAttemptsResponse,
  ModelAnalyticsResponse,
  ModelMutationResponse,
  PairStartResponse,
  AvailableModelsResponse,
  ProvidersResponse,
  RegisterRequest,
  RegisterResponse,
  SendMessageRequest,
  SendMessageResponse,
  SessionResponse,
  UpdateAdminProviderRequest,
  UpdateSessionRequest,
  UpsertAdminModelPolicyRequest,
  UpdateModelRequest,
  UpdateConversationResponse,
} from "@clm/shared-types";

const BACKEND_URL =
  typeof window === "undefined" ? process.env.NEXT_PUBLIC_BACKEND_URL ?? "" : "";
const CSRF_COOKIE_NAME = "loom_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (init?.body == null) {
    headers.delete("Content-Type");
  } else if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const csrfToken = getCsrfToken();
  if (csrfToken && isUnsafeMethod(init?.method)) {
    headers.set(CSRF_HEADER_NAME, csrfToken);
  }

  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const fallback = `Request failed with status ${response.status}`;
    let message = fallback;

    try {
      const body = (await response.json()) as {
        error?: {
          message?: string;
        };
      };

      message = body.error?.message ?? fallback;
    } catch {
      message = fallback;
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function isUnsafeMethod(method?: string) {
  const normalized = method?.toUpperCase() ?? "GET";
  return normalized !== "GET" && normalized !== "HEAD" && normalized !== "OPTIONS";
}

function getCsrfToken() {
  if (typeof document === "undefined") return null;

  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CSRF_COOKIE_NAME}=`));

  return cookie ? decodeURIComponent(cookie.slice(CSRF_COOKIE_NAME.length + 1)) : null;
}

export function getSession() {
  return request<SessionResponse>("/api/v1/session");
}

export async function getOptionalSession() {
  return (await request<SessionResponse | undefined>(
    "/api/v1/session?optional=true",
  )) ?? null;
}

export function login(payload: LoginRequest) {
  return request<LoginResponse>("/api/v1/session/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function register(payload: RegisterRequest) {
  return request<RegisterResponse>("/api/v1/session/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logout() {
  return request<void>("/api/v1/session/logout", {
    method: "POST",
  });
}

export function updateSession(payload: UpdateSessionRequest) {
  return request<SessionResponse>("/api/v1/session", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getDashboard() {
  return request<DashboardResponse>("/api/v1/dashboard");
}

export function startPairing() {
  return request<PairStartResponse>("/api/v1/companion/pair/start", {
    method: "POST",
  });
}

export function getCompanionStatus() {
  return request<CompanionStatusResponse>("/api/v1/companion/status");
}

export function listWorkspaces() {
  return request<ListWorkspacesResponse>("/api/v1/workspaces");
}

export function listConversations() {
  return request<ListConversationsResponse>("/api/v1/conversations");
}

export function listAvailableModels(mode: "chat" | "agent" = "chat") {
  return request<AvailableModelsResponse>(`/api/v1/models/selector?mode=${mode}`);
}

export function getProvidersStatus() {
  return request<ProvidersResponse>("/api/v1/providers");
}

export function listAdminProviders(params?: {
  status?: "active" | "disabled" | "deprecated";
  supportsDiscovery?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: "name" | "priorityRank" | "updatedAt";
  direction?: "asc" | "desc";
}) {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.supportsDiscovery !== undefined) {
    query.set("supportsDiscovery", String(params.supportsDiscovery));
  }
  if (params?.search) query.set("search", params.search);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  if (params?.sort) query.set("sort", params.sort);
  if (params?.direction) query.set("direction", params.direction);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<AdminProviderListResponse>(`/api/v1/admin/providers${suffix}`);
}

export function updateAdminProvider(
  providerId: string,
  payload: UpdateAdminProviderRequest,
) {
  return request<AdminProviderListResponse["items"][number]>(
    `/api/v1/admin/providers/${providerId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function listAdminProviderCredentials(params?: { providerId?: string }) {
  const query = new URLSearchParams();
  if (params?.providerId) query.set("providerId", params.providerId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<AdminProviderCredentialsResponse>(
    `/api/v1/admin/provider-credentials${suffix}`,
  );
}

export function checkAdminProviderCredential(input: {
  providerId?: string;
  credentialId?: string;
}) {
  return request<AdminProviderCredentialItem>(
    "/api/v1/admin/provider-credentials/check",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function runAdminDiscoveryJob(providerId: string) {
  return request<AdminDiscoveryJobItem>("/api/v1/admin/discovery/jobs", {
    method: "POST",
    body: JSON.stringify({ providerId, triggerType: "manual" }),
  });
}

export function listAdminProviderSyncStatus(params?: {
  providerId?: string;
  status?: "never_synced" | "syncing" | "succeeded" | "failed";
  page?: number;
  pageSize?: number;
  sort?: "updatedAt" | "lastStartedAt" | "lastSuccessAt";
  direction?: "asc" | "desc";
}) {
  const query = new URLSearchParams();
  if (params?.providerId) query.set("providerId", params.providerId);
  if (params?.status) query.set("status", params.status);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  if (params?.sort) query.set("sort", params.sort);
  if (params?.direction) query.set("direction", params.direction);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<AdminProviderSyncStatusListResponse>(
    `/api/v1/admin/provider-sync-status${suffix}`,
  );
}

export function listAdminModelCatalog(params?: {
  providerId?: string;
  search?: string;
  capability?: "chat" | "agent" | "vision" | "toolUse" | "jsonMode";
  costTier?: "free" | "paid" | "unknown";
  releaseStage?: "stable" | "preview" | "experimental" | "legacy";
  deprecated?: boolean;
  page?: number;
  pageSize?: number;
  sort?:
    | "displayName"
    | "providerId"
    | "contextWindow"
    | "lastDiscoveredAt"
    | "updatedAt";
  direction?: "asc" | "desc";
}) {
  const query = new URLSearchParams();
  if (params?.providerId) query.set("providerId", params.providerId);
  if (params?.search) query.set("search", params.search);
  if (params?.capability) query.set("capability", params.capability);
  if (params?.costTier) query.set("costTier", params.costTier);
  if (params?.releaseStage) query.set("releaseStage", params.releaseStage);
  if (params?.deprecated !== undefined) {
    query.set("deprecated", String(params.deprecated));
  }
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  if (params?.sort) query.set("sort", params.sort);
  if (params?.direction) query.set("direction", params.direction);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<AdminModelCatalogListResponse>(
    `/api/v1/admin/model-catalog${suffix}`,
  );
}

export function listAdminModelRegistry(params?: {
  providerId?: string;
  search?: string;
  status?: "registered" | "archived";
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
  sort?: "approvedAt" | "updatedAt" | "displayName" | "providerId";
  direction?: "asc" | "desc";
}) {
  const query = new URLSearchParams();
  if (params?.providerId) query.set("providerId", params.providerId);
  if (params?.search) query.set("search", params.search);
  if (params?.status) query.set("status", params.status);
  if (params?.includeArchived !== undefined) {
    query.set("includeArchived", String(params.includeArchived));
  }
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  if (params?.sort) query.set("sort", params.sort);
  if (params?.direction) query.set("direction", params.direction);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<AdminModelRegistryListResponse>(
    `/api/v1/admin/model-registry${suffix}`,
  );
}

export function registerAdminCatalogModel(payload: {
  catalogModelId: string;
  notes?: string | null;
}) {
  return request<AdminModelRegistryItem>("/api/v1/admin/model-registry", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function archiveAdminRegistryModel(
  registryModelId: string,
  archiveReason?: string | null,
) {
  return request<AdminModelRegistryItem>(
    `/api/v1/admin/model-registry/${registryModelId}`,
    {
      method: "DELETE",
      body: JSON.stringify({ archiveReason: archiveReason ?? null }),
    },
  );
}

export function listAdminModelPolicies(params?: {
  registryModelId?: string;
  enabled?: boolean;
  visibleInSelector?: boolean;
  defaultsOnly?: boolean;
  page?: number;
  pageSize?: number;
  sort?: "priorityRank" | "updatedAt" | "createdAt";
  direction?: "asc" | "desc";
}) {
  const query = new URLSearchParams();
  if (params?.registryModelId) query.set("registryModelId", params.registryModelId);
  if (params?.enabled !== undefined) query.set("enabled", String(params.enabled));
  if (params?.visibleInSelector !== undefined) {
    query.set("visibleInSelector", String(params.visibleInSelector));
  }
  if (params?.defaultsOnly !== undefined) {
    query.set("defaultsOnly", String(params.defaultsOnly));
  }
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  if (params?.sort) query.set("sort", params.sort);
  if (params?.direction) query.set("direction", params.direction);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<AdminModelPolicyListResponse>(
    `/api/v1/admin/model-policy${suffix}`,
  );
}

export function upsertAdminModelPolicy(
  registryModelId: string,
  payload: UpsertAdminModelPolicyRequest,
) {
  return request<AdminModelPolicyItem>(
    `/api/v1/admin/model-policy/${registryModelId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export function listAdminModelRuntimeHealth(params?: {
  registryModelId?: string;
  status?:
    | "healthy"
    | "degraded"
    | "rate_limited"
    | "open_circuit"
    | "auth_invalid"
    | "unknown";
  page?: number;
  pageSize?: number;
  sort?: "updatedAt" | "lastCheckedAt" | "consecutiveFailures";
  direction?: "asc" | "desc";
}) {
  const query = new URLSearchParams();
  if (params?.registryModelId) query.set("registryModelId", params.registryModelId);
  if (params?.status) query.set("status", params.status);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  if (params?.sort) query.set("sort", params.sort);
  if (params?.direction) query.set("direction", params.direction);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<AdminModelRuntimeHealthListResponse>(
    `/api/v1/admin/model-runtime-health${suffix}`,
  );
}

export function resetAdminModelRuntimeHealth(registryModelId: string) {
  return request<AdminModelRuntimeHealthListResponse["items"][number]>(
    `/api/v1/admin/model-runtime-health/${registryModelId}/reset`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export function listAdminProviderHealth(params?: {
  providerId?: string;
  status?: "healthy" | "degraded" | "unavailable" | "auth_invalid" | "unknown";
  page?: number;
  pageSize?: number;
  sort?: "updatedAt" | "lastCheckedAt" | "consecutiveFailures";
  direction?: "asc" | "desc";
}) {
  const query = new URLSearchParams();
  if (params?.providerId) query.set("providerId", params.providerId);
  if (params?.status) query.set("status", params.status);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  if (params?.sort) query.set("sort", params.sort);
  if (params?.direction) query.set("direction", params.direction);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<AdminProviderHealthListResponse>(
    `/api/v1/admin/provider-health${suffix}`,
  );
}

export function resetAdminProviderHealth(providerId: string) {
  return request<AdminProviderHealthListResponse["items"][number]>(
    `/api/v1/admin/provider-health/${providerId}/reset`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export function listAdminRoutingAttempts(params?: {
  userId?: string;
  conversationId?: string;
  agentRunId?: string;
  registryModelId?: string;
  status?: "selected" | "no_eligible_models";
  mode?: "chat" | "agent";
  page?: number;
  pageSize?: number;
  direction?: "asc" | "desc";
}) {
  const query = new URLSearchParams();
  if (params?.userId) query.set("userId", params.userId);
  if (params?.conversationId) query.set("conversationId", params.conversationId);
  if (params?.agentRunId) query.set("agentRunId", params.agentRunId);
  if (params?.registryModelId) query.set("registryModelId", params.registryModelId);
  if (params?.status) query.set("status", params.status);
  if (params?.mode) query.set("mode", params.mode);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  if (params?.direction) query.set("direction", params.direction);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<AdminRoutingAttemptsResponse>(
    `/api/v1/admin/routing-attempts${suffix}`,
  );
}

export function getAdminModelUsageSummary(params?: {
  registryModelId?: string;
  providerId?: string;
  from?: string;
  to?: string;
}) {
  const query = new URLSearchParams();
  if (params?.registryModelId) query.set("registryModelId", params.registryModelId);
  if (params?.providerId) query.set("providerId", params.providerId);
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<AdminModelUsageSummaryResponse>(
    `/api/v1/admin/model-usage/summary${suffix}`,
  );
}

export function listAdminModelUsageCounters(params?: {
  registryModelId?: string;
  providerId?: string;
  granularity?: "hour" | "day";
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  sort?: "bucketStart" | "requestCount" | "totalTokens" | "updatedAt";
  direction?: "asc" | "desc";
}) {
  const query = new URLSearchParams();
  if (params?.registryModelId) query.set("registryModelId", params.registryModelId);
  if (params?.providerId) query.set("providerId", params.providerId);
  if (params?.granularity) query.set("granularity", params.granularity);
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  if (params?.sort) query.set("sort", params.sort);
  if (params?.direction) query.set("direction", params.direction);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<AdminModelUsageCounterListResponse>(
    `/api/v1/admin/model-usage/counters${suffix}`,
  );
}

export function listModels(params?: {
  mode?: "chat" | "agent";
  includeDisabled?: boolean;
  includeDeleted?: boolean;
}) {
  const query = new URLSearchParams();
  if (params?.mode) query.set("mode", params.mode);
  if (params?.includeDisabled) query.set("includeDisabled", "true");
  if (params?.includeDeleted) query.set("includeDeleted", "true");
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<ListModelsResponse>(`/api/v1/models${suffix}`);
}

export function createModel(payload: CreateModelRequest) {
  return request<ModelMutationResponse>("/api/v1/models", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateModel(modelId: string, payload: UpdateModelRequest) {
  return request<ModelMutationResponse>(`/api/v1/models/${modelId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteModel(modelId: string) {
  return request<ModelMutationResponse>(`/api/v1/models/${modelId}`, {
    method: "DELETE",
  });
}

export function listFreeMarketplaceModels() {
  return request<FreeMarketplaceResponse>("/api/v1/marketplace/free-models");
}

export function syncFreeMarketplaceModels() {
  return request<FreeMarketplaceSyncResponse>("/api/v1/marketplace/free-models/sync", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function enableFreeMarketplaceModel(modelId: string) {
  return request<ModelMutationResponse>(
    `/api/v1/marketplace/free-models/${modelId}/enable`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export function disableFreeMarketplaceModel(modelId: string) {
  return request<ModelMutationResponse>(
    `/api/v1/marketplace/free-models/${modelId}/disable`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export function getModelAnalytics(params: {
  from: string;
  to: string;
  granularity?: "hour" | "day";
  modelId?: string;
}) {
  const query = new URLSearchParams({
    from: params.from,
    to: params.to,
    granularity: params.granularity ?? "day",
  });
  if (params.modelId) query.set("modelId", params.modelId);
  return request<ModelAnalyticsResponse>(`/api/v1/models/analytics?${query.toString()}`);
}

export function listFailoverAttempts(params?: {
  page?: number;
  pageSize?: number;
  modelId?: string;
  status?: "success" | "failed" | "skipped_cooldown" | "blocked_quota";
  from?: string;
  to?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  if (params?.modelId) query.set("modelId", params.modelId);
  if (params?.status) query.set("status", params.status);
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<ModelFailoverAttemptsResponse>(
    `/api/v1/admin/failover-attempts${suffix}`,
  );
}

export function createConversation(payload: CreateConversationRequest) {
  return request<CreateConversationResponse>("/api/v1/conversations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function renameConversation(conversationId: string, title: string) {
  return request<UpdateConversationResponse>(`/api/v1/conversations/${conversationId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export function deleteConversation(conversationId: string) {
  return request<void>(`/api/v1/conversations/${conversationId}`, {
    method: "DELETE",
  });
}

export function getConversationMessages(conversationId: string) {
  return request<ConversationMessagesResponse>(
    `/api/v1/conversations/${conversationId}/messages`,
  );
}

export function sendMessage(
  conversationId: string,
  payload: SendMessageRequest,
) {
  return request<SendMessageResponse>(
    `/api/v1/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
