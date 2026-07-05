import type { MessageItem } from "@clm/shared-types";

type MessageRole = MessageItem["role"];

interface MessageRolePresentation {
  alignmentClassName: string;
  bubbleClassName: string;
  label: string;
}

interface BuildUserTextMessageInput {
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
    bubbleClassName: "bg-[#11141b] text-text-primary",
    label: "Assistant",
  },
  user: {
    alignmentClassName: "justify-end",
    bubbleClassName: "bg-accent/15 text-white",
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
    bubbleClassName: "border border-white/10 bg-[#0f131b] text-text-secondary",
    label: "Tool",
  },
  status: {
    alignmentClassName: "justify-center",
    bubbleClassName: "border border-white/8 bg-[#0d1016] text-text-secondary",
    label: "Status",
  },
};

export function getMessageRolePresentation(role: MessageRole): MessageRolePresentation {
  return MESSAGE_ROLE_PRESENTATIONS[role];
}

export function buildUserTextMessage({
  createdAt,
  id,
  text,
}: BuildUserTextMessageInput): MessageItem {
  return {
    id,
    role: "user",
    content: [{ type: "text", text }],
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
