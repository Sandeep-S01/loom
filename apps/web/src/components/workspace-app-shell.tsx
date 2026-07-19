"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  createModel,
  deleteModel,
  disableFreeMarketplaceModel,
  enableFreeMarketplaceModel,
  getModelAnalytics,
  getProvidersStatus,
  listFreeMarketplaceModels,
  listAvailableModels,
  listModels,
  logout,
  startPairing,
  syncFreeMarketplaceModels,
  updateSession,
  updateModel,
} from "../lib/api";
import { getConversationIdFromLocation } from "../lib/conversation-links";
import type {
  AvailableModelItem,
  CompanionStatusResponse,
  DashboardResponse,
  FreeMarketplaceResponse,
  ModelAnalyticsResponse,
  ModelRegistryItem,
  ProvidersResponse,
  SessionResponse,
  WorkspaceListItem,
} from "../lib/types";
import { renderWorkspaceSection } from "./workspace-section-renderer";
import {
  SECTION_META,
  type WorkspaceSection,
} from "./workspace-sections";
import {
  loadWorkspaceShellBootstrapData,
  loadWorkspaceShellContextData,
  type WorkspaceShellDataState,
} from "./workspace-shell-bootstrap";
import { useWorkspaceChatController } from "./use-workspace-chat-controller";
import { ErrorState } from "./ui/error-state";
import { Panel } from "./ui/panel";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { ConnectionProvider } from "../context/connection-context";
import {
  getInitialSidebarExpandedState,
  readStoredSidebarExpandedState,
  SIDEBAR_EXPANDED_STORAGE_KEY,
} from "./workspace-sidebar-preferences";

interface WorkspaceAppShellProps {
  initialSection?: WorkspaceSection;
  mode?: "workspace" | "admin";
}

const PINNED_CONVERSATIONS_KEY = "clm.workspace.pinned_conversations";
const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";
const WORKSPACE_SECTION_PATHS: Partial<Record<WorkspaceSection, string>> = {
  dashboard: "/dashboard",
  chat: "/chat",
  workspaces: "/workspaces",
  companion: "/companion",
  settings: "/settings",
};

