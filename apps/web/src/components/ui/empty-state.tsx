import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  action,
  className,
  description,
  title,
}: EmptyStateProps) {
  return (
    <div className={["ui-empty-panel flex flex-col items-center justify-center px-4 py-6 text-center", className ?? ""].join(" ")}>
      <svg className="mb-2.5 h-8 w-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
      </svg>
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <p className="mt-2 text-sm text-text-secondary">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
