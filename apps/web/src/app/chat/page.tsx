import { WorkspaceAppShell } from "../../components/workspace-app-shell";

export default function ChatPage() {
  return (
    <main className="min-h-screen">
      <WorkspaceAppShell initialSection="chat" />
    </main>
  );
}
