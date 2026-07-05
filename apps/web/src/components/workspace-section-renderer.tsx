"use client";

import { useId, useState, useEffect } from "react";
import type {
  CompanionStatusResponse,
  ConversationListItem,
  ConversationMessagesResponse,
  DashboardResponse,
  SessionResponse,
  WorkspaceListItem,
} from "../lib/types";
import type { ConnectionState } from "../context/connection-context";
import { ChatEmptyState } from "./chat-empty-state";
import { CompanionPairingPanel } from "./companion-pairing-panel";
import { CompanionStatusCard } from "./companion-status-card";
import { MessageComposer } from "./message-composer";
import { MessageThread } from "./message-thread";
import { ProviderSummaryCard } from "./provider-summary-card";
import { RecentAgentRunsPanel } from "./recent-agent-runs-panel";
import { RecentConversationsPanel } from "./recent-conversations-panel";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/empty-state";
import { ErrorState } from "./ui/error-state";
import { Input } from "./ui/input";
import { Panel } from "./ui/panel";
import { StatusPill } from "./ui/status-pill";
import type { WorkspaceSection } from "./workspace-sections";
import { WorkspacesPanel } from "./workspaces-panel";

interface WorkspaceSectionLoadErrors {
  companionStatus: string | null;
  conversations: string | null;
  dashboard: string | null;
  workspaces: string | null;
}

interface WorkspaceSectionRenderArgs {
  activeConversation: ConversationMessagesResponse["conversation"] | null;
  activeConversationId: string | null;
  activeSection: WorkspaceSection;
  capacityBlocked: boolean;
  chatError: string | null;
  companionStatus: CompanionStatusResponse | null;
  connection: Pick<
    ConnectionState,
    "connected" | "cooldownCount" | "deviceId" | "eligibleCount" | "hasError" | "isLoading" | "machineLabel"
  >;
  conversationSearch: string;
  dashboard: DashboardResponse | null;
  draftMessage: string;
  filteredConversations: ConversationListItem[];
  isLoadingMessages: boolean;
  isSending: boolean;
  isStartingPairing: boolean;
  loadErrors: WorkspaceSectionLoadErrors;
  messages: ConversationMessagesResponse["messages"];
  onConversationSearchChange: (value: string) => void;
  onCreateConversation: () => Promise<void>;
  onDraftMessageChange: (value: string) => void;
  onSelectConversation: (conversationId: string) => Promise<void>;
  onSend: (text: string) => Promise<void>;
  onStartPairing: () => void;
  onTogglePinnedConversation: (conversationId: string) => void;
  pairingCode: string | null;
  pairingError: string | null;
  pairingExpiresAt: string | null;
  pinnedConversationIds: string[];
  providerSwitchNote: string | null;
  session: SessionResponse | null;
  workspaces: WorkspaceListItem[];
  onRefresh?: () => Promise<void>;
}

interface WorkspaceSectionRenderResult {
  mainContent: React.JSX.Element | null;
  panelActions: React.JSX.Element | null;
  panelBody: React.JSX.Element;
}

interface WorkspaceConversationSidebarProps {
  activeConversationId: string | null;
  conversationError: string | null;
  conversationSearch: string;
  filteredConversations: ConversationListItem[];
  onConversationSearchChange: (value: string) => void;
  onSelectConversation: (conversationId: string) => Promise<void>;
  onTogglePinnedConversation: (conversationId: string) => void;
  pinnedConversationIds: string[];
}

