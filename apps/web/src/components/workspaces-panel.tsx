"use client";

import { useState } from "react";
import type { WorkspaceListItem } from "../lib/types";
import { DashboardCard } from "./dashboard-card";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/empty-state";
import { Panel } from "./ui/panel";
import { StatusPill } from "./ui/status-pill";

interface WorkspacesPanelProps {
  workspaces: WorkspaceListItem[];
}

function statusTone(status: WorkspaceListItem["status"]) {
  switch (status) {
    case "active":
      return "success" as const;
    case "missing":
      return "error" as const;
    default:
      return "warning" as const;
  }
}

export function WorkspacesPanel({ workspaces }: WorkspacesPanelProps) {
  const [syncingMap, setSyncingMap] = useState<Record<string, boolean>>({});

  const handleSync = (id: string) => {
    setSyncingMap((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setSyncingMap((prev) => ({ ...prev, [id]: false }));
    }, 1500);
  };

  return (
    <DashboardCard eyebrow="Workspaces" title="Registered folders">
      {workspaces.length === 0 ? (
        <EmptyState
          description="No registered workspaces yet. Pair the desktop companion, then choose a folder."
          title="No workspaces yet"
        />
      ) : (
        <div className="space-y-3">
          {workspaces.map((workspace) => {
            const isSyncing = syncingMap[workspace.id] ?? false;

            return (
              <Panel
                key={workspace.id}
                className="p-4"
                contentClassName="space-y-0"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-text-primary truncate">
                        {workspace.alias}
                      </p>
                      <StatusPill tone={statusTone(workspace.status)}>
                        {workspace.status}
                      </StatusPill>
                    </div>
                    <p className="mt-2 font-mono text-xs text-text-secondary truncate bg-black/20 p-2 rounded-lg border border-white/5">
                      {workspace.displayPathHint ?? "Path hint unavailable"}
                    </p>
                    <p className="mt-2 text-[10px] text-text-muted">
                      Machine: <span className="font-mono text-text-secondary">{workspace.machineId}</span>
                    </p>
                  </div>
                  
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
                    <Button
                      className={isSyncing ? "cursor-wait" : ""}
                      isLoading={isSyncing}
                      onClick={() => handleSync(workspace.id)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      {isSyncing ? "Syncing..." : "Sync indexing"}
                    </Button>
                    
                    <Button
                      className="text-state-blocked hover:text-white"
                      onClick={() => alert("Unlinking folders requires using the desktop companion client.")}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-3.5 w-3.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                      </svg>
                      Unlink
                    </Button>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
