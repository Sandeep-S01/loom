import type { ReactNode } from "react";

interface StatItem {
  label: string;
  value: string | number;
  highlight?: boolean;
}

interface LiveDataPanelProps {
  badge: string;
  stats?: StatItem[];
  children?: ReactNode;
  className?: string;
}

export function LiveDataPanel({
  badge,
  stats,
  children,
  className,
}: LiveDataPanelProps) {
  return (
    <div className={["tech-card overflow-hidden p-0", className ?? ""].join(" ").trim()}>
      <div className="flex items-center border-b border-[color:var(--color-border-subtle)]/60 bg-[color:var(--color-bg-hover)] px-4 py-2.5">
        <div className="flex items-center gap-4">
          <span className="font-mono text-[9px] uppercase tracking-widest text-text-secondary">{badge}</span>
          <div className="h-px w-6 bg-[color:var(--color-border-subtle)]" />
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {stats && stats.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel)] p-3">
                <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-text-secondary">{stat.label}</div>
                <div className={["font-mono text-xs font-semibold", stat.highlight ? "text-[color:var(--color-accent)]" : "text-text-primary"].join(" ")}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        
        {children}
      </div>
    </div>
  );
}