export function renderWorkspaceSection({
  activeConversation,
  activeConversationId,
  activeSection,
  capacityBlocked,
  chatError,
  companionStatus,
  connection,
  conversationSearch,
  dashboard,
  draftMessage,
  filteredConversations,
  isLoadingMessages,
  isSending,
  isStartingPairing,
  loadErrors,
  messages,
  onConversationSearchChange,
  onCreateConversation,
  onDraftMessageChange,
  onSelectConversation,
  onSend,
  onStartPairing,
  onTogglePinnedConversation,
  pairingCode,
  pairingError,
  pairingExpiresAt,
  pinnedConversationIds,
  providerSwitchNote,
  session,
  workspaces,
  onRefresh,
}: WorkspaceSectionRenderArgs): WorkspaceSectionRenderResult {
  const showChatEmptyState = messages.length === 0 && !isLoadingMessages;
  const connected = connection.connected;
  const machineLabel = connection.machineLabel;
  const eligibleCount = connection.eligibleCount;

  switch (activeSection) {
    case "chat":
      return {
        panelActions: (
          <Button
            className="w-full justify-center"
            onClick={() => void onCreateConversation()}
            size="md"
            type="button"
            variant="primary"
          >
            New conversation
          </Button>
        ),
        panelBody: (
          <WorkspaceConversationSidebar
            activeConversationId={activeConversationId}
            conversationError={loadErrors.conversations}
            conversationSearch={conversationSearch}
            filteredConversations={filteredConversations}
            onConversationSearchChange={onConversationSearchChange}
            onSelectConversation={onSelectConversation}
            onTogglePinnedConversation={onTogglePinnedConversation}
            pinnedConversationIds={pinnedConversationIds}
          />
        ),
        mainContent: (
          <section className="flex flex-grow flex-col overflow-hidden h-full w-full">
            {loadErrors.dashboard || providerSwitchNote || capacityBlocked || chatError ? (
              <div className="px-6 pb-4 pt-4 border-b border-white/5 flex-shrink-0">
                <SectionAlerts messages={[loadErrors.dashboard]} />

                {providerSwitchNote ? (
                  <div className="ui-alert-warning mt-3 px-3.5 py-2.5 text-xs">
                    {providerSwitchNote}
                  </div>
                ) : null}

                {capacityBlocked ? (
                  <div className="ui-alert-error mt-3 px-3.5 py-2.5 text-xs">
                    All currently configured free models are unavailable.
                  </div>
                ) : null}

                {chatError ? (
                  <div className="ui-alert-error mt-3 px-3.5 py-2.5 text-xs">
                    {chatError}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Message list - SCROLLABLE */}
            <div className="flex-grow flex flex-col min-h-0 overflow-hidden relative">
              {showChatEmptyState ? (
                <div className="flex-grow overflow-y-auto px-6 py-6 min-h-0 flex items-center justify-center">
                  <ChatEmptyState onPromptSelect={onDraftMessageChange} />
                </div>
              ) : (
                <MessageThread key={activeConversationId} isLoading={isLoadingMessages} messages={messages} isSending={isSending} />
              )}
            </div>

            {/* Composer - FIXED */}
            <div className="flex-shrink-0">
              <MessageComposer
                disabled={isSending}
                draftValue={draftMessage}
                onDraftChange={onDraftMessageChange}
                onSend={onSend}
              />
            </div>
          </section>
        ),
      };
    case "workspaces":
      {
        const renderWorkspacesSkeleton = () => (
          <div className="rounded-xl border border-white/5 bg-[#11141b]/40 p-5 space-y-4 animate-pulse w-full">
            <div className="h-4 bg-white/5 rounded w-1/4" />
            <div className="space-y-3">
              <div className="h-16 bg-white/5 rounded-xl" />
              <div className="h-16 bg-white/5 rounded-xl" />
            </div>
          </div>
        );

        return {
          panelActions: null,
          panelBody: (
            <div className="space-y-4">
              <ContextSnapshotCard
                label="Current Workspace"
                value={
                  loadErrors.dashboard
                    ? "Unavailable"
                    : dashboard?.activeWorkspace?.alias ?? "No active workspace"
                }
              />
              <ContextSnapshotCard
                label="Workspace Folders"
                value={
                  loadErrors.workspaces
                    ? "Unavailable"
                    : `${workspaces.length} directories registered`
                }
              />
            </div>
          ),
          mainContent: (
            <div className="flex-grow overflow-y-auto px-6 py-6 min-h-0 w-full">
              <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_320px]">
                {loadErrors.workspaces || loadErrors.dashboard ? (
                  <ErrorState
                    action={onRefresh ? <Button onClick={() => void onRefresh()} size="sm" type="button" variant="secondary">Retry load</Button> : undefined}
                    message={loadErrors.workspaces ?? loadErrors.dashboard ?? "Could not connect to the backend server."}
                    title="Failed to load workspaces"
                  />
                ) : !dashboard ? (
                  renderWorkspacesSkeleton()
                ) : (
                  <WorkspacesPanel workspaces={workspaces} />
                )}
                <div className="space-y-5">
                  <Panel className="p-5" eyebrow="Quick Actions">
                    <div className="space-y-2">
                      <Button
                        className="w-full justify-start"
                        onClick={() => alert("To link a new local directory, open the Loom Desktop Companion and select 'Add Workspace Folder'.")}
                        size="md"
                        type="button"
                        variant="secondary"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-3.5 w-3.5 text-accent shrink-0">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Register Local Folder
                      </Button>
                      <Button
                        className="w-full justify-start"
                        onClick={() => void onRefresh?.()}
                        size="md"
                        type="button"
                        variant="secondary"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-3.5 w-3.5 text-accent shrink-0">
                          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l.73-.73" />
                        </svg>
                        Refresh Workspace Status
                      </Button>
                    </div>
                  </Panel>
                </div>
              </section>
            </div>
          ),
        };
      }
    case "models":
      {
        const renderModelsSkeleton = () => (
          <div className="space-y-5 animate-pulse w-full">
            <div className="rounded-xl border border-white/5 bg-[#11141b]/40 p-5 space-y-4">
              <div className="h-4 bg-white/5 rounded w-1/4" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-20 bg-white/5 rounded-xl" />
                <div className="h-20 bg-white/5 rounded-xl" />
              </div>
            </div>
            <div className="rounded-xl border border-white/5 bg-[#11141b]/40 p-5 space-y-3">
              <div className="h-4 bg-white/5 rounded w-1/3" />
              <div className="h-10 bg-white/5 rounded-lg" />
              <div className="h-10 bg-white/5 rounded-lg" />
            </div>
          </div>
        );

        return {
          panelActions: null,
          panelBody: (
            <div className="space-y-4">
              <ContextSnapshotCard
                label="Active Cloud Providers"
                value="Google Gemini & OpenRouter (Cloud)"
              />
              <ContextSnapshotCard
                label="Configured Key Status"
                value="Gemini API Key: OK | OpenRouter: OK"
              />
              <ContextSnapshotCard
                label="Routing Rules"
                value={
                  connection.hasError
                    ? "Unavailable"
                    : connection.isLoading
                      ? "Checking status..."
                      : `${connection.eligibleCount} eligible cloud models; ${connection.cooldownCount} in cooldown`
                }
              />
            </div>
          ),
          mainContent: (
            <div className="flex-grow overflow-y-auto px-6 py-6 min-h-0 w-full">
              {loadErrors.dashboard ? (
                <ErrorState
                  action={onRefresh ? <Button onClick={() => void onRefresh()} size="sm" type="button" variant="secondary">Retry load</Button> : undefined}
                  message={loadErrors.dashboard}
                  title="Failed to load provider metrics"
                />
              ) : !dashboard ? (
                <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_340px]">
                  {renderModelsSkeleton()}
                  <div className="rounded-xl border border-white/5 bg-[#11141b]/40 p-5 h-64 animate-pulse w-full" />
                </section>
              ) : (
                <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_340px]">
                  <div className="space-y-5">
                    <ProviderSummaryCard providerSummary={dashboard.providerSummary} />
                    <ModelConsole
                      cloudEligibleCount={connection.eligibleCount}
                      connectionHasError={connection.hasError}
                      companionConnected={connection.connected}
                    />
                  </div>
                  <div className="space-y-5">
                    <ProviderApiSetup />
                  </div>
                </section>
              )}
            </div>
          ),
        };
      }
    case "companion":
      {
        const renderCompanionSkeleton = () => (
          <div className="space-y-5 animate-pulse w-full">
            <div className="rounded-xl border border-white/5 bg-[#11141b]/40 p-5 space-y-4">
              <div className="h-4 bg-white/5 rounded w-1/4" />
              <div className="h-24 bg-white/5 rounded-xl" />
            </div>
          </div>
        );

        return {
          panelActions: null,
          panelBody: (
            <div className="space-y-4">
              <ContextSnapshotCard
                label="Paired Machine"
                value={connection.hasError ? "Unavailable" : connected ? (machineLabel ?? "Unknown Machine") : "Disconnected"}
              />
              <ContextSnapshotCard
                label="Diagnostics State"
                value={connection.hasError ? "Unavailable" : connected ? "Companion-linked checks available" : "Companion offline"}
              />
              <ContextSnapshotCard
                label="Local WS Handshake"
                value={connection.hasError ? "Unavailable" : connected ? "Available through companion" : "Unavailable"}
              />
            </div>
          ),
          mainContent: (
            <div className="flex-grow overflow-y-auto px-6 py-6 min-h-0 w-full">
              {loadErrors.companionStatus || loadErrors.dashboard ? (
                <ErrorState
                  action={onRefresh ? <Button onClick={() => void onRefresh()} size="sm" type="button" variant="secondary">Retry load</Button> : undefined}
                  message={loadErrors.companionStatus ?? loadErrors.dashboard ?? "Could not contact companion listener."}
                  title="Failed to load companion details"
                />
              ) : !companionStatus ? (
                <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_320px]">
                  {renderCompanionSkeleton()}
                  <div className="rounded-xl border border-white/5 bg-[#11141b]/40 p-5 h-64 animate-pulse w-full" />
                </section>
              ) : (
                <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_320px]">
                  <CompanionPairingPanel
                    companion={companionStatus}
                    isStartingPairing={isStartingPairing}
                    onStartPairing={onStartPairing}
                    pairingCode={pairingCode}
                    pairingError={pairingError}
                    pairingExpiresAt={pairingExpiresAt}
                  />
                  <div className="space-y-5">
                    <Panel className="p-5" eyebrow="Machine information">
                      <div className="mt-4 space-y-3 text-xs text-text-secondary leading-relaxed">
                        <p className="flex justify-between items-center border-b border-white/5 pb-2">
                          <span className="text-text-muted">Status:</span>
                          <StatusPill tone={connected ? "success" : "error"}>
                            {connected ? "Connected" : "Disconnected"}
                          </StatusPill>
                        </p>
                        <p className="flex justify-between items-center border-b border-white/5 pb-2">
                          <span className="text-text-muted">Label:</span>
                          <span className="font-semibold text-text-primary">
                            {connected ? (machineLabel ?? "Unnamed machine") : "No machine paired"}
                          </span>
                        </p>
                        <p className="flex justify-between items-center">
                          <span className="text-text-muted">Device ID:</span>
                          <span className="font-mono text-text-primary select-all">
                            {connected ? (connection.deviceId ?? "Unavailable") : "Unavailable"}
                          </span>
                        </p>
                      </div>
                    </Panel>
                    <DiagnosticsChecklist
                      companionConnected={connection.connected}
                      connectionHasError={connection.hasError}
                      connectionIsLoading={connection.isLoading}
                    />
                  </div>
                </section>
              )}
            </div>
          ),
        };
      }
    case "activity":
      return {
        panelActions: null,
        panelBody: (
          <div className="space-y-4">
            <SectionAlerts messages={[loadErrors.dashboard]} />
            <ContextSnapshotCard
              label="Session"
              value={session?.user.displayName ?? "Loading session"}
            />
            <ContextSnapshotCard
              label="Recent chats"
              value={
                loadErrors.dashboard
                  ? "Unavailable"
                  : dashboard
                    ? `${dashboard.recentConversations.length} threads tracked`
                    : "Loading"
              }
            />
            <ContextSnapshotCard
              label="Agent runs"
              value={
                loadErrors.dashboard
                  ? "Unavailable"
                  : dashboard
                    ? `${dashboard.recentAgentRuns.length} recent executions`
                    : "Loading"
              }
            />
          </div>
        ),
        mainContent: (
          <div className="flex-grow overflow-y-auto px-6 py-6 min-h-0 w-full">
            {loadErrors.dashboard ? (
              <ErrorState
                action={onRefresh ? <Button onClick={() => void onRefresh()} size="sm" type="button" variant="secondary">Retry load</Button> : undefined}
                message={loadErrors.dashboard}
                title="Failed to load activity"
              />
            ) : dashboard ? (
              <section className="grid gap-5 xl:grid-cols-2">
                <RecentConversationsPanel conversations={dashboard.recentConversations} />
                <RecentAgentRunsPanel runs={dashboard.recentAgentRuns} />
              </section>
            ) : (
              <section className="grid gap-5 xl:grid-cols-2">
                <LoadingPanel eyebrow="Activity" title="Recent conversations" rows={3} />
                <LoadingPanel eyebrow="Automation" title="Recent agent runs" rows={3} />
              </section>
            )}
          </div>
        ),
      };
    case "settings":
      return {
        panelActions: null,
        panelBody: (
          <div className="space-y-4">
            <ContextSnapshotCard
              label="Session"
              value={session?.user.displayName ?? "Loading session"}
            />
            <ContextSnapshotCard
              label="Scope"
              value="Preferences are saved locally in the browser configuration."
            />
            <ContextSnapshotCard
              label="Diagnostics"
              value="Checking current system parameters."
            />
          </div>
        ),
        mainContent: (
          <div className="flex-grow overflow-y-auto px-6 py-6 min-h-0 w-full">
            <SettingsForm session={session} dashboard={dashboard} />
          </div>
        ),
      };
  }
}

