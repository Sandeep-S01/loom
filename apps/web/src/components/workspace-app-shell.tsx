"use client";

import { useEffect, useId, useRef, useState } from "react";
import { startPairing } from "../lib/api";
import type {
  CompanionStatusResponse,
  DashboardResponse,
  SessionResponse,
  WorkspaceListItem,
} from "../lib/types";
import { renderWorkspaceSection } from "./workspace-section-renderer";
import {
  SECTION_META,
  SECTION_ORDER,
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

interface WorkspaceAppShellProps {
  initialSection?: WorkspaceSection;
}

const PINNED_CONVERSATIONS_KEY = "clm.workspace.pinned_conversations";
const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

export function WorkspaceAppShell({
  initialSection = "chat",
}: WorkspaceAppShellProps) {
  const isMountedRef = useRef(true);
  const contextPanelId = useId();
  const [activeSection, setActiveSection] = useState<WorkspaceSection>(initialSection);
  const [isPanelOpen, setIsPanelOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("clm.workspace.sidebar_expanded");
      return saved ? saved === "true" : true;
    }
    return true;
  });
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [companionStatus, setCompanionStatus] =
    useState<CompanionStatusResponse | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [companionStatusError, setCompanionStatusError] = useState<string | null>(null);
  const [workspacesError, setWorkspacesError] = useState<string | null>(null);
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

  const chat = useWorkspaceChatController({
    isMountedRef,
    onRefreshWorkspaceData: refreshWorkspaceData,
    pinnedConversationIds,
  });

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
    if (typeof window !== "undefined") {
      window.localStorage.setItem("clm.workspace.sidebar_expanded", String(isPanelOpen));
    }
  }, [isPanelOpen]);

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
        chat.hydrateConversations(bootstrapData.conversations.data);

        const firstConversation = bootstrapData.conversations.data[0];
        if (firstConversation) {
          await chat.selectConversation(firstConversation.id);
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
  }, []);

  async function refreshWorkspaceData() {
    const contextData = await loadWorkspaceShellContextData();

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
  }

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

  function handleSelectSection(section: WorkspaceSection) {
    const isMobileViewport =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches;

    setActiveSection((current) => {
      if (current === section) {
        if (isMobileViewport) {
          setIsPanelOpen(true);
          setIsMobilePanelOpen((open) => !open);
          return current;
        }

        setIsPanelOpen((open) => !open);
        return current;
      }

      setIsPanelOpen(true);
      setIsMobilePanelOpen(isMobileViewport);
      return section;
    });
  }

  function closeMobilePanel() {
    setIsMobilePanelOpen(false);
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

  const sectionMeta = SECTION_META[activeSection];
  const showMobilePanel = isPanelOpen && isMobilePanelOpen;
  const isContextPanelVisible = isDesktopViewport ? isPanelOpen : showMobilePanel;
  const sessionChipLabel = session?.user.displayName ?? "Loading session";
  const companionChipLabel = connectionState.hasError
    ? "Companion status unavailable"
    : connectionState.connected
      ? "Companion online"
      : "Companion offline";
  const modelChipLabel = connectionState.hasError
    ? "Model status unavailable"
    : `${connectionState.eligibleCount} eligible models`;
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
    onConversationSearchChange: chat.setConversationSearch,
    onCreateConversation: handleCreateConversation,
    onDraftMessageChange: chat.setDraftMessage,
    onSelectConversation: async (conversationId) => {
      const selected = await chat.selectConversation(conversationId);
      if (selected) {
        setIsMobilePanelOpen(false);
      }
    },
    onSend: chat.send,
    onStartPairing: handleStartPairing,
    onTogglePinnedConversation: togglePinnedConversation,
    pairingCode,
    pairingError,
    pairingExpiresAt,
    pinnedConversationIds,
    providerSwitchNote: chat.providerSwitchNote,
    session,
    workspaces,
    onRefresh: refreshWorkspaceData,
  });

  return (
    <ConnectionProvider value={connectionState}>
      <div className="flex h-screen w-screen overflow-hidden bg-[color:var(--color-bg-base)] text-text-primary">
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
          sectionOrder={SECTION_ORDER}
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
          pinnedConversationIds={pinnedConversationIds}
          conversationError={conversationsError}
          panelBody={sectionRender.panelBody}
        />

        <main className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
          <header className="ui-shell-header flex h-14 flex-shrink-0 items-center justify-between px-6 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <button
                aria-controls={contextPanelId}
                aria-expanded={showMobilePanel}
                className="rounded-lg border border-white/5 bg-white/[0.02] p-1.5 text-text-secondary transition hover:border-white/10 hover:text-text-primary lg:hidden"
                onClick={() => {
                  setIsPanelOpen(true);
                  setIsMobilePanelOpen(true);
                }}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-xs font-semibold uppercase tracking-wider text-text-secondary select-none lg:block hidden">
                {sectionMeta.label}
              </h1>
            </div>

            <div className="flex items-center gap-4 text-[11px] font-medium text-text-secondary">
              {/* Session */}
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                <span>{sessionChipLabel}</span>
              </div>
              <span className="text-white/5">|</span>
              {/* Companion Status */}
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  connectionState.hasError
                    ? "bg-[#64748b]"
                    : connectionState.connected
                      ? "bg-state-healthy"
                      : "bg-state-blocked"
                }`} />
                <span>{companionChipLabel}</span>
              </div>
              <span className="text-white/5">|</span>
              {/* Eligible Models */}
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${connectionState.hasError ? "bg-state-blocked" : "bg-state-info"}`} />
                <span>{modelChipLabel}</span>
              </div>
            </div>
          </header>

          {bootError ? (
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <ErrorState
                className="animate-section-change"
                message={bootError}
                title="Workspace failed to load"
              />
            </div>
          ) : null}

          {!bootError && isBooting ? (
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <Panel className="animate-section-change p-5" eyebrow="Loading" title="Workspace">
                <div className="space-y-3">
                  <div className="h-3 w-1/3 rounded bg-white/10" />
                  <div className="h-3 w-2/3 rounded bg-white/5" />
                  <div className="h-3 w-1/2 rounded bg-white/5" />
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
