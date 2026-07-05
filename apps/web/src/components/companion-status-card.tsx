import type { DashboardCompanionStatus } from "../lib/types";
import { DashboardCard } from "./dashboard-card";
import { Panel } from "./ui/panel";
import { StatusPill } from "./ui/status-pill";

interface CompanionStatusCardProps {
  companion: DashboardCompanionStatus;
}

export function CompanionStatusCard({ companion }: CompanionStatusCardProps) {
  return (
    <DashboardCard eyebrow="Companion" title="Connection status">
      <div className="flex items-center gap-3">
        <StatusPill tone={companion.connected ? "success" : "error"}>
          {companion.connected ? "Connected" : "Disconnected"}
        </StatusPill>
      </div>

      <Panel className="mt-4 p-4" contentClassName="space-y-0">
        <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
          Machine label
        </p>
        <p className="mt-2 text-sm text-text-primary">
          {companion.machineLabel ?? "No paired companion machine detected."}
        </p>
        {!companion.connected ? (
          <p className="mt-3 text-sm text-text-secondary">
            Pair or reconnect the local companion before using companion-backed
            workspace actions.
          </p>
        ) : null}
      </Panel>
    </DashboardCard>
  );
}
