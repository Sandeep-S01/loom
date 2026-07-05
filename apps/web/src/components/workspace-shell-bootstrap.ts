import {
  getCompanionStatus,
  getDashboard,
  getSession,
  listConversations,
  listWorkspaces,
} from "../lib/api";
import type {
  CompanionStatusResponse,
  ConversationListItem,
  DashboardResponse,
  SessionResponse,
  WorkspaceListItem,
} from "../lib/types";

export interface WorkspaceShellDataState<T> {
  data: T;
  error: string | null;
}

interface WorkspaceShellBootstrapData {
  companionStatus: WorkspaceShellDataState<CompanionStatusResponse | null>;
  conversations: WorkspaceShellDataState<ConversationListItem[]>;
  dashboard: WorkspaceShellDataState<DashboardResponse | null>;
  session: SessionResponse;
  workspaces: WorkspaceShellDataState<WorkspaceListItem[]>;
}

interface WorkspaceShellContextData {
  companionStatus: WorkspaceShellDataState<CompanionStatusResponse | null>;
  dashboard: WorkspaceShellDataState<DashboardResponse | null>;
  workspaces: WorkspaceShellDataState<WorkspaceListItem[]>;
}

export async function loadWorkspaceShellBootstrapData(): Promise<WorkspaceShellBootstrapData> {
  const [
    sessionResult,
    dashboardResult,
    companionResult,
    workspacesResult,
    conversationsResult,
  ] = await Promise.allSettled([
    getSession(),
    getDashboard(),
    getCompanionStatus(),
    listWorkspaces(),
    listConversations(),
  ]);

  if (sessionResult.status !== "fulfilled") {
    throw toError(sessionResult.reason, "Failed to load the workspace.");
  }

  return {
    session: sessionResult.value,
    dashboard: getSettledState(dashboardResult, null),
    companionStatus: getSettledState(companionResult, null),
    workspaces: getSettledState(workspacesResult, [], (value) => value.workspaces),
    conversations: getSettledState(
      conversationsResult,
      [],
      (value) => value.conversations,
    ),
  };
}

export async function loadWorkspaceShellContextData(): Promise<WorkspaceShellContextData> {
  const [dashboardResult, companionResult, workspacesResult] = await Promise.allSettled([
    getDashboard(),
    getCompanionStatus(),
    listWorkspaces(),
  ]);

  return {
    dashboard: getSettledState(dashboardResult, null),
    companionStatus: getSettledState(companionResult, null),
    workspaces: getSettledState(workspacesResult, [], (value) => value.workspaces),
  };
}

function getSettledState<T, TValue = T>(
  result: PromiseSettledResult<T>,
  fallbackData: TValue,
  mapValue?: (value: T) => TValue,
): WorkspaceShellDataState<TValue> {
  if (result.status === "fulfilled") {
    return {
      data: mapValue ? mapValue(result.value) : (result.value as unknown as TValue),
      error: null,
    };
  }

  return {
    data: fallbackData,
    error: toError(result.reason, "Failed to load the workspace section.").message,
  };
}

function toError(error: unknown, fallbackMessage: string): Error {
  return error instanceof Error ? error : new Error(fallbackMessage);
}
