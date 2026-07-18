"use client";

import { useId, useState, useEffect } from "react";
import {
  ArrowRight,
  Folder,
  LayoutDashboard,
  MessageSquare,
  Monitor,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type {
  AvailableModelItem,
  CompanionStatusResponse,
  ConversationListItem,
  ConversationMessagesResponse,
  DashboardResponse,
  FreeMarketplaceResponse,
  ModelAnalyticsResponse,
  ModelRegistryItem,
  ProvidersResponse,
  SessionResponse,
  WorkspaceListItem,
} from "../lib/types";
import type { ConnectionState } from "../context/connection-context";
import { ChatEmptyState } from "./chat-empty-state";
import { CompanionPairingPanel } from "./companion-pairing-panel";
import { MessageComposer } from "./message-composer";
import { toComposerModelOptions } from "./message-composer-state";
import { MessageThread } from "./message-thread";
import { ProviderSummaryCard } from "./provider-summary-card";
import { RecentAgentRunsPanel } from "./recent-agent-runs-panel";
import { RecentConversationsPanel } from "./recent-conversations-panel";
import { RecentConversationRow } from "./recent-conversation-row";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/empty-state";
import { LiveDataPanel } from "./ui/live-data-panel";
import { TraceSequence } from "./ui/trace-sequence";
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
  availableModels: AvailableModelItem[];
  providersStatus: ProvidersResponse | null;
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
  modelAnalytics: ModelAnalyticsResponse;
  modelsError: string | null;
  messages: ConversationMessagesResponse["messages"];
  pendingModelId: string | null;
  onConversationSearchChange: (value: string) => void;
  onCreateConversation: () => Promise<void>;
  onCreateModel: (input: {
    providerId: string;
    providerModelId: string;
    displayName: string;
    secretRef?: string | null;
    priorityRank: number;
    supportsChat: boolean;
    supportsAgent: boolean;
    supportsVision?: boolean;
    adminStatus: "active" | "disabled";
    requestsPerMinuteLimit?: number | null;
    tokensPerDayLimit?: number | null;
    costInputPer1mUsdMicros?: number | null;
    costOutputPer1mUsdMicros?: number | null;
  }) => Promise<void>;
  onDeleteModel: (modelId: string) => Promise<void>;
  onDraftMessageChange: (value: string) => void;
  onSelectConversation: (conversationId: string) => Promise<void>;
  onRenameConversation: (conversationId: string, title: string) => Promise<void>;
  onDeleteConversation: (conversationId: string) => Promise<void>;
  onSend: (input: {
    text: string;
    modelId: string | null;
    images?: Extract<ConversationMessagesResponse["messages"][number]["content"][number], { type: "image" }>[];
  }) => Promise<void>;
  onStartPairing: () => void;
  onUpdateSession: (input: { displayName: string }) => Promise<SessionResponse>;
  onLogout: () => Promise<void>;
  onTogglePinnedConversation: (conversationId: string) => void;
  pairingCode: string | null;
  pairingError: string | null;
  pairingExpiresAt: string | null;
  pinnedConversationIds: string[];
  providerSwitchNote: string | null;
  freeMarketplace: FreeMarketplaceResponse;
  onSyncFreeMarketplace: () => Promise<void>;
  onEnableFreeMarketplaceModel: (modelId: string) => Promise<void>;
  onDisableFreeMarketplaceModel: (modelId: string) => Promise<void>;
  registeredModels: ModelRegistryItem[];
  session: SessionResponse | null;
  workspaces: WorkspaceListItem[];
  onUpdateModel: (
    modelId: string,
    input: Partial<ModelRegistryItem> & {
      providerId?: string;
      providerModelId?: string;
      displayName?: string;
      secretRef?: string | null;
    },
  ) => Promise<void>;
  onRefresh?: () => Promise<void>;
  onNavigateSection?: (section: WorkspaceSection) => void;
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
  onRenameConversation: (conversationId: string, title: string) => Promise<void>;
  onDeleteConversation: (conversationId: string) => Promise<void>;
  onTogglePinnedConversation: (conversationId: string) => void;
  pinnedConversationIds: string[];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function renderWorkspaceSection({
  activeConversation,
  activeConversationId,
  activeSection,
  availableModels,
  providersStatus,
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
  modelAnalytics,
  modelsError,
  messages,
  pendingModelId,
  onConversationSearchChange,
  onCreateConversation,
  onCreateModel,
  onDeleteModel,
  onDraftMessageChange,
  onSelectConversation,
  onUpdateModel,
  onRenameConversation,
  onDeleteConversation,
  onSend,
  onStartPairing,
  onUpdateSession,
  onLogout,
  onTogglePinnedConversation,
  pairingCode,
  pairingError,
  pairingExpiresAt,
  pinnedConversationIds,
  providerSwitchNote,
  freeMarketplace,
  onSyncFreeMarketplace,
  onEnableFreeMarketplaceModel,
  onDisableFreeMarketplaceModel,
  registeredModels,
  session,
  workspaces,
  onRefresh,
  onNavigateSection,
}: WorkspaceSectionRenderArgs): WorkspaceSectionRenderResult {
  const showChatEmptyState = messages.length === 0 && !isLoadingMessages;
  const connected = connection.connected;
  const machineLabel = connection.machineLabel;
  const eligibleCount = connection.eligibleCount;

  switch (activeSection) {
    case "dashboard":
      return {
        panelActions: (
          <Button
            className="w-full justify-center"
            onClick={() => void onCreateConversation()}
            size="md"
            type="button"
            variant="primary"
          >
            New chat
          </Button>
        ),
        panelBody: (
          <div className="space-y-4">
            <ContextSnapshotCard
              label="Signed in as"
              value={session?.user.displayName ?? "Loading session"}
            />
            <ContextSnapshotCard
              label="Models"
              value={
                connection.hasError
                  ? "Model status unavailable"
                  : `${connection.eligibleCount} eligible models; ${connection.cooldownCount} cooling down`
              }
            />
            <ContextSnapshotCard
              label="Companion"
              value={
                connection.hasError
                  ? "Companion status unavailable"
                  : connected
                    ? machineLabel ?? "Connected"
                    : "Offline"
              }
            />
          </div>
        ),
        mainContent: (
          <div className="workspace-scroll">
            {loadErrors.dashboard ? (
              <ErrorState
                action={onRefresh ? <Button onClick={() => void onRefresh()} size="sm" type="button" variant="secondary">Retry load</Button> : undefined}
                message={loadErrors.dashboard}
                title="Dashboard failed to load"
              />
            ) : (
              <CustomerDashboard
                activeWorkspace={dashboard?.activeWorkspace ?? null}
                companionConnected={connected}
                conversationCount={filteredConversations.length}
                eligibleModelCount={connection.eligibleCount}
                isLoading={!dashboard}
                machineLabel={machineLabel}
                onCreateConversation={onCreateConversation}
                onNavigateSection={onNavigateSection}
                onStartPairing={onStartPairing}
                recentConversations={dashboard?.recentConversations ?? []}
                session={session}
                workspacesCount={workspaces.length}
              />
            )}
          </div>
        ),
      };
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
            onRenameConversation={onRenameConversation}
            onDeleteConversation={onDeleteConversation}
            onTogglePinnedConversation={onTogglePinnedConversation}
            pinnedConversationIds={pinnedConversationIds}
          />
        ),
        mainContent: (
          <section className="flex flex-grow flex-col overflow-hidden h-full w-full">
            {loadErrors.dashboard || providerSwitchNote || capacityBlocked || chatError ? (
              <div className="px-6 pb-4 pt-4 border-b border-[color:var(--color-border-subtle)] flex-shrink-0">
                <SectionAlerts messages={[loadErrors.dashboard]} />

                {providerSwitchNote ? (
                  <div className="ui-alert-warning mt-3 px-3.5 py-2.5 text-xs">
                    {providerSwitchNote}
                  </div>
                ) : null}

                {capacityBlocked && !chatError ? (
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
                <div className="flex-grow overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 min-h-0 flex items-center justify-center">
                  <ChatEmptyState onPromptSelect={onDraftMessageChange} />
                </div>
              ) : (
                <MessageThread
                  key={activeConversationId}
                  availableModels={availableModels}
                  isLoading={isLoadingMessages}
                  isSending={isSending}
                  messages={messages}
                  onRegenerate={onSend}
                  pendingModelId={pendingModelId}
                  providersStatus={providersStatus}
                />
              )}
            </div>

            {/* Composer - FIXED */}
            <div className="flex-shrink-0">
              <MessageComposer
                availableModels={toComposerModelOptions(availableModels)}
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
          <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)] p-5 space-y-4 animate-pulse w-full">
            <div className="h-4 bg-[color:var(--color-bg-hover)] rounded w-1/4" />
            <div className="space-y-3">
              <div className="h-16 bg-[color:var(--color-bg-hover)] rounded-xl" />
              <div className="h-16 bg-[color:var(--color-bg-hover)] rounded-xl" />
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
            <div className="workspace-scroll">
              <section className="workspace-page grid workspace-grid-gap xl:grid-cols-[minmax(0,1.1fr)_320px]">
                {loadErrors.workspaces || loadErrors.dashboard ? (
                  <ErrorState
                    action={onRefresh ? <Button onClick={() => void onRefresh()} size="sm" type="button" variant="secondary">Retry load</Button> : undefined}
                    message={loadErrors.workspaces ?? loadErrors.dashboard ?? "Could not connect to the backend server."}
                    title="Failed to load workspaces"
                  />
                ) : !dashboard ? (
                  renderWorkspacesSkeleton()
                ) : (
                  <WorkspacesPanel
                    onRequestPairing={onStartPairing}
                    workspaces={workspaces}
                  />
                )}
                <div className="space-y-5">
                  <Panel className="p-5" eyebrow="Quick Actions">
                    <div className="space-y-2">
                      <Button
                        className="w-full justify-start"
                        isLoading={isStartingPairing}
                        onClick={onStartPairing}
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
            <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)] p-5 space-y-4">
              <div className="h-4 bg-[color:var(--color-bg-hover)] rounded w-1/4" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-20 bg-[color:var(--color-bg-hover)] rounded-xl" />
                <div className="h-20 bg-[color:var(--color-bg-hover)] rounded-xl" />
              </div>
            </div>
            <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)] p-5 space-y-3">
              <div className="h-4 bg-[color:var(--color-bg-hover)] rounded w-1/3" />
              <div className="h-10 bg-[color:var(--color-bg-hover)] rounded-lg" />
              <div className="h-10 bg-[color:var(--color-bg-hover)] rounded-lg" />
            </div>
          </div>
        );

        return {
          panelActions: null,
          panelBody: (
            <div className="space-y-4">
              <ContextSnapshotCard
                label="Active Cloud Providers"
                value={formatActiveProviderSummary(providersStatus, availableModels)}
              />
              <ContextSnapshotCard
                label="Configured Key Status"
                value={formatKeyStatusSummary(providersStatus, availableModels)}
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
            <div className="workspace-scroll">
              {loadErrors.dashboard ? (
                <ErrorState
                  action={onRefresh ? <Button onClick={() => void onRefresh()} size="sm" type="button" variant="secondary">Retry load</Button> : undefined}
                  message={loadErrors.dashboard}
                  title="Failed to load provider metrics"
                />
              ) : !dashboard ? (
                <section className="workspace-page grid workspace-grid-gap xl:grid-cols-[minmax(0,1.05fr)_340px]">
                  {renderModelsSkeleton()}
                  <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)] p-5 h-64 animate-pulse w-full" />
                </section>
              ) : (
                <section className="workspace-page grid workspace-grid-gap xl:grid-cols-[minmax(0,1.05fr)_340px]">
                  <div className="space-y-5">
                    <ProviderSummaryCard providerSummary={dashboard.providerSummary} />
                    <ModelUsageOverview
                      analytics={modelAnalytics}
                      models={registeredModels}
                    />
                  </div>
                  <div className="space-y-5">
                    <FreeModelMarketplacePanel
                      marketplace={freeMarketplace}
                      onDisableModel={onDisableFreeMarketplaceModel}
                      onEnableModel={onEnableFreeMarketplaceModel}
                      onSync={onSyncFreeMarketplace}
                    />
                    <ModelsRegistryPanel
                      analytics={modelAnalytics}
                      errorMessage={modelsError}
                      models={registeredModels}
                      onCreateModel={onCreateModel}
                      onDeleteModel={onDeleteModel}
                      onUpdateModel={onUpdateModel}
                      providersStatus={providersStatus}
                    />
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
            <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)] p-5 space-y-4">
              <div className="h-4 bg-[color:var(--color-bg-hover)] rounded w-1/4" />
              <div className="h-24 bg-[color:var(--color-bg-hover)] rounded-xl" />
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
            <div className="workspace-scroll">
              {loadErrors.companionStatus || loadErrors.dashboard ? (
                <ErrorState
                  action={onRefresh ? <Button onClick={() => void onRefresh()} size="sm" type="button" variant="secondary">Retry load</Button> : undefined}
                  message={loadErrors.companionStatus ?? loadErrors.dashboard ?? "Could not contact companion listener."}
                  title="Failed to load companion details"
                />
              ) : !companionStatus ? (
                <section className="workspace-page grid workspace-grid-gap xl:grid-cols-[minmax(0,1.1fr)_320px]">
                  {renderCompanionSkeleton()}
                  <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)] p-5 h-64 animate-pulse w-full" />
                </section>
              ) : (
                <section className="workspace-page grid workspace-grid-gap xl:grid-cols-[minmax(0,1.1fr)_320px]">
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
                        <p className="flex items-center justify-between border-b border-[color:var(--color-border-subtle)] pb-2">
                          <span className="text-text-muted">Status:</span>
                          <StatusPill tone={connected ? "success" : "error"}>
                            {connected ? "Connected" : "Disconnected"}
                          </StatusPill>
                        </p>
                        <p className="flex items-center justify-between border-b border-[color:var(--color-border-subtle)] pb-2">
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
          <div className="flex-grow overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 min-h-0 w-full">
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
              value="Profile updates are saved to your account. UI preferences are saved locally."
            />
            <ContextSnapshotCard
              label="Diagnostics"
              value="Checking current system parameters."
            />
          </div>
        ),
        mainContent: (
          <div className="flex-grow overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 min-h-0 w-full">
            <SettingsForm
              dashboard={dashboard}
              onLogout={onLogout}
              onUpdateSession={onUpdateSession}
              session={session}
            />
          </div>
        ),
      };
  }
}

