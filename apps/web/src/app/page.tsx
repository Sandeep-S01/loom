import { WorkspaceAppShell } from "../components/workspace-app-shell";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <WorkspaceAppShell initialSection="chat" />
    </main>
  );
}
