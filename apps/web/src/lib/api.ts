import type {
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
  UpdateSessionRequest,
  UpdateModelRequest,
  UpdateConversationResponse,
} from "@clm/shared-types";

const BACKEND_URL =
  typeof window === "undefined" ? process.env.NEXT_PUBLIC_BACKEND_URL ?? "" : "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (init?.body == null) {
    headers.delete("Content-Type");
  } else if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
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

export function getSession() {
  return request<SessionResponse>("/api/v1/session");
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
