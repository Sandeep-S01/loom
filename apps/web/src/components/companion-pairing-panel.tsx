"use client";

import { useState } from "react";
import type { CompanionStatusResponse } from "../lib/types";
import { DashboardCard } from "./dashboard-card";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/empty-state";
import { ErrorState } from "./ui/error-state";
import { Panel } from "./ui/panel";
import { StatusPill } from "./ui/status-pill";

interface CompanionPairingPanelProps {
  companion: CompanionStatusResponse | null;
  pairingCode: string | null;
  pairingExpiresAt: string | null;
  pairingError: string | null;
  isStartingPairing: boolean;
  onStartPairing: () => void;
}

export function CompanionPairingPanel({
  companion,
  pairingCode,
  pairingExpiresAt,
  pairingError,
  isStartingPairing,
  onStartPairing,
}: CompanionPairingPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (pairingCode) {
      void navigator.clipboard.writeText(pairingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <DashboardCard eyebrow="Companion" title="Desktop app">
      <div className="space-y-4">
        <Panel className="p-4" contentClassName="space-y-0">
          <p className="ui-section-label">Status</p>
          <div className="mt-2.5 flex items-center gap-2">
            <p className="text-sm font-semibold text-text-primary">
              {companion?.machineLabel ?? "No companion paired yet."}
            </p>
            <StatusPill tone={companion?.deviceId ? "success" : "warning"}>
              {companion?.deviceId ? "Paired" : "Awaiting setup"}
            </StatusPill>
          </div>
          <p className="mt-2 text-xs text-text-secondary">
            {companion?.deviceId
              ? "This browser is linked to the desktop companion."
              : "Generate a code and enter it in the desktop app."}
          </p>
        </Panel>

        {pairingCode ? (
          <Panel className="border-accent/20 bg-[color:var(--color-surface-panel)] p-4" contentClassName="space-y-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-label text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                  Code
                </p>
                <p className="mt-2 font-mono text-2xl font-semibold tracking-[0.18em] text-text-primary">
                  {pairingCode}
                </p>
                <p className="mt-2 text-[10px] text-text-muted">
                  Expires: {pairingExpiresAt ? new Date(pairingExpiresAt).toLocaleTimeString() : "soon"}
                </p>
              </div>
              
              <Button onClick={handleCopy} type="button" variant="secondary">
                {copied ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-3.5 w-3.5 text-state-healthy">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-3.5 w-3.5">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy code
                  </>
                )}
              </Button>
            </div>
          </Panel>
        ) : (
          <EmptyState
            action={
              <Button
                className="min-w-[190px]"
                isLoading={isStartingPairing}
                onClick={onStartPairing}
                type="button"
                variant="primary"
              >
                {isStartingPairing ? "Generating Code..." : "Generate Pairing Code"}
              </Button>
            }
            className="min-h-[180px]"
            description="Generate a code, then enter it in the desktop app."
            title="No pairing code active"
          />
        )}

        {pairingError ? (
          <ErrorState
            action={
              <Button onClick={onStartPairing} size="sm" type="button" variant="secondary">
                Retry pairing
              </Button>
            }
            message={pairingError}
            title="Pairing request failed"
          />
        ) : null}
      </div>
    </DashboardCard>
  );
}
