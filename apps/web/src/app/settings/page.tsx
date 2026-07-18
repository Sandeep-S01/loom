import { WorkspaceAppShell } from "../../components/workspace-app-shell";

export default function SettingsPage() {
  return (
    <main className="min-h-dvh">
      <WorkspaceAppShell initialSection="settings" />
    </main>
  );
}
