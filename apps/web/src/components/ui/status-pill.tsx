import type { ReactNode } from "react";

type StatusTone = "success" | "error" | "warning" | "info" | "neutral";

interface StatusPillProps {
  children: ReactNode;
  tone: StatusTone;
  className?: string;
}

const TONE_CLASSNAMES: Record<StatusTone, string> = {
  success: "text-state-healthy border-state-healthy/30 bg-state-healthy/10",
  error: "text-state-blocked border-state-blocked/30 bg-state-blocked/10",
  warning: "text-state-degraded border-state-degraded/30 bg-state-degraded/10",
  info: "text-state-info border-state-info/30 bg-state-info/10",
  neutral: "text-text-muted border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)]",
};

const DOT_CLASSNAMES: Record<StatusTone, string> = {
  success: "bg-state-healthy",
  error: "bg-state-blocked",
  warning: "bg-state-degraded",
  info: "bg-state-info",
  neutral: "bg-text-muted",
};

export function StatusPill({ children, className, tone }: StatusPillProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
        TONE_CLASSNAMES[tone],
        className ?? "",
      ].join(" ")}
    >
      <span className={["h-1.5 w-1.5 rounded-full", DOT_CLASSNAMES[tone]].join(" ")} />
      <span>{children}</span>
    </span>
  );
}
