import type { DashboardProviderSummary } from "../lib/types";
import { DashboardCard } from "./dashboard-card";
import { Panel } from "./ui/panel";

interface ProviderSummaryCardProps {
  providerSummary: DashboardProviderSummary;
}

export function ProviderSummaryCard({
  providerSummary,
}: ProviderSummaryCardProps) {
  const hasEligibleModels = providerSummary.eligibleCount > 0;

  return (
    <DashboardCard eyebrow="Providers" title="Model availability">
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel className="p-4" contentClassName="space-y-0">
          <p className="ui-section-label">
            Eligible now
          </p>
          <div className="mt-3 flex items-baseline gap-2">
            <p
              className={[
                "text-3xl font-extrabold tracking-tight",
                hasEligibleModels ? "text-text-primary" : "text-state-blocked",
              ].join(" ")}
            >
              {providerSummary.eligibleCount}
            </p>
            <span className="text-xs text-text-muted">models</span>
          </div>
          <p className="mt-3 text-xs text-text-secondary leading-relaxed">
            {hasEligibleModels
              ? "Cloud routing currently has eligible models for incoming prompts."
              : "No cloud provider endpoints are currently eligible for routing."}
          </p>
        </Panel>

        <Panel className="p-4" contentClassName="space-y-0">
          <p className="ui-section-label">
            Cooling down
          </p>
          <div className="mt-3 flex items-baseline gap-2">
            <p className="text-3xl font-extrabold tracking-tight text-text-primary">
              {providerSummary.cooldownCount}
            </p>
            <span className="text-xs text-text-muted">models</span>
          </div>
          <p className="mt-3 text-xs text-text-secondary leading-relaxed">
            {providerSummary.lastExhaustedAt
              ? `Last rate-limit limit reached at ${new Date(
                  providerSummary.lastExhaustedAt,
                ).toLocaleTimeString()}.`
              : "No active rate limits or cooling down periods."}
          </p>
        </Panel>
      </div>
    </DashboardCard>
  );
}
