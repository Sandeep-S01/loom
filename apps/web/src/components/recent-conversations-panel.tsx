import type { DashboardConversationItem } from "../lib/types";
import { DashboardCard } from "./dashboard-card";
import { EmptyState } from "./ui/empty-state";
import { Panel } from "./ui/panel";
import { StatusPill } from "./ui/status-pill";

interface RecentConversationsPanelProps {
  conversations: DashboardConversationItem[];
}

function formatDate(value: string | null) {
  if (!value) {
    return "No messages yet";
  }

  return new Date(value).toLocaleString();
}

export function RecentConversationsPanel({
  conversations,
}: RecentConversationsPanelProps) {
  return (
    <DashboardCard eyebrow="Activity" title="Recent conversations">
      {conversations.length === 0 ? (
        <EmptyState
          description="Open chat to start the first thread."
          title="No conversations yet"
        />
      ) : (
        <div className="space-y-3">
          {conversations.map((conversation) => (
            <Panel
              key={conversation.id}
              className="p-4"
              contentClassName="space-y-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {conversation.title}
                  </p>
                  <StatusPill className="mt-2" tone="neutral">
                    {conversation.mode}
                  </StatusPill>
                </div>
                <p className="shrink-0 text-xs text-text-secondary">
                  {formatDate(conversation.updatedAt)}
                </p>
              </div>
              <p className="mt-3 text-sm text-text-secondary">
                Last message: {formatDate(conversation.lastMessageAt)}
              </p>
            </Panel>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
