import { WorkspaceAppShell } from "../../components/workspace-app-shell";

export default function WorkspacesPage() {
  return (
    <main className="min-h-dvh">
      <WorkspaceAppShell initialSection="workspaces" />
    </main>
  );
}
