import { WorkspaceAppShell } from "../../components/workspace-app-shell";

export default function DashboardPage() {
  return (
    <main className="min-h-dvh">
      <WorkspaceAppShell initialSection="dashboard" />
    </main>
  );
}
