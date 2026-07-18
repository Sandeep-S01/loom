import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RecentConversationRow } from "./recent-conversation-row";

describe("RecentConversationRow", () => {
  it("uses the same horizontal track width as the sidebar navigation buttons", () => {
    const markup = renderToStaticMarkup(
      <RecentConversationRow
        active
        conversation={{
          id: "conv_1",
          title: "New Conversation",
          lastMessageAt: "2026-07-06T00:00:00.000Z",
        }}
        onDelete={vi.fn(async () => undefined)}
        onRename={vi.fn(async () => undefined)}
        onSelect={vi.fn(async () => undefined)}
        onTogglePinned={vi.fn()}
        pinned={false}
        subtitle="7/6/2026"
      />,
    );

    expect(markup).toContain("w-[calc(100%-24px)]");
    expect(markup).toContain("mx-3");
  });

  it("keeps the title on one truncated line without colliding with actions", () => {
    const markup = renderToStaticMarkup(
      <RecentConversationRow
        active
        conversation={{
          id: "conv_1",
          title: "A very long conversation title that should not collide with actions",
          lastMessageAt: "2026-07-06T00:00:00.000Z",
        }}
        onDelete={vi.fn(async () => undefined)}
        onRename={vi.fn(async () => undefined)}
        onSelect={vi.fn(async () => undefined)}
        onTogglePinned={vi.fn()}
        pinned={false}
        subtitle="7/6/2026"
      />,
    );

    expect(markup).toContain("recent-conversation-title-text truncate");
    expect(markup).toContain("recent-conversation-actions");
  });

  it("uses a keyboard-accessible non-button container for the selectable row content", () => {
    const markup = renderToStaticMarkup(
      <RecentConversationRow
        active
        conversation={{
          id: "conv_1",
          title: "New Conversation",
          lastMessageAt: "2026-07-06T00:00:00.000Z",
        }}
        onDelete={vi.fn(async () => undefined)}
        onRename={vi.fn(async () => undefined)}
        onSelect={vi.fn(async () => undefined)}
        onTogglePinned={vi.fn()}
        pinned={false}
        subtitle="7/6/2026"
      />,
    );

    expect(markup).toContain('role="button"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).not.toContain('<button class="flex min-w-0 flex-1 items-center');
  });
});