export function WorkspaceAppShell({
  initialSection = "chat",
  mode = "workspace",
}: WorkspaceAppShellProps) {
  const isMountedRef = useRef(true);
  const contextPanelId = useId();
  const [activeSection, setActiveSection] = useState<WorkspaceSection>(initialSection);
  const [isPanelOpen, setIsPanelOpen] = useState(getInitialSidebarExpandedState);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [availableChatModels, setAvailableChatModels] = useState<AvailableModelItem[]>([]);
  const [registeredModels, setRegisteredModels] = useState<ModelRegistryItem[]>([]);
  const [freeMarketplace, setFreeMarketplace] = useState<FreeMarketplaceResponse>({
    models: [],
    lastSyncedAt: null,
  });
  const [modelAnalytics, setModelAnalytics] = useState<ModelAnalyticsResponse>({
    summary: [],
    series: [],
  });
  const [providersStatus, setProvidersStatus] = useState<ProvidersResponse | null>(null);
  const [companionStatus, setCompanionStatus] =
    useState<CompanionStatusResponse | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [companionStatusError, setCompanionStatusError] = useState<string | null>(null);
  const [workspacesError, setWorkspacesError] = useState<string | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [pinnedConversationIds, setPinnedConversationIds] = useState<string[]>([]);
  const [bootError, setBootError] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingExpiresAt, setPairingExpiresAt] = useState<string | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [isStartingPairing, setIsStartingPairing] = useState(false);
  const [hasLoadedPinnedConversations, setHasLoadedPinnedConversations] = useState(false);
  const [workspaceThemeClass, setWorkspaceThemeClass] = useState("workspace-theme-dark");

  const chat = useWorkspaceChatController({
    isMountedRef,
    onRefreshWorkspaceData: refreshWorkspaceData,
    pinnedConversationIds,
  });
  const chatRef = useRef(chat);
  chatRef.current = chat;

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const storedPinnedConversationIds = loadJson<string[]>(PINNED_CONVERSATIONS_KEY);
    if (storedPinnedConversationIds) {
      setPinnedConversationIds(storedPinnedConversationIds);
    }

    setHasLoadedPinnedConversations(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedPinnedConversations) {
      return;
    }

    saveJson(PINNED_CONVERSATIONS_KEY, pinnedConversationIds);
  }, [hasLoadedPinnedConversations, pinnedConversationIds]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsPanelOpen(readStoredSidebarExpandedState(window.localStorage));
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIDEBAR_EXPANDED_STORAGE_KEY, String(isPanelOpen));
    }
  }, [isPanelOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const applyTheme = () => {
      const savedTheme = window.localStorage.getItem("clm.workspace.theme") ?? "dark";
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const useDarkTheme = savedTheme === "system" ? prefersDark : savedTheme === "dark";
      window.document.documentElement.classList.remove("dark", "light");
      setWorkspaceThemeClass(useDarkTheme ? "workspace-theme-dark" : "workspace-theme-light");
    };
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    applyTheme();
    window.addEventListener("storage", applyTheme);
    mediaQuery.addEventListener("change", applyTheme);
    return () => {
      window.removeEventListener("storage", applyTheme);
      mediaQuery.removeEventListener("change", applyTheme);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const syncDesktopState = (event?: MediaQueryListEvent) => {
      const matches = event?.matches ?? mediaQuery.matches;
      setIsDesktopViewport(matches);
      if (matches) {
        setIsMobilePanelOpen(false);
      }
    };

    syncDesktopState();
    mediaQuery.addEventListener("change", syncDesktopState);

    return () => {
      mediaQuery.removeEventListener("change", syncDesktopState);
    };
  }, []);

  useEffect(() => {
    async function boot() {
      try {
        const bootstrapData = await loadWorkspaceShellBootstrapData();
        if (mode === "admin" && bootstrapData.session.user.role !== "admin") {
          throw new Error("Admin access required.");
        }

        const [modelsResponse, providersResponse] = await Promise.all([
          listAvailableModels("chat"),
          getProvidersStatus(),
        ]);

        const [registryResponse, analyticsResponse, marketplaceResponse] =
          mode === "admin"
            ? await Promise.all([
                listModels({ includeDisabled: true }),
                getModelAnalytics({
                  from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                  to: new Date().toISOString(),
                  granularity: "day",
                }),
                listFreeMarketplaceModels(),
              ])
            : [
                { models: [] },
                { summary: [], series: [] },
                { models: [], lastSyncedAt: null },
              ];

        if (!isMountedRef.current) {
          return;
        }

        setSession(bootstrapData.session);
        applyBootSectionState(setDashboard, setDashboardError, bootstrapData.dashboard);
        applyBootSectionState(
          setCompanionStatus,
          setCompanionStatusError,
          bootstrapData.companionStatus,
        );
        applyBootSectionState(setWorkspaces, setWorkspacesError, bootstrapData.workspaces);
        setConversationsError(bootstrapData.conversations.error);
        setAvailableChatModels(modelsResponse.models);
        setRegisteredModels(registryResponse.models);
        setFreeMarketplace(marketplaceResponse);
        setModelAnalytics(analyticsResponse);
        setProvidersStatus(providersResponse);
        chatRef.current.hydrateConversations(bootstrapData.conversations.data);

        const requestedConversationId = getConversationIdFromLocation();
        const initialConversation =
          bootstrapData.conversations.data.find(
            (conversation) => conversation.id === requestedConversationId,
          ) ?? bootstrapData.conversations.data[0];

        if (initialConversation) {
          await chatRef.current.selectConversation(initialConversation.id);
        }
      } catch (error) {
        if (isMountedRef.current) {
          setBootError(
            error instanceof Error ? error.message : "Failed to load the workspace.",
          );
        }
      } finally {
        if (isMountedRef.current) {
          setIsBooting(false);
        }
      }
    }

    void boot();
  }, [mode]);

  async function refreshWorkspaceData() {
    const [contextData, providersResponse, selectorResponse] = await Promise.all([
      loadWorkspaceShellContextData(),
      getProvidersStatus().catch(() => null),
      listAvailableModels("chat").catch(() => null),
    ]);

    const [registryResponse, analyticsResponse, marketplaceResponse] =
      mode === "admin"
        ? await Promise.all([
            listModels({ includeDisabled: true }).catch(() => null),
            getModelAnalytics({
              from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              to: new Date().toISOString(),
              granularity: "day",
            }).catch(() => null),
            listFreeMarketplaceModels().catch(() => null),
          ])
        : [null, null, null];

    if (!isMountedRef.current) {
      return;
    }

    applyRefreshSectionState(setDashboard, setDashboardError, contextData.dashboard);
    applyRefreshSectionState(
      setCompanionStatus,
      setCompanionStatusError,
      contextData.companionStatus,
    );
    applyRefreshSectionState(setWorkspaces, setWorkspacesError, contextData.workspaces);
    if (providersResponse) {
      setProvidersStatus(providersResponse);
    }
    if (selectorResponse) {
      setAvailableChatModels(selectorResponse.models);
    }
    if (registryResponse) {
      setRegisteredModels(registryResponse.models);
      setModelsError(null);
    }
    if (analyticsResponse) {
      setModelAnalytics(analyticsResponse);
    }
    if (marketplaceResponse) {
      setFreeMarketplace(marketplaceResponse);
    }
  }

  const refreshWorkspaceDataRef = useRef(refreshWorkspaceData);
  refreshWorkspaceDataRef.current = refreshWorkspaceData;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleFocus = () => {
      void refreshWorkspaceDataRef.current();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  async function handleCreateConversation() {
    const created = await chat.createChatConversation();
    if (created) {
      setActiveSection("chat");
      setIsPanelOpen(true);
      setIsMobilePanelOpen(false);
    }
  }

  function handleStartPairing() {
    setIsStartingPairing(true);
    setPairingError(null);

    void startPairing()
      .then((response) => {
        if (!isMountedRef.current) {
          return;
        }

        setPairingCode(response.pairingCode);
        setPairingExpiresAt(response.expiresAt);
        setActiveSection("companion");
      })
      .catch((error) => {
        if (isMountedRef.current) {
          setPairingError(
            error instanceof Error ? error.message : "Failed to start pairing.",
          );
        }
      })
      .finally(() => {
        if (isMountedRef.current) {
          setIsStartingPairing(false);
        }
      });
  }

  function togglePinnedConversation(conversationId: string) {
    setPinnedConversationIds((current) =>
      current.includes(conversationId)
        ? current.filter((item) => item !== conversationId)
        : [conversationId, ...current],
    );
  }

  async function handleLogout() {
    await logout();
    if (typeof window !== "undefined") {
      window.location.assign("/");
    }
  }

  async function handleUpdateSession(input: { displayName: string }) {
    const response = await updateSession(input);
    if (isMountedRef.current) {
      setSession(response);
    }

    return response;
  }

  function removePinnedConversation(conversationId: string) {
    setPinnedConversationIds((current) =>
      current.filter((item) => item !== conversationId),
    );
  }

  function handleSelectSection(section: WorkspaceSection) {
    const isMobileViewport =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches;
    const nextPath = WORKSPACE_SECTION_PATHS[section];

    if (typeof window !== "undefined" && mode === "workspace" && nextPath) {
      const currentPath = window.location.pathname;
      if (currentPath !== nextPath) {
        window.history.pushState(null, "", nextPath);
      }
    }

    setActiveSection((current) => {
      if (current === section) {
        if (isMobileViewport) {
          setIsMobilePanelOpen(false);
          return current;
        }

        return current;
      }

      if (isMobileViewport) {
        setIsMobilePanelOpen(false);
      }
      return section;
    });
  }

  function closeMobilePanel() {
    setIsMobilePanelOpen(false);
  }

  async function handleCreateModel(payload: Parameters<typeof createModel>[0]) {
    try {
      setModelsError(null);
      await createModel(payload);
      await refreshWorkspaceData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add model.";
      setModelsError(message);
      throw error;
    }
  }

  async function handleUpdateModel(
    modelId: string,
    payload: Parameters<typeof updateModel>[1],
  ) {
    try {
      setModelsError(null);
      await updateModel(modelId, payload);
      await refreshWorkspaceData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update model.";
      setModelsError(message);
      throw error;
    }
  }

  async function handleDeleteModel(modelId: string) {
    try {
      setModelsError(null);
      await deleteModel(modelId);
      await refreshWorkspaceData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete model.";
      setModelsError(message);
      throw error;
    }
  }

  async function handleSyncFreeMarketplace() {
    try {
      setModelsError(null);
      const response = await syncFreeMarketplaceModels();
      setFreeMarketplace(response);
      await refreshWorkspaceData();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to refresh free model marketplace.";
      setModelsError(message);
      throw error;
    }
  }

  async function handleEnableFreeMarketplaceModel(modelId: string) {
    try {
      setModelsError(null);
      await enableFreeMarketplaceModel(modelId);
      await refreshWorkspaceData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to enable free model.";
      setModelsError(message);
      throw error;
    }
  }

  async function handleDisableFreeMarketplaceModel(modelId: string) {
    try {
      setModelsError(null);
      await disableFreeMarketplaceModel(modelId);
      await refreshWorkspaceData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to disable free model.";
      setModelsError(message);
      throw error;
    }
  }

  const connectionState = {
    connected: dashboard?.companion.connected ?? companionStatus?.connected ?? false,
    machineLabel: dashboard?.companion.machineLabel ?? companionStatus?.machineLabel ?? null,
    deviceId: companionStatus?.deviceId ?? null,
    eligibleCount: dashboard?.providerSummary.eligibleCount ?? 0,
    cooldownCount: dashboard?.providerSummary.cooldownCount ?? 0,
    isLoading: isBooting,
    hasError: !!dashboardError || !!companionStatusError,
    refresh: refreshWorkspaceData,
  };

  const sectionOrder =
    mode === "admin"
      ? (["models", "activity", "settings"] as WorkspaceSection[])
      : (["dashboard", "chat", "workspaces", "companion", "settings"] as WorkspaceSection[]);
  const sectionMeta = SECTION_META[activeSection];
  const showMobilePanel = isPanelOpen && isMobilePanelOpen;
  const isContextPanelVisible = isDesktopViewport ? isPanelOpen : showMobilePanel;
  const companionChipLabel = connectionState.hasError
    ? "Status unavailable"
    : connectionState.connected
      ? "Companion online"
      : "Companion offline";
  const mobileStatusLabel = connectionState.hasError
    ? "Status unavailable"
    : connectionState.connected
      ? `${connectionState.eligibleCount} models ready`
      : "Companion offline";
  const sectionRender = renderWorkspaceSection({
    activeConversation: chat.activeConversation,
    activeConversationId: chat.activeConversationId,
    activeSection,
    capacityBlocked: chat.capacityBlocked,
    chatError: chat.chatError,
    companionStatus,
    connection: connectionState,
    conversationSearch: chat.conversationSearch,
    dashboard,
    draftMessage: chat.draftMessage,
    availableModels: availableChatModels,
    providersStatus,
    filteredConversations: chat.filteredConversations,
    isLoadingMessages: chat.isLoadingMessages,
    isSending: chat.isSending,
    isStartingPairing,
    loadErrors: {
      companionStatus: companionStatusError,
      conversations: conversationsError,
      dashboard: dashboardError,
      workspaces: workspacesError,
    },
    messages: chat.messages,
    pendingModelId: chat.pendingModelId,
    onConversationSearchChange: chat.setConversationSearch,
    onCreateConversation: handleCreateConversation,
    onCreateModel: handleCreateModel,
    onDeleteModel: handleDeleteModel,
    onDeleteConversation: async (conversationId) => {
      removePinnedConversation(conversationId);
      await chat.deleteConversationRecord(conversationId);
    },
    onDraftMessageChange: chat.setDraftMessage,
    onUpdateModel: handleUpdateModel,
    onRenameConversation: chat.renameConversationRecord,
    onSelectConversation: async (conversationId) => {
      const selected = await chat.selectConversation(conversationId);
      if (selected) {
        setIsMobilePanelOpen(false);
      }
    },
    onSend: chat.send,
    onStartPairing: handleStartPairing,
    onUpdateSession: handleUpdateSession,
    onLogout: handleLogout,
    onTogglePinnedConversation: togglePinnedConversation,
    pairingCode,
    pairingError,
    pairingExpiresAt,
    pinnedConversationIds,
    providerSwitchNote: chat.providerSwitchNote,
    freeMarketplace,
    onSyncFreeMarketplace: handleSyncFreeMarketplace,
    onEnableFreeMarketplaceModel: handleEnableFreeMarketplaceModel,
    onDisableFreeMarketplaceModel: handleDisableFreeMarketplaceModel,
    modelAnalytics,
    modelsError,
    registeredModels,
    session,
    workspaces,
    onRefresh: refreshWorkspaceData,
    onNavigateSection: handleSelectSection,
  });

  return (
    <ConnectionProvider value={connectionState}>
      <div
        className={[
          "flex h-dvh w-full overflow-hidden bg-[color:var(--color-bg-base)] text-text-primary",
          workspaceThemeClass,
        ].join(" ")}
        data-workspace-shell
      >
        <WorkspaceSidebar
          activeSection={activeSection}
          isCollapsed={!isPanelOpen}
          isOverlayOpen={showMobilePanel}
          onRequestToggle={() => setIsPanelOpen((open) => !open)}
          onRequestCollapse={closeMobilePanel}
          onSelectSection={handleSelectSection}
          conversationCount={chat.conversations.length}
          session={session}
          dashboard={dashboard}
          sectionMeta={SECTION_META}
          sectionOrder={sectionOrder}
          mode={mode}
          conversationSearch={chat.conversationSearch}
          activeConversationId={chat.activeConversationId}
          onConversationSearchChange={chat.setConversationSearch}
          onCreateConversation={handleCreateConversation}
          filteredConversations={chat.filteredConversations}
          onSelectConversation={async (conversationId) => {
            const selected = await chat.selectConversation(conversationId);
            if (selected) {
              setIsMobilePanelOpen(false);
            }
          }}
          onTogglePinnedConversation={togglePinnedConversation}
          onRenameConversation={chat.renameConversationRecord}
          onDeleteConversation={async (conversationId) => {
            removePinnedConversation(conversationId);
            await chat.deleteConversationRecord(conversationId);
          }}
          pinnedConversationIds={pinnedConversationIds}
          conversationError={conversationsError}
          onLogout={handleLogout}
        />

        <main className="flex h-dvh min-w-0 flex-1 flex-col overflow-hidden">
          <header className="ui-shell-header flex h-16 flex-shrink-0 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                aria-label="Open navigation"
                aria-controls={contextPanelId}
                aria-expanded={showMobilePanel}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel)] text-text-secondary transition hover:border-[color:var(--color-border-strong)] hover:text-text-primary lg:hidden"
                onClick={() => {
                  setIsPanelOpen(true);
                  setIsMobilePanelOpen(true);
                }}
                type="button"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted lg:hidden">
                  Workspace
                </p>
                <h1 className="select-none font-headline text-lg font-medium tracking-[-0.03em] text-text-primary sm:text-xl">
                  {sectionMeta.label}
                </h1>
              </div>
            </div>

            <div className="hidden items-center font-label text-[12px] font-medium text-text-secondary lg:flex">
              <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel)] px-3 py-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  connectionState.hasError
                    ? "bg-text-muted"
                    : connectionState.connected
                      ? "bg-state-healthy"
                      : "bg-state-blocked"
                }`} />
                <span>{companionChipLabel}</span>
              </div>
            </div>

            <div className="lg:hidden">
              <div className="inline-flex max-w-[48vw] items-center gap-2 rounded-full border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel)] px-3 py-1.5 text-[11px] font-medium text-text-secondary">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  connectionState.hasError
                    ? "bg-text-muted"
                    : connectionState.connected
                      ? "bg-state-healthy"
                      : "bg-state-blocked"
                }`} />
                <span className="truncate">{mobileStatusLabel}</span>
              </div>
            </div>
          </header>

          {bootError === "Authentication required." ? (
            <AuthRedirectPanel />
          ) : bootError ? (
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              <ErrorState
                className="animate-section-change"
                message={bootError}
                title="Workspace failed to load"
              />
            </div>
          ) : null}

          {!bootError && isBooting ? (
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              <Panel className="animate-section-change p-5" eyebrow="Loading" title="Workspace">
                <div className="space-y-3">
                  <div className="h-3 w-1/3 rounded bg-[color:var(--color-bg-hover)]" />
                  <div className="h-3 w-2/3 rounded bg-[color:var(--color-bg-active)]" />
                  <div className="h-3 w-1/2 rounded bg-[color:var(--color-bg-active)]" />
                </div>
              </Panel>
            </div>
          ) : null}

          {!bootError && !isBooting ? (
            <div className="flex-grow min-h-0 overflow-hidden flex flex-col h-full animate-section-change" key={activeSection}>
              {sectionRender.mainContent}
            </div>
          ) : null}
        </main>
      </div>
    </ConnectionProvider>
  );
}

function AuthRedirectPanel() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    window.location.assign(`/login?next=${next}`);
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-8">
      <Panel className="w-full max-w-sm p-5" eyebrow="Authentication" title="Redirecting">
        <p className="text-sm text-text-secondary">
          Please sign in to continue.
        </p>
      </Panel>
    </div>
  );
}

function loadJson<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    const value = JSON.parse(rawValue) as T;
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      return value;
    }

    return value;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function saveJson<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function applyBootSectionState<T>(
  setData: (value: T) => void,
  setError: (value: string | null) => void,
  state: WorkspaceShellDataState<T>,
) {
  setData(state.data);
  setError(state.error);
}

function applyRefreshSectionState<T>(
  setData: (value: T) => void,
  setError: (value: string | null) => void,
  state: WorkspaceShellDataState<T>,
) {
  if (!state.error) {
    setData(state.data);
  }

  setError(state.error);
}
