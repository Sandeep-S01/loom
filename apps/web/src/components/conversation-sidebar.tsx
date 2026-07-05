import type { ConversationListItem } from "../lib/types";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/empty-state";
import { Panel } from "./ui/panel";

interface ConversationSidebarProps {
  conversations: ConversationListItem[];
  activeConversationId: string | null;
  isLoading: boolean;
  onCreateConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  isLoading,
  onCreateConversation,
  onSelectConversation,
}: ConversationSidebarProps) {
  return (
    <aside className="flex h-full w-full max-w-full flex-col border-b border-white/10 bg-surface-elevated md:max-w-80 md:border-b-0 md:border-r">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
            Chats
          </p>
          <h2 className="text-lg font-semibold text-text-primary">
            Conversations
          </h2>
        </div>
        <Button
          onClick={onCreateConversation}
          type="button"
          variant="primary"
        >
          New
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <p className="text-sm text-text-secondary">Loading conversations...</p>
        ) : null}

        {!isLoading && conversations.length === 0 ? (
          <EmptyState
            description="Start a new chat to create the first thread."
            title="No conversations yet"
          />
        ) : null}

        <div className="space-y-2">
          {conversations.map((conversation) => {
            const active = conversation.id === activeConversationId;

            return (
              <Panel
                key={conversation.id}
                className={[
                  "w-full px-3 py-3 text-left transition",
                  active
                    ? "border-accent bg-accent/10"
                    : "border-white/5 bg-surface hover:border-white/15 hover:bg-white/5",
                ].join(" ")}
              >
                <button
                  className="w-full text-left"
                  onClick={() => onSelectConversation(conversation.id)}
                  type="button"
                >
                  <p className="truncate text-sm font-medium text-text-primary">
                    {conversation.title}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {conversation.lastMessageAt
                      ? new Date(conversation.lastMessageAt).toLocaleString()
                      : "No messages yet"}
                  </p>
                </button>
              </Panel>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
