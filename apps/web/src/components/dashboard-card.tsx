import type { ReactNode } from "react";
import { Panel } from "./ui/panel";

interface DashboardCardProps {
  title: string;
  eyebrow: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function DashboardCard({
  title,
  eyebrow,
  children,
  action,
  className,
}: DashboardCardProps) {
  return (
    <Panel
      action={action}
      variant="shell"
      className={className}
      contentClassName="mt-5"
      eyebrow={eyebrow}
      title={title}
    >
      {children}
    </Panel>
  );
}