function WorkspaceConversationSidebar({
  activeConversationId,
  conversationError,
  conversationSearch,
  filteredConversations,
  onConversationSearchChange,
  onSelectConversation,
  onTogglePinnedConversation,
  pinnedConversationIds,
}: WorkspaceConversationSidebarProps) {
  const searchInputId = useId();

  return (
    <>
      {conversationError ? <SectionAlert message={conversationError} /> : null}

      <div className="px-1 pb-4 relative flex items-center">
        <span className="absolute left-3.5 text-text-muted">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <label className="sr-only" htmlFor={searchInputId}>
          Search conversations
        </label>
        <Input
          className="pl-9 pr-3 py-1.5 text-xs"
          id={searchInputId}
          onChange={(event) => onConversationSearchChange(event.target.value)}
          placeholder="Search conversations..."
          value={conversationSearch}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {filteredConversations.length === 0 ? (
          <EmptyState
            className="px-4 py-5"
            description="Try another title or start a new conversation."
            title="No matching conversations"
          />
        ) : (
          <div className="space-y-1">
            {filteredConversations.map((conversation) => {
              const active = conversation.id === activeConversationId;
              const pinned = pinnedConversationIds.includes(conversation.id);

              return (
                <div
                  key={conversation.id}
                  className={[
                    "group relative rounded-lg p-2.5 transition select-none flex items-center justify-between gap-3",
                    active
                      ? "bg-accent/10 text-white"
                      : "hover:bg-white/[0.03] text-text-secondary hover:text-text-primary",
                  ].join(" ")}
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => void onSelectConversation(conversation.id)}
                    type="button"
                  >
                    <p className="truncate text-xs font-semibold text-text-primary">
                      {conversation.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-text-muted">
                      {conversation.lastMessageAt
                        ? new Date(conversation.lastMessageAt).toLocaleDateString()
                        : "No messages yet"}
                    </p>
                  </button>
                  <Button
                    aria-label={pinned ? "Unpin conversation" : "Pin conversation"}
                    aria-pressed={pinned}
                    className={[
                      "shrink-0 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                      pinned
                        ? "opacity-100"
                        : "text-text-muted opacity-0 group-hover:opacity-100 hover:text-text-primary",
                    ].join(" ")}
                    onClick={() => onTogglePinnedConversation(conversation.id)}
                    size="sm"
                    type="button"
                    variant={pinned ? "secondary" : "ghost"}
                  >
                    {pinned ? "Pinned" : "Pin"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function ContextSnapshotCard({ label, value }: { label: string; value: string }) {
  return (
    <Panel className="p-4" contentClassName="space-y-0">
      <p className="ui-section-label">{label}</p>
      <p className="mt-2 text-xs leading-6 text-text-secondary">{value}</p>
    </Panel>
  );
}

function SectionAlerts({ messages }: { messages: Array<string | null> }) {
  const visibleMessages = messages.filter(
    (message): message is string => Boolean(message),
  );

  if (visibleMessages.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      {visibleMessages.map((message) => (
        <SectionAlert key={message} message={message} />
      ))}
    </div>
  );
}

function SectionAlert({ message }: { message: string }) {
  return (
    <div className="ui-alert-warning px-4 py-3 text-xs">
      {message}
    </div>
  );
}

function SectionPlaceholderCard({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <Panel className="p-5" eyebrow="Notice" title={title}>
      <p className="text-xs leading-relaxed text-text-secondary">{description}</p>
    </Panel>
  );
}

function LoadingPanel({
  eyebrow,
  rows = 2,
  title,
}: {
  eyebrow: string;
  rows?: number;
  title: string;
}) {
  return (
    <Panel className="p-5 animate-pulse" eyebrow={eyebrow} title={title}>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
            <div className="h-3 w-1/3 rounded bg-white/10" />
            <div className="mt-3 h-3 w-3/4 rounded bg-white/5" />
            <div className="mt-2 h-3 w-1/2 rounded bg-white/5" />
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ============================================
// REFACtored INTERACTIVE VIEWS
// ============================================

function SettingsForm({ session, dashboard }: { session: any; dashboard: any }) {
  const [displayName, setDisplayName] = useState(session?.user.displayName ?? "Sandeep");
  const [theme, setTheme] = useState("dark");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [cooldownAlerts, setCooldownAlerts] = useState(true);
  const [companionAlerts, setCompanionAlerts] = useState(true);
  const [experimentalFix, setExperimentalFix] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("clm.workspace.sidebar_expanded");
      setSidebarExpanded(saved ? saved === "true" : true);
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveState("saving");
    setTimeout(() => {
      setSaveState("saved");
      if (typeof window !== "undefined") {
        window.localStorage.setItem("clm.workspace.sidebar_expanded", String(sidebarExpanded));
        window.dispatchEvent(new Event("storage"));
      }
      setTimeout(() => setSaveState("idle"), 2000);
    }, 1200);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
      <div className="grid gap-5 md:grid-cols-2">
        <Panel className="p-5" eyebrow="User Profile">
          <div className="mt-4 space-y-3">
            <Input id="displayNameInput" label="Display Name" onChange={(e) => setDisplayName(e.target.value)} value={displayName} />
            <Input disabled label="Email" value={session?.user.email ?? "sandeep@example.com"} />
          </div>
        </Panel>

        <Panel className="p-5" eyebrow="Appearance">
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Color Theme</label>
              <select
                className="w-full rounded-lg border border-white/5 bg-[#11141b] px-3 py-2 text-xs text-text-primary outline-none focus:border-accent/40 transition"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                <option value="dark">Dark Theme (Default)</option>
                <option value="light">Light Theme</option>
                <option value="system">Follow System</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-semibold text-text-primary">Expanded Sidebar</label>
                <p className="text-[9px] text-text-muted">Keep sidebar open by default on boot.</p>
              </div>
              <input
                type="checkbox"
                className="h-4.5 w-4.5 rounded border-white/5 bg-black/30 text-accent focus:ring-accent"
                checked={sidebarExpanded}
                onChange={(e) => setSidebarExpanded(e.target.checked)}
              />
            </div>
          </div>
        </Panel>

        <Panel className="p-5" eyebrow="Notification Rules">
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-semibold text-text-primary">Companion Warnings</label>
                <p className="text-[9px] text-text-muted">Alert me immediately if companion client disconnects.</p>
              </div>
              <input
                type="checkbox"
                className="h-4.5 w-4.5 rounded border-white/5 bg-black/30 text-accent focus:ring-accent"
                checked={companionAlerts}
                onChange={(e) => setCompanionAlerts(e.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-semibold text-text-primary">Model Cooldown Alerts</label>
                <p className="text-[9px] text-text-muted">Ping on provider rate-limit and fallback operations.</p>
              </div>
              <input
                type="checkbox"
                className="h-4.5 w-4.5 rounded border-white/5 bg-black/30 text-accent focus:ring-accent"
                checked={cooldownAlerts}
                onChange={(e) => setCooldownAlerts(e.target.checked)}
              />
            </div>
          </div>
        </Panel>

        <Panel className="p-5" eyebrow="Advanced / Experimental">
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-semibold text-text-primary">Experimental Auto-Fix</label>
                <p className="text-[9px] text-text-muted">Auto-restart backend process on compile failures.</p>
              </div>
              <input
                type="checkbox"
                className="h-4.5 w-4.5 rounded border-white/5 bg-black/30 text-accent focus:ring-accent"
                checked={experimentalFix}
                onChange={(e) => setExperimentalFix(e.target.checked)}
              />
            </div>
            <div className="text-[9px] text-text-muted bg-black/20 p-3 rounded-lg border border-white/5 leading-relaxed">
              Environment build: <span className="font-mono text-text-secondary">v0.1.0-beta.2</span> <br />
              Node.js version: <span className="font-mono text-text-secondary">v20.11.0</span>
            </div>
          </div>
        </Panel>
      </div>

      <div className="flex items-center justify-end gap-3 mt-4">
        {saveState === "saved" && (
          <StatusPill tone="success">Preferences saved successfully</StatusPill>
        )}
        <Button disabled={saveState === "saving"} isLoading={saveState === "saving"} type="submit" variant="primary">
          {saveState === "saving" ? "Saving..." : "Save Preferences"}
        </Button>
      </div>
    </form>
  );
}

function DiagnosticsChecklist({
  companionConnected,
  connectionHasError,
  connectionIsLoading,
}: {
  companionConnected: boolean;
  connectionHasError: boolean;
  connectionIsLoading: boolean;
}) {
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<string | null>(null);

  const handleFix = () => {
    setFixing(true);
    setFixResult(null);
    setTimeout(() => {
      setFixing(false);
      setFixResult("To install the Rust toolchain, run: rustup-init");
    }, 1500);
  };

  const companionDependentStatus = connectionHasError
    ? "Unavailable"
    : connectionIsLoading
      ? "Checking"
      : companionConnected
        ? "Available"
        : "Unavailable";

  const companionDependentStatusClassName = connectionHasError || !companionConnected
    ? "text-state-blocked border-state-blocked/30 bg-state-blocked/10"
    : connectionIsLoading
      ? "text-state-info border-state-info/30 bg-state-info/10"
      : "text-state-healthy border-state-healthy/30 bg-state-healthy/10";

  return (
    <Panel className="p-5" eyebrow="System Diagnostics">
      <div className="space-y-3">
        <ErrorState
          action={
            <Button disabled={fixing} onClick={handleFix} size="sm" type="button" variant="secondary">
              {fixing ? "Fixing..." : "Fix Compiler"}
            </Button>
          }
          className="items-start p-4 text-left"
          message={fixResult ?? "Required to build local Rust plugins and verify Cargo metadata."}
          title="Rust toolchain integration missing compiler"
        />

        <Panel className="bg-black/20 p-2.5" contentClassName="space-y-0">
          <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-text-primary">Local WebSockets Listener</p>
            <p className="text-[9.5px] text-text-muted mt-0.5 leading-relaxed">Derived from the active companion connection. No independent listener probe exists yet.</p>
          </div>
          <StatusPill className={companionDependentStatusClassName} tone={connectionHasError || !companionConnected ? "error" : connectionIsLoading ? "info" : "success"}>
            {companionDependentStatus}
          </StatusPill>
          </div>
        </Panel>

        <Panel className="bg-black/20 p-2.5" contentClassName="space-y-0">
          <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-text-primary">Companion API Handshake</p>
            <p className="text-[9.5px] text-text-muted mt-0.5 leading-relaxed">Available only when the desktop companion is connected and identified.</p>
          </div>
          <StatusPill className={companionDependentStatusClassName} tone={connectionHasError || !companionConnected ? "error" : connectionIsLoading ? "info" : "success"}>
            {companionDependentStatus}
          </StatusPill>
          </div>
        </Panel>

        <Panel className="bg-black/20 p-2.5" contentClassName="space-y-0">
          <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-text-primary">Background Execution Engine</p>
            <p className="text-[9.5px] text-text-muted mt-0.5 leading-relaxed">This UI only knows whether the companion connection is present; deeper engine health is not yet exposed.</p>
          </div>
          <StatusPill className={companionDependentStatusClassName} tone={connectionHasError || !companionConnected ? "error" : connectionIsLoading ? "info" : "success"}>
            {companionDependentStatus}
          </StatusPill>
          </div>
        </Panel>
      </div>
    </Panel>
  );
}

function ProviderApiSetup() {
  const [routerKey, setRouterKey] = useState("sk-or-••••••••••••••••••••••••••••••••");
  const [geminiKey, setGeminiKey] = useState("AIzaSy••••••••••••••••••••••••••••");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 1500);
  };

  return (
    <form onSubmit={handleSave}>
      <Panel className="p-5" eyebrow="API Keys Setup">
      <div className="space-y-4">
        <Input
          label="OpenRouter API Key"
          onChange={(e) => setRouterKey(e.target.value)}
          revealable
          value={routerKey}
        />

        <Input
          label="Gemini API Key"
          onChange={(e) => setGeminiKey(e.target.value)}
          revealable
          value={geminiKey}
        />
        <p className="text-[9.5px] text-text-muted leading-relaxed">
          API keys require explicit save to apply to the active session.
        </p>

        <div className="flex items-center justify-between gap-3 pt-2">
          {saved ? <StatusPill tone="success">Saved successfully</StatusPill> : <span />}
          <Button className="ml-auto" disabled={saving} isLoading={saving} type="submit" variant="primary">
            {saving ? "Saving..." : "Save Keys"}
          </Button>
        </div>
      </div>
      </Panel>
    </form>
  );
}

function ModelConsole({
  cloudEligibleCount,
  connectionHasError,
  companionConnected,
}: {
  cloudEligibleCount: number;
  connectionHasError: boolean;
  companionConnected: boolean;
}) {
  const modelsList = [
    { name: "Gemini 1.5 Pro", provider: "Google Gemini", type: "Pro" },
    { name: "Gemini 1.5 Flash", provider: "Google Gemini", type: "Fast" },
    { name: "Claude 3.5 Sonnet", provider: "OpenRouter", type: "Pro" },
    { name: "Llama 3 70B", provider: "OpenRouter", type: "Standard" },
  ];

  const cloudStatusLabel = connectionHasError
    ? "Unavailable"
    : cloudEligibleCount > 0
      ? "Eligible"
      : "Unavailable";
  const cloudStatusClassName = connectionHasError || cloudEligibleCount === 0
    ? "text-state-blocked border-state-blocked/20 bg-state-blocked/10"
    : "text-state-healthy border-state-healthy/20 bg-state-healthy/10";
  const companionStatusLabel = connectionHasError
    ? "Unavailable"
    : companionConnected
      ? "Online"
      : "Offline";
  const companionStatusClassName = connectionHasError || !companionConnected
    ? "text-state-blocked border-state-blocked/20 bg-state-blocked/10"
    : "text-state-healthy border-state-healthy/20 bg-state-healthy/10";

  return (
    <Panel className="p-5" eyebrow="Eligible routing models">
      <div className="space-y-2">
        {modelsList.map((model) => (
          <Panel key={model.name} className="bg-black/20 p-2.5" contentClassName="space-y-0">
            <div className="flex items-center justify-between text-xs">
              <div>
                <p className="font-semibold text-text-primary">{model.name}</p>
                <p className="mt-0.5 text-[9px] text-text-muted">{model.provider} - {model.type}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                <div className="flex items-center gap-1">
                  <StatusPill className={cloudStatusClassName} tone={connectionHasError || cloudEligibleCount === 0 ? "error" : "success"}>
                    Cloud: {cloudStatusLabel}
                  </StatusPill>
                  <StatusPill className={companionStatusClassName} tone={connectionHasError || !companionConnected ? "error" : "success"}>
                    Companion: {companionStatusLabel}
                  </StatusPill>
                </div>
                <p className="mt-0.5 text-[9px] text-text-muted">
                  Route class: <span className="font-mono text-text-secondary">cloud model</span>
                </p>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </Panel>
  );
}
