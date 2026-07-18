import type { ReactNode } from "react";

interface PanelProps {
  eyebrow?: string;
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  variant?: "card" | "shell" | "none";
}

export function Panel({
  action,
  children,
  className,
  contentClassName,
  eyebrow,
  title,
  variant = "card",
}: PanelProps) {
  const variantClass =
    variant === "card"
      ? "ui-card ui-card-hover"
      : variant === "shell"
      ? "ui-card-shell"
      : "";

  return (
    <section className={[variantClass, "p-5 sm:p-6", className ?? ""].join(" ").trim()}>
      {eyebrow || title || action ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {eyebrow ? <p className="ui-section-label">{eyebrow}</p> : null}
            {title ? <h3 className="mt-2 font-headline text-[18px] font-semibold leading-tight text-text-primary">{title}</h3> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={[eyebrow || title || action ? "mt-5" : "", contentClassName ?? ""].join(" ").trim()}>
        {children}
      </div>
    </section>
  );
}
