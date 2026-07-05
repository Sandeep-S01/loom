import type { DashboardRunItem } from "../lib/types";
import { DashboardCard } from "./dashboard-card";
import { EmptyState } from "./ui/empty-state";
import { Panel } from "./ui/panel";
import { StatusPill } from "./ui/status-pill";

interface RecentAgentRunsPanelProps {
  runs: DashboardRunItem[];
}

function statusTone(status: DashboardRunItem["status"]) {
  switch (status) {
    case "completed":
      return "success" as const;
    case "failed_internal":
    case "blocked_capacity":
    case "stopped_by_user":
      return "error" as const;
    case "executing":
      return "info" as const;
    default:
      return "warning" as const;
  }
}

function formatStatus(status: DashboardRunItem["status"]) {
  return status.replaceAll("_", " ");
}

export function RecentAgentRunsPanel({ runs }: RecentAgentRunsPanelProps) {
  return (
    <DashboardCard eyebrow="Automation" title="Recent agent runs">
      {runs.length === 0 ? (
        <EmptyState
          description="Agent activity will appear here after the first run."
          title="No agent runs yet"
        />
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <Panel
              key={run.id}
              className="p-4"
              contentClassName="space-y-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {run.objective}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    Workspace {run.workspaceId}
                  </p>
                </div>
                <StatusPill tone={statusTone(run.status)}>
                  {formatStatus(run.status)}
                </StatusPill>
              </div>
              <p className="mt-3 text-sm text-text-secondary">
                Updated {new Date(run.updatedAt).toLocaleString()}
              </p>
            </Panel>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