function CustomerDashboard({
  activeWorkspace,
  companionConnected,
  conversationCount,
  eligibleModelCount,
  isLoading,
  machineLabel,
  onCreateConversation,
  onNavigateSection,
  onStartPairing,
  recentConversations,
  session,
  workspacesCount,
}: {
  activeWorkspace: DashboardResponse["activeWorkspace"] | null;
  companionConnected: boolean;
  conversationCount: number;
  eligibleModelCount: number;
  isLoading: boolean;
  machineLabel: string | null;
  onCreateConversation: () => Promise<void>;
  onNavigateSection?: (section: WorkspaceSection) => void;
  onStartPairing: () => void;
  recentConversations: DashboardResponse["recentConversations"];
  session: SessionResponse | null;
  workspacesCount: number;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <LoadingPanel eyebrow="Loading" rows={3} title="Customer dashboard" />
        <LoadingPanel eyebrow="Preparing" rows={3} title="Workspace status" />
      </div>
    );
  }

  const displayName = session?.user.displayName ?? "User";
  const firstName = displayName.split(" ")[0] || displayName;
  const systemReady = eligibleModelCount > 0;

  const setupActions = [
    {
      title: "Connect local workspace",
      description: companionConnected
        ? `${machineLabel ?? "Companion"} is ready.`
        : "Pair the desktop app to use local folders.",
      icon: Monitor,
      onClick: () =>
        companionConnected
          ? onNavigateSection?.("workspaces")
          : onStartPairing(),
      cta: companionConnected ? "Open workspaces" : "Pair companion",
    },
    {
      title: activeWorkspace ? "Active workspace" : "Choose a folder",
      description: activeWorkspace
        ? activeWorkspace.alias
        : "Register a local folder when the companion is paired.",
      icon: Folder,
      onClick: () => onNavigateSection?.("workspaces"),
      cta: activeWorkspace ? "View folder" : "Open workspaces",
    },
  ];

  return (
    <div className="workspace-page flex flex-col gap-5">
      <section className="rounded-lg border border-[color:var(--color-border-subtle)] bg-surface p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="ui-section-label text-[color:var(--color-accent)]">Workspace</p>
            <h2 className="mt-3 font-headline text-3xl font-medium tracking-[-0.035em] text-text-primary md:text-[2.35rem]">
              Welcome back, {firstName}.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-text-secondary">
              Start a chat or connect a local workspace when you need project context.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
            <Button
              className="min-w-[148px] justify-center"
              onClick={() => void onCreateConversation()}
              type="button"
              variant="primary"
            >
              <Sparkles aria-hidden="true" size={16} strokeWidth={1.5} />
              Start chat
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <Panel className="p-5" eyebrow="Setup" title="Workspace context">
          <div className="space-y-3">
            {setupActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  className="group flex w-full items-center gap-3 rounded-lg border border-[color:var(--color-border-subtle)] bg-surface px-4 py-3.5 text-left transition hover:border-accent/40 hover:bg-[color:var(--color-bg-hover)]"
                  key={action.title}
                  onClick={action.onClick}
                  type="button"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel)] text-accent">
                    <Icon aria-hidden="true" size={17} strokeWidth={1.5} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-text-primary">
                      {action.title}
                    </span>
                    <span className="mt-1 block truncate text-xs leading-relaxed text-text-secondary">
                      {action.description}
                    </span>
                  </span>
                  <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-accent sm:flex">
                    {action.cta}
                    <ArrowRight
                      aria-hidden="true"
                      className="transition group-hover:translate-x-0.5"
                      size={14}
                      strokeWidth={1.5}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>

        <LiveDataPanel
          badge="Activity"
        >
          {recentConversations.length === 0 ? (
            <div className="rounded-md border border-dashed border-[color:var(--color-border-subtle)] px-4 py-7 text-center">
              <p className="text-sm font-semibold text-text-primary">No chats yet</p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">Your recent conversations will appear here.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentConversations.slice(0, 3).map((chat) => (
                <button
                  key={chat.id}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-[color:var(--color-bg-hover)]"
                  onClick={() => onNavigateSection?.("chat")}
                >
                  <span className="flex-1 truncate text-sm font-medium text-text-primary">
                    {chat.title}
                  </span>
                  <span className="shrink-0 text-[10px] uppercase text-text-muted">
                    {chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleDateString() : "NEW"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </LiveDataPanel>
      </section>

      <section className="grid gap-3 rounded-lg border border-[color:var(--color-border-subtle)] bg-surface p-4 text-sm text-text-secondary md:grid-cols-3">
        <StatusSummaryItem label="Chats" value={conversationCount} />
        <StatusSummaryItem label="Workspace" value={activeWorkspace?.alias ?? `${workspacesCount} folders`} />
        <StatusSummaryItem
          label="System"
          tone={systemReady ? "ready" : "blocked"}
          value={systemReady ? `${eligibleModelCount} models ready` : "No models available"}
        />
      </section>
    </div>
  );
}

function StatusSummaryItem({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "neutral" | "ready" | "blocked";
  value: string | number;
}) {
  const dotClass =
    tone === "ready"
      ? "bg-[color:var(--color-accent)]"
      : tone === "blocked"
        ? "bg-state-blocked"
        : "bg-[color:var(--color-border-strong)]";

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className={["h-1.5 w-1.5 shrink-0 rounded-full", dotClass].join(" ")} />
      <span className="shrink-0 text-xs font-medium text-text-muted">{label}</span>
      <span className="truncate text-sm font-semibold text-text-primary">{value}</span>
    </div>
  );
}

