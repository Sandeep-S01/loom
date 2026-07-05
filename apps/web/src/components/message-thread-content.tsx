import type { MessageItem } from "@clm/shared-types";
import { getMessageRolePresentation } from "./workspace-chat-helpers";

interface MessageContentBlock {
  key: string;
  text: string;
}

interface MessageRolePresentationSnapshot {
  alignmentClassName: string;
  bubbleClassName: string;
  label: string;
}

const FALLBACK_MESSAGE_TEXT = "Unsupported message content.";
const UNKNOWN_ROLE_PRESENTATION: MessageRolePresentationSnapshot = {
  alignmentClassName: "justify-start",
  bubbleClassName: "border border-white/10 bg-[#0f131b] text-text-secondary",
  label: "Message",
};

export function getMessageContentBlocks(
  content: MessageItem["content"] | unknown,
): MessageContentBlock[] {
  if (!Array.isArray(content)) {
    return [{ key: "fallback", text: FALLBACK_MESSAGE_TEXT }];
  }

  const blocks = content.flatMap((item, index) => {
    if (typeof item === "string") {
      return [{ key: `text-${index}`, text: item }];
    }

    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    if (typeof record.text === "string" && record.text.trim().length > 0) {
      return [{ key: `text-${index}`, text: record.text }];
    }

    if (typeof record.type === "string") {
      return [{ key: `fallback-${index}`, text: `[${record.type} content unavailable]` }];
    }

    return [];
  });

  return blocks.length > 0 ? blocks : [{ key: "fallback", text: FALLBACK_MESSAGE_TEXT }];
}

export function getSafeMessageRolePresentation(
  role: MessageItem["role"] | string | null | undefined,
): MessageRolePresentationSnapshot {
  if (
    role === "assistant" ||
    role === "user" ||
    role === "system" ||
    role === "tool" ||
    role === "status"
  ) {
    return getMessageRolePresentation(role);
  }

  return UNKNOWN_ROLE_PRESENTATION;
}
