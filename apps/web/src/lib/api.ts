import type {
  CompanionStatusResponse,
  ConversationMessagesResponse,
  CreateConversationRequest,
  CreateConversationResponse,
  DashboardResponse,
  ListWorkspacesResponse,
  ListConversationsResponse,
  PairStartResponse,
  SendMessageRequest,
  SendMessageResponse,
  SessionResponse,
} from "@clm/shared-types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

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

  return response.json() as Promise<T>;
}

export function getSession() {
  return request<SessionResponse>("/api/v1/session");
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

export function createConversation(payload: CreateConversationRequest) {
  return request<CreateConversationResponse>("/api/v1/conversations", {
    method: "POST",
    body: JSON.stringify(payload),
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
