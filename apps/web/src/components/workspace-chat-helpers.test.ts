import { describe, expect, it } from "vitest";
import type { MessageItem } from "@clm/shared-types";
import {
  applySendResponse,
  buildUserTextMessage,
  getMessageRolePresentation,
  removeMessageById,
} from "./workspace-chat-helpers";

describe("workspace-chat-helpers", () => {
  it("assigns distinct presentation treatment to non-user roles", () => {
    expect(getMessageRolePresentation("assistant")).toMatchObject({
      alignmentClassName: "justify-start",
      label: "Assistant",
    });
    expect(getMessageRolePresentation("user")).toMatchObject({
      alignmentClassName: "justify-end",
      label: "You",
    });
    expect(getMessageRolePresentation("system")).toMatchObject({
      alignmentClassName: "justify-center",
      label: "System",
    });
    expect(getMessageRolePresentation("tool")).toMatchObject({
      alignmentClassName: "justify-start",
      label: "Tool",
    });
    expect(getMessageRolePresentation("status")).toMatchObject({
      alignmentClassName: "justify-center",
      label: "Status",
    });

    expect(getMessageRolePresentation("system").bubbleClassName).not.toBe(
      getMessageRolePresentation("user").bubbleClassName,
    );
    expect(getMessageRolePresentation("tool").bubbleClassName).not.toBe(
      getMessageRolePresentation("user").bubbleClassName,
    );
    expect(getMessageRolePresentation("status").bubbleClassName).not.toBe(
      getMessageRolePresentation("user").bubbleClassName,
    );
  });

  it("reconciles an optimistic message with persisted user and assistant messages", () => {
    const optimisticMessage = buildUserTextMessage({
      createdAt: "2026-07-05T10:00:00.000Z",
      id: "local-1",
      text: "Ship it",
    });
    const assistantMessage: MessageItem = {
      id: "assistant-1",
      role: "assistant",
      content: [{ type: "text", text: "Done." }],
      createdAt: "2026-07-05T10:00:01.000Z",
    };

    expect(
      applySendResponse({
        assistantMessage,
        createdAt: optimisticMessage.createdAt,
        messages: [optimisticMessage],
        optimisticId: optimisticMessage.id,
        text: "Ship it",
        userMessageId: "user-1",
      }),
    ).toEqual([
      {
        id: "user-1",
        role: "user",
        content: [{ type: "text", text: "Ship it" }],
        createdAt: "2026-07-05T10:00:00.000Z",
      },
      assistantMessage,
    ]);
  });

  it("removes an optimistic message after a failed send", () => {
    expect(
      removeMessageById(
        [
          buildUserTextMessage({
            createdAt: "2026-07-05T10:00:00.000Z",
            id: "local-1",
            text: "Keep this",
          }),
          buildUserTextMessage({
            createdAt: "2026-07-05T10:00:01.000Z",
            id: "local-2",
            text: "Remove this",
          }),
        ],
        "local-2",
      ),
    ).toEqual([
      {
        id: "local-1",
        role: "user",
        content: [{ type: "text", text: "Keep this" }],
        createdAt: "2026-07-05T10:00:00.000Z",
      },
    ]);
  });
});
