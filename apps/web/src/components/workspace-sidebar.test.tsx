import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConnectionProvider } from "../context/connection-context";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { SECTION_META, SECTION_ORDER, type WorkspaceSection } from "./workspace-sections";

function renderSidebar(activeSection: WorkspaceSection) {
  return renderToStaticMarkup(
    <ConnectionProvider
      value={{
        connected: true,
        cooldownCount: 0,
        deviceId: "dev_1",
        eligibleCount: 3,
        hasError: false,
        isLoading: false,
        machineLabel: "Primary Machine",
        refresh: async () => undefined,
      }}
    >
      <WorkspaceSidebar
        activeConversationId={null}
        activeSection={activeSection}
        conversationCount={2}
        conversationError={null}
        conversationSearch=""
        dashboard={null}
        filteredConversations={[]}
        isCollapsed={false}
        isOverlayOpen={false}
        onConversationSearchChange={vi.fn()}
        onCreateConversation={vi.fn(async () => undefined)}
        onDeleteConversation={vi.fn(async () => undefined)}
        onRenameConversation={vi.fn(async () => undefined)}
        onRequestCollapse={vi.fn()}
        onRequestToggle={vi.fn()}
        onSelectConversation={vi.fn(async () => undefined)}
        onSelectSection={vi.fn()}
        onTogglePinnedConversation={vi.fn()}
        pinnedConversationIds={[]}
        sectionMeta={SECTION_META}
        sectionOrder={SECTION_ORDER}
        session={{
          user: {
            displayName: "Primary User",
            email: "primary@example.com",
          },
        }}
      />
    </ConnectionProvider>,
  );
}

describe("WorkspaceSidebar", () => {
  it("omits the misleading projects section label", () => {
    const markup = renderSidebar("chat");

    expect(markup).not.toContain(">Projects<");
  });

  it("keeps settings out of primary navigation in favor of the account menu", () => {
    const markup = renderSidebar("settings");

    expect(markup).not.toContain("sb-secondary-nav");
    expect(markup).not.toContain(">Settings<");
    expect(markup).toContain('aria-label="Open account menu.');
  });

  it("does not render the per-section summary panel for non-chat sections", () => {
    const markup = renderSidebar("activity");

    expect(markup).not.toContain("Summary");
    expect(markup).not.toContain("sb-summary-scroll");
    expect(markup).toContain(">Primary User<");
  });

  it("does not render the chat conversation count badge in primary navigation", () => {
    const markup = renderSidebar("chat");

    expect(markup).not.toContain("tracked conversation threads");
  });

  it("uses the centered collapsed navigation layout in rail mode", () => {
    const markup = renderToStaticMarkup(
      <ConnectionProvider
        value={{
          connected: true,
          cooldownCount: 0,
          deviceId: "dev_1",
          eligibleCount: 3,
          hasError: false,
          isLoading: false,
          machineLabel: "Primary Machine",
          refresh: async () => undefined,
        }}
      >
        <WorkspaceSidebar
          activeConversationId={null}
          activeSection="chat"
          conversationCount={2}
          conversationError={null}
          conversationSearch=""
          dashboard={null}
          filteredConversations={[]}
          isCollapsed
          isOverlayOpen={false}
          onConversationSearchChange={vi.fn()}
          onCreateConversation={vi.fn(async () => undefined)}
          onDeleteConversation={vi.fn(async () => undefined)}
          onRenameConversation={vi.fn(async () => undefined)}
          onRequestCollapse={vi.fn()}
          onRequestToggle={vi.fn()}
          onSelectConversation={vi.fn(async () => undefined)}
          onSelectSection={vi.fn()}
          onTogglePinnedConversation={vi.fn()}
          pinnedConversationIds={[]}
          sectionMeta={SECTION_META}
          sectionOrder={SECTION_ORDER}
          session={{
            user: {
              displayName: "Primary User",
              email: "primary@example.com",
            },
          }}
        />
      </ConnectionProvider>,
    );

    expect(markup).toContain("sb-nav-content-centered");
  });
});
