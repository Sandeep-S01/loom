import type {
  PairCompleteRequest,
  PairCompleteResponse,
  SelectWorkspaceRequest,
  SelectWorkspaceResponse,
} from "@clm/shared-types";

const BACKEND_URL = "http://localhost:3001";

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const fallback = `Request failed with status ${response.status}`;
    let message = fallback;

    try {
      const body = (await response.json()) as ApiErrorResponse;
      message = body.error?.message ?? fallback;
    } catch {
      message = fallback;
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function completePairing(payload: PairCompleteRequest) {
  return request<PairCompleteResponse>("/api/v1/companion/pair/complete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function selectWorkspace(
  payload: SelectWorkspaceRequest,
  machineSessionToken: string,
) {
  return request<SelectWorkspaceResponse>("/api/v1/workspaces/select", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${machineSessionToken}`,
    },
    body: JSON.stringify(payload),
  });
}
