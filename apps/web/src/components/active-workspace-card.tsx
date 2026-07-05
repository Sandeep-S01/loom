import type { DashboardWorkspaceItem } from "../lib/types";
import { DashboardCard } from "./dashboard-card";
import { EmptyState } from "./ui/empty-state";
import { Panel } from "./ui/panel";
import { StatusPill } from "./ui/status-pill";

interface ActiveWorkspaceCardProps {
  workspace: DashboardWorkspaceItem | null;
}

function statusTone(status: NonNullable<DashboardWorkspaceItem>["status"]) {
  switch (status) {
    case "active":
      return "success" as const;
    case "missing":
      return "error" as const;
    default:
      return "warning" as const;
  }
}

export function ActiveWorkspaceCard({ workspace }: ActiveWorkspaceCardProps) {
  return (
    <DashboardCard eyebrow="Workspace" title="Active workspace">
      {!workspace ? (
        <EmptyState
          description="Connect a companion and choose a workspace from chat to begin."
          title="No workspace selected"
        />
      ) : (
        <div className="space-y-4">
          <Panel className="p-4" contentClassName="space-y-0">
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
              Alias
            </p>
            <p className="mt-2 text-sm font-medium text-text-primary">
              {workspace.alias}
            </p>
            <p className="mt-3 text-sm text-text-secondary">
              {workspace.displayPathHint ?? "Path hint unavailable."}
            </p>
          </Panel>

          <Panel className="p-4" contentClassName="space-y-0">
            <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                Status
              </p>
              <div className="mt-2">
                <StatusPill tone={statusTone(workspace.status)}>
                {workspace.status}
                </StatusPill>
              </div>
            </div>
            <p className="text-xs text-text-secondary">
              {workspace.lastUsedAt
                ? `Last used ${new Date(workspace.lastUsedAt).toLocaleString()}`
                : "No recent activity"}
            </p>
            </div>
          </Panel>
        </div>
      )}
    </DashboardCard>
  );
}