function WorkspaceConversationSidebar({
  activeConversationId,
  conversationError,
  conversationSearch,
  filteredConversations,
  onConversationSearchChange,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
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
                <RecentConversationRow
                  key={conversation.id}
                  active={active}
                  conversation={conversation}
                  onDelete={onDeleteConversation}
                  onRename={onRenameConversation}
                  onSelect={onSelectConversation}
                  onTogglePinned={onTogglePinnedConversation}
                  pinned={pinned}
                  subtitle={
                    conversation.lastMessageAt
                      ? new Date(conversation.lastMessageAt).toLocaleDateString()
                      : "No messages yet"
                  }
                />
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

function collectProviderNames(
  providersStatus: ProvidersResponse | null,
  availableModels: AvailableModelItem[],
) {
  if (providersStatus && providersStatus.providers.length > 0) {
    return providersStatus.providers.map((provider) => provider.name);
  }

  return Array.from(new Set(availableModels.map((model) => model.providerName)));
}

function formatActiveProviderSummary(
  providersStatus: ProvidersResponse | null,
  availableModels: AvailableModelItem[],
) {
  const providerNames = collectProviderNames(providersStatus, availableModels);

  if (providerNames.length === 0) {
    return "No eligible providers detected";
  }

  return providerNames.join(" | ");
}

function formatKeyStatusSummary(
  providersStatus: ProvidersResponse | null,
  availableModels: AvailableModelItem[],
) {
  if (providersStatus && providersStatus.providers.length > 0) {
    return providersStatus.providers
      .map((provider) => `${provider.name}: ${provider.keyConfigured ? "configured" : "missing"}`)
      .join(" | ");
  }

  const providerNames = collectProviderNames(providersStatus, availableModels);

  if (providerNames.length === 0) {
    return "Provider configuration unavailable";
  }

  return providerNames
    .map((providerName) => `${providerName}: managed in backend environment`)
    .join(" | ");
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
          <div key={index} className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)] p-4">
            <div className="h-3 w-1/3 rounded bg-[color:var(--color-bg-hover)]" />
            <div className="mt-3 h-3 w-3/4 rounded bg-[color:var(--color-bg-active)]" />
            <div className="mt-2 h-3 w-1/2 rounded bg-[color:var(--color-bg-active)]" />
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ============================================
// REFACtored INTERACTIVE VIEWS
// ============================================

function SettingsForm({
  session,
  dashboard,
  onLogout,
  onUpdateSession,
}: {
  session: SessionResponse | null;
  dashboard: DashboardResponse | null;
  onLogout: () => Promise<void>;
  onUpdateSession: (input: { displayName: string }) => Promise<SessionResponse>;
}) {
  const [displayName, setDisplayName] = useState(session?.user.displayName ?? "");
  const [theme, setTheme] = useState("dark");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [cooldownAlerts, setCooldownAlerts] = useState(true);
  const [companionAlerts, setCompanionAlerts] = useState(true);
  const [experimentalFix, setExperimentalFix] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const applyThemePreference = (nextTheme: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const useDarkTheme = nextTheme === "system" ? prefersDark : nextTheme === "dark";
    const shell = window.document.querySelector("[data-workspace-shell]");

    window.document.documentElement.classList.remove("dark", "light");
    shell?.classList.toggle("workspace-theme-dark", useDarkTheme);
    shell?.classList.toggle("workspace-theme-light", !useDarkTheme);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("clm.workspace.sidebar_expanded");
      setSidebarExpanded(saved ? saved === "true" : true);
      const savedTheme = window.localStorage.getItem("clm.workspace.theme") ?? "dark";
      setTheme(savedTheme);
      applyThemePreference(savedTheme);
      setCooldownAlerts(window.localStorage.getItem("clm.workspace.cooldown_alerts") !== "false");
      setCompanionAlerts(window.localStorage.getItem("clm.workspace.companion_alerts") !== "false");
      setExperimentalFix(window.localStorage.getItem("clm.workspace.experimental_fix") === "true");
    }
  }, []);

  useEffect(() => {
    setDisplayName(session?.user.displayName ?? "");
  }, [session?.user.displayName]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedDisplayName = displayName.trim();
    if (!trimmedDisplayName) {
      setSaveState("error");
      setSaveError("Display name is required.");
      return;
    }

    setSaveState("saving");
    setSaveError(null);

    try {
      await onUpdateSession({ displayName: trimmedDisplayName });
      setSaveState("saved");
      if (typeof window !== "undefined") {
        window.localStorage.setItem("clm.workspace.sidebar_expanded", String(sidebarExpanded));
        window.localStorage.setItem("clm.workspace.theme", theme);
        window.localStorage.setItem("clm.workspace.cooldown_alerts", String(cooldownAlerts));
        window.localStorage.setItem("clm.workspace.companion_alerts", String(companionAlerts));
        window.localStorage.setItem("clm.workspace.experimental_fix", String(experimentalFix));
        window.dispatchEvent(new Event("storage"));
      }
      window.setTimeout(() => setSaveState("idle"), 2000);
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "Failed to save preferences.");
    }
  };

  const handleLogoutClick = async () => {
    setIsSigningOut(true);
    try {
      await onLogout();
    } catch {
      setIsSigningOut(false);
      setSaveState("error");
      setSaveError("Failed to sign out.");
    }
  };
  const themeOptions = [
    {
      label: "Dark",
      description: "Low light",
      value: "dark",
    },
    {
      label: "Light",
      description: "Bright",
      value: "light",
    },
    {
      label: "System",
      description: "Auto",
      value: "system",
    },
  ];

  return (
    <form onSubmit={handleSave} className="max-w-5xl space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <Panel className="p-5" eyebrow="User Profile">
          <div className="mt-4 space-y-3">
            <Input id="displayNameInput" label="Display Name" onChange={(e) => setDisplayName(e.target.value)} value={displayName} />
            <Input disabled label="Email" value={session?.user.email ?? "Not signed in"} />
          </div>
        </Panel>

        <Panel className="p-5" eyebrow="Appearance">
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-2 flex items-end justify-between gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary">Color Theme</label>
                  <p className="mt-1 text-[10px] leading-4 text-text-muted">
                    Choose how the workspace should render on this device.
                  </p>
                </div>
              </div>
              <div
                aria-label="Color theme"
                className="grid grid-cols-3 gap-1 rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)] p-1"
                role="radiogroup"
              >
                {themeOptions.map((option) => {
                  const selected = theme === option.value;

                  return (
                    <button
                      key={option.value}
                      aria-checked={selected}
                        className={[
                          "min-h-12 rounded-lg px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                          selected
                            ? "bg-accent text-[color:var(--color-accent-text)] font-semibold"
                            : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                        ].join(" ")}
                      onClick={() => {
                        setTheme(option.value);
                        if (typeof window !== "undefined") {
                          window.localStorage.setItem("clm.workspace.theme", option.value);
                          applyThemePreference(option.value);
                          window.dispatchEvent(new Event("storage"));
                        }
                      }}
                      role="radio"
                      type="button"
                    >
                      <span className="block text-xs font-semibold leading-4">{option.label}</span>
                      <span className={["block text-[10px] leading-3", selected ? "opacity-90" : "text-text-muted"].join(" ")}>
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-semibold text-text-primary">Expanded Sidebar</label>
                <p className="text-[9px] text-text-muted">Keep sidebar open by default on boot.</p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-base)] text-accent focus:ring-accent"
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
                className="h-4 w-4 rounded border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-base)] text-accent focus:ring-accent"
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
                className="h-4 w-4 rounded border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-base)] text-accent focus:ring-accent"
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
                className="h-4 w-4 rounded border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-base)] text-accent focus:ring-accent"
                checked={experimentalFix}
                onChange={(e) => setExperimentalFix(e.target.checked)}
              />
            </div>
            <div className="text-[9px] text-text-muted bg-[color:var(--color-surface-panel-muted)] p-3 rounded-lg border border-[color:var(--color-border-subtle)] leading-relaxed">
              Environment build: <span className="font-mono text-text-secondary">v0.1.0-beta.2</span> <br />
              Node.js version: <span className="font-mono text-text-secondary">v20.11.0</span>
              <br />
              Companion:{" "}
              <span className="font-mono text-text-secondary">
                {dashboard?.companion.connected ? "online" : "offline"}
              </span>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          className="justify-center sm:w-auto"
          disabled={saveState === "saving" || isSigningOut}
          isLoading={isSigningOut}
          onClick={() => void handleLogoutClick()}
          type="button"
          variant="secondary"
        >
          {isSigningOut ? "Signing out..." : "Sign out"}
        </Button>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          {saveState === "error" && saveError ? (
            <StatusPill tone="error">{saveError}</StatusPill>
          ) : null}
        {saveState === "saved" && (
          <StatusPill tone="success">Preferences saved successfully</StatusPill>
        )}
        <Button
          className="justify-center sm:w-auto"
          disabled={saveState === "saving" || isSigningOut}
          isLoading={saveState === "saving"}
          type="submit"
          variant="primary"
        >
          {saveState === "saving" ? "Saving..." : "Save Preferences"}
        </Button>
        </div>
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
    <Panel className="p-5" eyebrow="Companion checks">
      <div className="space-y-3">
        <ErrorState
          action={
            <Button disabled={fixing} onClick={handleFix} size="sm" type="button" variant="secondary">
              {fixing ? "Checking..." : "View fix"}
            </Button>
          }
          className="items-start gap-3 p-4 text-left"
          message={fixResult ?? "Local development tools required for companion-based workflows are not fully installed on this machine."}
          title="Required local tools are missing"
        />

        <Panel className="bg-[color:var(--color-surface-panel-muted)] border-[color:var(--color-border-subtle)] p-3" contentClassName="space-y-0">
          <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-text-primary">Local connection</p>
            <p className="text-[10px] text-text-muted mt-1 leading-relaxed">Shown from the current companion connection.</p>
          </div>
          <StatusPill className={companionDependentStatusClassName} tone={connectionHasError || !companionConnected ? "error" : connectionIsLoading ? "info" : "success"}>
            {companionDependentStatus}
          </StatusPill>
          </div>
        </Panel>

        <Panel className="bg-[color:var(--color-surface-panel-muted)] border-[color:var(--color-border-subtle)] p-3" contentClassName="space-y-0">
          <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-text-primary">Companion connection</p>
            <p className="text-[10px] text-text-muted mt-1 leading-relaxed">Available when the desktop companion is connected.</p>
          </div>
          <StatusPill className={companionDependentStatusClassName} tone={connectionHasError || !companionConnected ? "error" : connectionIsLoading ? "info" : "success"}>
            {companionDependentStatus}
          </StatusPill>
          </div>
        </Panel>

        <Panel className="bg-[color:var(--color-surface-panel-muted)] border-[color:var(--color-border-subtle)] p-3" contentClassName="space-y-0">
          <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-text-primary">Background tasks</p>
            <p className="text-[10px] text-text-muted mt-1 leading-relaxed">Detailed background task health is not shown yet.</p>
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

function ProviderApiSetup({
  availableModels,
  providersStatus,
}: {
  availableModels: AvailableModelItem[];
  providersStatus: ProvidersResponse | null;
}) {
  const [routerKey, setRouterKey] = useState("sk-or-••••••••••••••••••••••••••••••••");
  const [geminiKey, setGeminiKey] = useState("AIzaSy••••••••••••••••••••••••••••");
  const providerEntries =
    providersStatus?.providers.length
      ? providersStatus.providers
      : collectProviderNames(providersStatus, availableModels).map((providerName) => ({
          id: providerName,
          name: providerName,
          baseType: "unknown",
          status: "unknown",
          keyConfigured: false,
          models: [],
        }));

  return (
      <Panel className="p-5" eyebrow="Provider setup">
      <div className="space-y-4">
        {providerEntries.length === 0 ? (
          <EmptyState
            className="px-4 py-5"
            description="Once the backend exposes eligible providers, configuration details will appear here."
            title="No providers detected"
          />
        ) : (
          providerEntries.map((provider) => (
            <Panel
              key={provider.id}
              className="bg-[color:var(--color-surface-panel-muted)] border-[color:var(--color-border-subtle)] p-3"
              contentClassName="space-y-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-text-primary">
                    {provider.name}
                  </p>
                  <p className="mt-1 text-[9.5px] leading-relaxed text-text-muted">
                    {provider.keyConfigured
                      ? "API credentials are loaded from the backend environment and are not exposed to the browser."
                      : "No backend credential detected for this provider yet."}
                  </p>
                  <p className="mt-1 text-[9px] text-text-muted">
                    Provider type:{" "}
                    <span className="font-mono text-text-secondary">
                      {provider.baseType}
                    </span>
                    {"  "}Status:{" "}
                    <span className="font-mono text-text-secondary">
                      {provider.status}
                    </span>
                  </p>
                </div>
                <StatusPill tone={provider.keyConfigured ? "success" : "error"}>
                  {provider.keyConfigured ? "Configured" : "Missing key"}
                </StatusPill>
              </div>
            </Panel>
          ))
        )}
      </div>
      </Panel>
  );
}

function ModelConsole({
  availableModels,
  providersStatus,
  cloudEligibleCount,
  connectionHasError,
  companionConnected,
}: {
  availableModels: AvailableModelItem[];
  providersStatus: ProvidersResponse | null;
  cloudEligibleCount: number;
  connectionHasError: boolean;
  companionConnected: boolean;
}) {
  const statusByModelId = new Map(
    (providersStatus?.providers ?? [])
      .flatMap((provider) => provider.models)
      .map((model) => [model.id, model] as const),
  );
  const companionStatusLabel = connectionHasError
    ? "Unavailable"
    : companionConnected
      ? "Online"
      : "Offline";
  const companionStatusClassName = connectionHasError || !companionConnected
    ? "text-state-blocked border-state-blocked/20 bg-state-blocked/10"
    : "text-state-healthy border-state-healthy/20 bg-state-healthy/10";

  return (
    <Panel className="p-5" eyebrow="Available chat models">
      <div className="space-y-2">
        {availableModels.length === 0 ? (
          <EmptyState
            className="px-4 py-5"
            description="The backend did not return any eligible chat models for this session."
            title="No eligible models"
          />
        ) : (
        availableModels.map((model) => (
          <Panel key={model.id} className="bg-[color:var(--color-surface-panel-muted)] border-[color:var(--color-border-subtle)] p-2.5" contentClassName="space-y-0">
            {(() => {
              const modelStatus = statusByModelId.get(model.id);
              const providerStatus =
                providersStatus?.providers.find(
                  (provider) => provider.id === model.providerId,
                ) ?? null;
              const modelCloudLabel = connectionHasError
                ? "Unavailable"
                : modelStatus?.eligible
                  ? "Eligible"
                  : modelStatus?.inCooldown
                    ? "Cooldown"
                    : "Unavailable";
              const modelCloudTone =
                connectionHasError || !modelStatus?.eligible ? "error" : "success";
              const modelCloudClassName =
                connectionHasError || !modelStatus?.eligible
                  ? "text-state-blocked border-state-blocked/20 bg-state-blocked/10"
                  : "text-state-healthy border-state-healthy/20 bg-state-healthy/10";

              return (
            <div className="flex items-center justify-between text-xs">
              <div>
                <p className="font-semibold text-text-primary">{model.name}</p>
                <p className="mt-0.5 text-[9px] text-text-muted">
                  {model.providerName} - {describeModelCapabilities(model)}
                </p>
                <p className="mt-1 text-[9px] text-text-muted">
                  Provider:{" "}
                  <span className="font-mono text-text-secondary">
                    {providerStatus?.status ?? "unknown"}
                  </span>
                  {"  "}Key:{" "}
                  <span className="font-mono text-text-secondary">
                    {providerStatus?.keyConfigured ? "configured" : "missing"}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                <div className="flex items-center gap-1">
                  <StatusPill className={modelCloudClassName} tone={modelCloudTone}>
                    Cloud: {modelCloudLabel}
                  </StatusPill>
                  <StatusPill className={companionStatusClassName} tone={connectionHasError || !companionConnected ? "error" : "success"}>
                    Companion: {companionStatusLabel}
                  </StatusPill>
                </div>
                <p className="mt-0.5 text-[9px] text-text-muted">
                  Route class: <span className="font-mono text-text-secondary">{describeRouteClass(model)}</span>
                </p>
              </div>
            </div>
              );
            })()}
          </Panel>
        ))
        )}
      </div>
    </Panel>
  );
}

function ModelUsageOverview({
  analytics,
  models,
}: {
  analytics: ModelAnalyticsResponse;
  models: ModelRegistryItem[];
}) {
  const summaryByModelId = new Map(
    analytics.summary.map((item) => [item.modelId, item] as const),
  );
  const totals = analytics.summary.reduce(
    (acc, item) => ({
      requestCount: acc.requestCount + item.requestCount,
      totalTokens: acc.totalTokens + item.totalTokens,
      errorCount: acc.errorCount + item.errorCount,
      costUsdMicros: acc.costUsdMicros + item.costUsdMicros,
    }),
    { requestCount: 0, totalTokens: 0, errorCount: 0, costUsdMicros: 0 },
  );

  return (
    <>
      <Panel className="p-5" eyebrow="Usage Overview">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricTile label="Registered models" value={String(models.length)} />
          <MetricTile label="Requests" value={String(totals.requestCount)} />
          <MetricTile label="Tokens" value={String(totals.totalTokens)} />
          <MetricTile
            label="Cost"
            value={`$${(totals.costUsdMicros / 1_000_000).toFixed(4)}`}
          />
        </div>
      </Panel>
      <Panel className="p-5" eyebrow="Usage Chart">
        {analytics.series.length === 0 ? (
          <EmptyState
            className="px-4 py-5"
            description="Usage points will appear after requests are routed through the registry."
            title="No analytics yet"
          />
        ) : (
          <div className="space-y-3">
            {analytics.series.slice(-8).map((item) => {
              const width = Math.min(100, Math.max(8, item.requestCount * 16));
              return (
                <div key={`${item.modelId}-${item.bucketStart}`} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-text-secondary">
                    <span>{lookupModelName(models, item.modelId)}</span>
                    <span>{new Date(item.bucketStart).toLocaleDateString()}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[color:var(--color-surface-panel-muted)]">
                    <div
                      className="h-2 rounded-full bg-accent"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
      <Panel className="p-5" eyebrow="Per-model performance">
        <div className="space-y-2">
          {models.map((model) => {
            const summary = summaryByModelId.get(model.id);
            return (
              <div
                key={model.id}
                  className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-text-primary">
                    {model.displayName}
                  </p>
                  <p className="mt-0.5 text-[10px] text-text-muted">
                    {model.providerName}
                  </p>
                </div>
                <div className="shrink-0 text-left text-[10px] text-text-secondary sm:text-right">
                  <p>{summary?.requestCount ?? 0} requests</p>
                  <p>{summary?.errorCount ?? 0} errors</p>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}

function FreeModelMarketplacePanel({
  marketplace,
  onDisableModel,
  onEnableModel,
  onSync,
}: {
  marketplace: FreeMarketplaceResponse;
  onDisableModel: (modelId: string) => Promise<void>;
  onEnableModel: (modelId: string) => Promise<void>;
  onSync: () => Promise<void>;
}) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const models = marketplace.models.slice(0, 12);

  return (
    <Panel className="p-5" eyebrow="Free Model Marketplace">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            Best-effort free models
          </h3>
          <p className="mt-1 max-w-xl text-xs leading-5 text-text-muted">
            Synced from provider catalogs. Availability, speed, and limits can change
            without notice.
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-text-muted">
            Last sync {marketplace.lastSyncedAt ? formatDateTime(marketplace.lastSyncedAt) : "never"}
          </p>
        </div>
        <Button
          disabled={pendingAction === "sync"}
          onClick={() => {
            setPendingAction("sync");
            void onSync().finally(() => setPendingAction(null));
          }}
          size="sm"
          type="button"
          variant="secondary"
        >
          {pendingAction === "sync" ? "Syncing..." : "Sync free models"}
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {models.length === 0 ? (
          <EmptyState
            className="px-4 py-5"
            description="Sync OpenRouter's catalog to discover current free models."
            title="No free models synced"
          />
        ) : (
          models.map((model) => {
            const isEnabled = model.adminStatus === "active";
            const isPending = pendingAction === model.id;
            return (
              <div
                key={model.id}
                className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)] px-3 py-3 transition hover:border-[color:var(--color-border-strong)] hover:bg-[color:var(--color-bg-hover)]"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {model.displayName}
                      </p>
                      <StatusPill tone="success">Free</StatusPill>
                      <StatusPill tone={isEnabled ? "success" : "neutral"}>
                        {isEnabled ? "Enabled" : "Available"}
                      </StatusPill>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-text-muted">
                      {model.owner ? `${model.owner} via ` : ""}
                      {model.providerName} - {model.providerModelId}
                    </p>
                    <p className="mt-1 text-[10px] text-text-secondary">
                      Context {formatCompactNumber(model.contextWindow ?? 0)} -{" "}
                      {model.supportsVision ? "Vision + text" : "Text"} - Best effort
                    </p>
                  </div>
                  <Button
                    disabled={isPending || !model.secretConfigured}
                    onClick={() => {
                      setPendingAction(model.id);
                      const action = isEnabled
                        ? onDisableModel(model.id)
                        : onEnableModel(model.id);
                      void action.finally(() => setPendingAction(null));
                    }}
                    size="sm"
                    type="button"
                    variant={isEnabled ? "ghost" : "primary"}
                  >
                    {!model.secretConfigured
                      ? "Key required"
                      : isPending
                        ? "Saving..."
                        : isEnabled
                          ? "Disable"
                          : "Enable"}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}

function ModelsRegistryPanel({
  analytics,
  errorMessage,
  models,
  onCreateModel,
  onDeleteModel,
  onUpdateModel,
  providersStatus,
}: {
  analytics: ModelAnalyticsResponse;
  errorMessage: string | null;
  models: ModelRegistryItem[];
  onCreateModel: WorkspaceSectionRenderArgs["onCreateModel"];
  onDeleteModel: WorkspaceSectionRenderArgs["onDeleteModel"];
  onUpdateModel: WorkspaceSectionRenderArgs["onUpdateModel"];
  providersStatus: ProvidersResponse | null;
}) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const providers = providersStatus?.providers ?? [];
  const editingModel = models.find((item) => item.id === editingId) ?? null;

  return (
    <>
      <Panel className="p-5" eyebrow="Registry Controls">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsAddOpen(true)}
            size="sm"
            type="button"
            variant="primary"
          >
            Add model
          </Button>
        </div>
        {errorMessage ? (
          <div className="ui-alert-error mt-4 px-3.5 py-2.5 text-xs">
            {errorMessage}
          </div>
        ) : null}
      </Panel>

      <Panel className="p-5" eyebrow="Model Registry">
        <div className="space-y-3">
          {models.length === 0 ? (
            <EmptyState
              className="px-4 py-5"
              description="Add at least one active model to make it selectable in chat."
              title="No models configured"
            />
          ) : (
            models.map((model) => (
              <div
                key={model.id}
                className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)] px-3 py-3 transition hover:border-[color:var(--color-border-strong)] hover:bg-[color:var(--color-bg-hover)]"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {model.displayName}
                      </p>
                      <StatusPill
                        tone={model.effectiveStatus === "active" ? "success" : "error"}
                      >
                        {model.effectiveStatus}
                      </StatusPill>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-text-muted">
                      {model.providerName} - <span className="font-mono">{model.providerModelId}</span>
                    </p>
                    <p className="mt-1 text-[10px] text-text-secondary font-mono">
                      PRIORITY: {model.priorityRank} | RPM: {model.requestsPerMinuteLimit ?? "UNLIMITED"} | TOKENS: {model.tokensPerDayLimit ?? "UNLIMITED"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button
                      onClick={() => setEditingId(model.id)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() =>
                        void onUpdateModel(model.id, {
                          adminStatus: model.adminStatus === "active" ? "disabled" : "active",
                        })
                      }
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {model.adminStatus === "active" ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      onClick={() => void onDeleteModel(model.id)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      {isAddOpen ? (
        <ModelEditorDialog
          analytics={analytics}
          isSaving={isSaving}
          providers={providers}
          title="Add Model"
          onClose={() => {
            if (!isSaving) setIsAddOpen(false);
          }}
          onSubmit={async (value) => {
            setIsSaving(true);
            try {
              await onCreateModel(value);
              setIsAddOpen(false);
            } finally {
              setIsSaving(false);
            }
          }}
        />
      ) : null}

      {editingModel ? (
        <ModelEditorDialog
          analytics={analytics}
          initialModel={editingModel}
          isSaving={isSaving}
          providers={providers}
          title="Edit Model"
          onClose={() => {
            if (!isSaving) setEditingId(null);
          }}
          onSubmit={async (value) => {
            setIsSaving(true);
            try {
              await onUpdateModel(editingModel.id, value);
              setEditingId(null);
            } finally {
              setIsSaving(false);
            }
          }}
        />
      ) : null}
    </>
  );
}

function ModelEditorDialog({
  initialModel,
  isSaving,
  providers,
  title,
  onClose,
  onSubmit,
}: {
  analytics: ModelAnalyticsResponse;
  initialModel?: ModelRegistryItem;
  isSaving: boolean;
  providers: NonNullable<ProvidersResponse["providers"]>;
  title: string;
  onClose: () => void;
  onSubmit: (value: {
    providerId: string;
    providerModelId: string;
    displayName: string;
    secretRef?: string | null;
    priorityRank: number;
    supportsChat: boolean;
    supportsAgent: boolean;
    supportsVision?: boolean;
    adminStatus: "active" | "disabled";
    requestsPerMinuteLimit?: number | null;
    tokensPerDayLimit?: number | null;
    costInputPer1mUsdMicros?: number | null;
    costOutputPer1mUsdMicros?: number | null;
  }) => Promise<void>;
}) {
  const [providerId, setProviderId] = useState(
    initialModel?.providerId ?? providers[0]?.id ?? "",
  );
  const [providerModelId, setProviderModelId] = useState(
    initialModel?.providerModelId ?? "",
  );
  const [displayName, setDisplayName] = useState(initialModel?.displayName ?? "");
  const [secretRef, setSecretRef] = useState(initialModel?.secretRef ?? "");
  const [priorityRank, setPriorityRank] = useState(
    String(initialModel?.priorityRank ?? 1),
  );
  const [rpmLimit, setRpmLimit] = useState(
    initialModel?.requestsPerMinuteLimit?.toString() ?? "",
  );
  const [dailyLimit, setDailyLimit] = useState(
    initialModel?.tokensPerDayLimit?.toString() ?? "",
  );
  const [isChatEnabled, setIsChatEnabled] = useState(initialModel?.supportsChat ?? true);
  const [isAgentEnabled, setIsAgentEnabled] = useState(initialModel?.supportsAgent ?? true);
  const [isVisionEnabled, setIsVisionEnabled] = useState(
    initialModel?.supportsVision ?? false,
  );
  const fieldLabelClassName = "text-[12px] font-medium text-text-secondary";
  const inputClassName =
    "ui-input h-11 w-full px-3 py-2 text-sm";
  const selectClassName = `${inputClassName} w-full appearance-none`;
  const checkboxClassName =
    "h-4 w-4 rounded border-[color:var(--color-border-subtle)] text-accent focus:ring-accent accent-accent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#26251e]/18 px-4 py-6 backdrop-blur-sm">
      <div
        aria-modal="true"
        className="max-h-[calc(100dvh-48px)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[color:var(--color-border-strong)] bg-surface p-6"
        role="dialog"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">
              Model Registry
            </p>
            <h3 className="mt-1 font-headline text-3xl font-medium leading-tight tracking-[-0.03em] text-text-primary">
              {title}
            </h3>
          </div>
          <Button
            className="self-start text-text-secondary hover:bg-bg-hover hover:text-text-primary sm:self-auto"
            onClick={onClose}
            size="sm"
            type="button"
            variant="ghost"
          >
            Close
          </Button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className={fieldLabelClassName}>Provider</span>
            <select
              className={selectClassName}
              onChange={(event) => setProviderId(event.target.value)}
              value={providerId}
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className={fieldLabelClassName}>Provider model ID</span>
            <Input
              className={inputClassName}
              onChange={(event) => setProviderModelId(event.target.value)}
              placeholder="google/gemini-2.0-flash"
              value={providerModelId}
            />
          </label>
          <label className="space-y-1.5">
            <span className={fieldLabelClassName}>Display name</span>
            <Input
              className={inputClassName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Gemini 2.0 Flash"
              value={displayName}
            />
          </label>
          <label className="space-y-1.5">
            <span className={fieldLabelClassName}>Secret ref</span>
            <Input
              className={inputClassName}
              onChange={(event) => setSecretRef(event.target.value)}
              placeholder="GEMINI_API_KEY"
              value={secretRef}
            />
          </label>
          <label className="space-y-1.5">
            <span className={fieldLabelClassName}>Priority rank</span>
            <Input
              className={inputClassName}
              inputMode="numeric"
              onChange={(event) => setPriorityRank(event.target.value)}
              value={priorityRank}
            />
          </label>
          <label className="space-y-1.5">
            <span className={fieldLabelClassName}>Requests / minute</span>
            <Input
              className={inputClassName}
              inputMode="numeric"
              onChange={(event) => setRpmLimit(event.target.value)}
              placeholder="Optional"
              value={rpmLimit}
            />
          </label>
          <label className="space-y-1.5">
            <span className={fieldLabelClassName}>Tokens / day</span>
            <Input
              className={inputClassName}
              inputMode="numeric"
              onChange={(event) => setDailyLimit(event.target.value)}
              placeholder="Optional"
              value={dailyLimit}
            />
          </label>
          <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)] p-3">
            <span className={fieldLabelClassName}>Capabilities</span>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
            <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <input
                checked={isChatEnabled}
                className={checkboxClassName}
                onChange={(event) => setIsChatEnabled(event.target.checked)}
                type="checkbox"
              />
              Chat
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <input
                checked={isAgentEnabled}
                className={checkboxClassName}
                onChange={(event) => setIsAgentEnabled(event.target.checked)}
                type="checkbox"
              />
              Agent
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <input
                checked={isVisionEnabled}
                className={checkboxClassName}
                onChange={(event) => setIsVisionEnabled(event.target.checked)}
                type="checkbox"
              />
              Vision
            </label>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-[color:var(--color-border-subtle)] pt-4 sm:flex-row sm:justify-end">
          <Button
            className="justify-center text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            onClick={onClose}
            size="sm"
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            className="justify-center px-5"
            disabled={isSaving}
            onClick={() =>
              void onSubmit({
                providerId,
                providerModelId,
                displayName,
                secretRef: secretRef.trim() || null,
                priorityRank: Number(priorityRank) || 1,
                supportsChat: isChatEnabled,
                supportsAgent: isAgentEnabled,
                supportsVision: isVisionEnabled,
                adminStatus: initialModel?.adminStatus ?? "active",
                requestsPerMinuteLimit: rpmLimit.trim() ? Number(rpmLimit) : null,
                tokensPerDayLimit: dailyLimit.trim() ? Number(dailyLimit) : null,
                costInputPer1mUsdMicros: initialModel?.costInputPer1mUsdMicros ?? null,
                costOutputPer1mUsdMicros: initialModel?.costOutputPer1mUsdMicros ?? null,
              })
            }
            size="sm"
            type="button"
            variant="primary"
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)] px-3 py-3">
      <p className="text-[10px] uppercase tracking-wider text-text-secondary">{label}</p>
      <p className="mt-1 font-headline text-lg font-medium tracking-[-0.02em] text-text-primary">{value}</p>
    </div>
  );
}

function lookupModelName(models: ModelRegistryItem[], modelId: string) {
  return models.find((item) => item.id === modelId)?.displayName ?? modelId;
}

function describeModelCapabilities(model: AvailableModelItem) {
  if (model.supportsChat && model.supportsAgent) {
    return "Chat + Agent";
  }

  if (model.supportsAgent) {
    return "Agent";
  }

  return "Chat";
}

function describeRouteClass(model: AvailableModelItem) {
  return model.supportsAgent ? "chat/agent" : "chat";
}
