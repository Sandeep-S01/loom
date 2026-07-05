import type { ReactNode } from "react";

interface PanelProps {
  eyebrow?: string;
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function Panel({
  action,
  children,
  className,
  contentClassName,
  eyebrow,
  title,
}: PanelProps) {
  return (
    <section className={["ui-card ui-card-hover p-5", className ?? ""].join(" ")}>
      {eyebrow || title || action ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            {eyebrow ? <p className="ui-section-label">{eyebrow}</p> : null}
            {title ? <h3 className="mt-2 text-sm font-semibold text-text-primary">{title}</h3> : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={[eyebrow || title || action ? "mt-5" : "", contentClassName ?? ""].join(" ").trim()}>
        {children}
      </div>
    </section>
  );
}
