"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getCompanionStatus,
  getDashboard,
  listWorkspaces,
  startPairing,
} from "../lib/api";
import type {
  CompanionStatusResponse,
  DashboardResponse,
  WorkspaceListItem,
} from "../lib/types";
import { ActiveWorkspaceCard } from "./active-workspace-card";
import { CompanionPairingPanel } from "./companion-pairing-panel";
import { CompanionStatusCard } from "./companion-status-card";
import { ProviderSummaryCard } from "./provider-summary-card";
import { RecentAgentRunsPanel } from "./recent-agent-runs-panel";
import { RecentConversationsPanel } from "./recent-conversations-panel";
import { ErrorState } from "./ui/error-state";
import { Panel } from "./ui/panel";
import { WorkspacesPanel } from "./workspaces-panel";

export function DashboardShell() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [companionStatus, setCompanionStatus] =
    useState<CompanionStatusResponse | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingExpiresAt, setPairingExpiresAt] = useState<string | null>(null);
  const [isStartingPairing, setIsStartingPairing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      getDashboard(),
      getCompanionStatus(),
      listWorkspaces(),
    ])
      .then(([dashboardResponse, companionResponse, workspacesResponse]) => {
        if (cancelled) {
          return;
        }

        setDashboard(dashboardResponse);
        setCompanionStatus(companionResponse);
        setWorkspaces(workspacesResponse.workspaces);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load dashboard.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleStartPairing() {
    setIsStartingPairing(true);
    setPairingError(null);

    void startPairing()
      .then((response) => {
        setPairingCode(response.pairingCode);
        setPairingExpiresAt(response.expiresAt);
      })
      .catch((loadError) => {
        setPairingError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to start pairing.",
        );
      })
      .finally(() => {
        setIsStartingPairing(false);
      });
  }

  return (
    <section className="min-h-screen px-6 py-10 md:px-8 md:py-12" style={{ background: "radial-gradient(circle at top left, rgba(99,102,241,0.18), transparent 30%), linear-gradient(180deg, rgba(15,17,23,1) 0%, rgba(9,10,15,1) 100%)" }}>
      <div className="mx-auto w-full max-w-6xl">
        <header className="ui-card-shell p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-text-muted">
                Loom Workspace
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-text-primary md:text-4xl">
                Dashboard overview
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
                Review companion connectivity, the active workspace, current model
                availability, and recent activity before opening chat.
              </p>
            </div>

            <Link
              className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
              href="/chat"
            >
              Open Chat
            </Link>
          </div>
        </header>

        {error ? (
          <div className="mt-6">
            <ErrorState message={error} title="Dashboard failed to load" />
          </div>
        ) : null}

        {!dashboard && !error ? (
          <Panel className="mt-6 p-5" eyebrow="Loading" title="Dashboard">
            <div className="space-y-3">
              <div className="h-3 w-1/3 rounded bg-white/10" />
              <div className="h-3 w-2/3 rounded bg-white/5" />
              <div className="h-3 w-1/2 rounded bg-white/5" />
            </div>
          </Panel>
        ) : null}

        {dashboard ? (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <CompanionStatusCard companion={dashboard.companion} />
              <ActiveWorkspaceCard workspace={dashboard.activeWorkspace} />
              <ProviderSummaryCard providerSummary={dashboard.providerSummary} />
            </div>

            <div className="mt-6 hidden gap-4 lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <CompanionPairingPanel
                companion={companionStatus}
                isStartingPairing={isStartingPairing}
                onStartPairing={handleStartPairing}
                pairingCode={pairingCode}
                pairingError={pairingError}
                pairingExpiresAt={pairingExpiresAt}
              />
              <WorkspacesPanel workspaces={workspaces} />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <RecentConversationsPanel
                conversations={dashboard.recentConversations}
              />
              <RecentAgentRunsPanel runs={dashboard.recentAgentRuns} />
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
