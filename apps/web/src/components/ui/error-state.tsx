import type { ReactNode } from "react";

interface ErrorStateProps {
  title: string;
  message: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  action,
  className,
  message,
  title,
}: ErrorStateProps) {
  return (
    <div className={["ui-alert-error flex w-full flex-col items-center justify-center gap-4 p-6 text-center", className ?? ""].join(" ")}>
      <svg className="h-10 w-10 text-state-blocked" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-text-secondary">{message}</p>
      </div>
      {action}
    </div>
  );
}
