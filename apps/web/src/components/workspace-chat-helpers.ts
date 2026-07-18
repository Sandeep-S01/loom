import type { MessageItem } from "@clm/shared-types";

type MessageRole = MessageItem["role"];

interface MessageRolePresentation {
  alignmentClassName: string;
  bubbleClassName: string;
  label: string;
}

interface BuildUserTextMessageInput {
  content?: MessageItem["content"];
  createdAt: string;
  id: string;
  text: string;
}

interface ApplySendResponseInput {
  assistantMessage: MessageItem | null;
  createdAt: string;
  messages: MessageItem[];
  optimisticId: string;
  text: string;
  userMessageId: string;
}

const MESSAGE_ROLE_PRESENTATIONS: Record<MessageRole, MessageRolePresentation> = {
  assistant: {
    alignmentClassName: "justify-start",
    bubbleClassName: "bg-[color:var(--color-surface-panel)] text-text-primary",
    label: "Assistant",
  },
  user: {
    alignmentClassName: "justify-end",
    bubbleClassName: "bg-[color:var(--color-surface-panel-muted)] text-text-primary",
    label: "You",
  },
  system: {
    alignmentClassName: "justify-center",
    bubbleClassName:
      "border border-state-degraded/30 bg-state-degraded/10 text-state-degraded",
    label: "System",
  },
  tool: {
    alignmentClassName: "justify-start",
    bubbleClassName:
      "border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)] text-text-secondary",
    label: "Tool",
  },
  status: {
    alignmentClassName: "justify-center",
    bubbleClassName:
      "border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)] text-text-secondary",
    label: "Status",
  },
};

export function getMessageRolePresentation(role: MessageRole): MessageRolePresentation {
  return MESSAGE_ROLE_PRESENTATIONS[role];
}

export function buildUserTextMessage({
  content,
  createdAt,
  id,
  text,
}: BuildUserTextMessageInput): MessageItem {
  return {
    id,
    role: "user",
    content: content ?? [{ type: "text", text }],
    createdAt,
  };
}

export function applySendResponse({
  assistantMessage,
  createdAt,
  messages,
  optimisticId,
  text,
  userMessageId,
}: ApplySendResponseInput): MessageItem[] {
  if (assistantMessage) {
    return [
      ...removeMessageById(messages, optimisticId),
      buildUserTextMessage({
        createdAt,
        id: userMessageId,
        text,
      }),
      assistantMessage,
    ];
  }

  return messages.map((message) =>
    message.id === optimisticId ? { ...message, id: userMessageId } : message,
  );
}

export function removeMessageById(messages: MessageItem[], messageId: string): MessageItem[] {
  return messages.filter((message) => message.id !== messageId);
}
