"use client";

import type { ReactNode } from "react";
import type { WorkspaceSection, WorkspaceSectionMeta } from "./workspace-sections";
import type { SessionResponse, DashboardResponse, ConversationListItem } from "../lib/types";
import { useConnection } from "../context/connection-context";
import { LoomLogo } from "./loom-logo";

interface WorkspaceSidebarProps {
  activeSection: WorkspaceSection;
  isCollapsed: boolean;
  isOverlayOpen: boolean;
  onRequestToggle: () => void;
  onRequestCollapse: () => void;
  onSelectSection: (section: WorkspaceSection) => void;
  conversationCount: number;
  session: SessionResponse | null;
  dashboard: DashboardResponse | null;
  sectionMeta: Record<WorkspaceSection, WorkspaceSectionMeta>;
  sectionOrder: WorkspaceSection[];
  
  // Chat specific props
  activeConversationId: string | null;
  conversationSearch: string;
  onConversationSearchChange: (value: string) => void;
  onCreateConversation: () => Promise<void>;
  filteredConversations: ConversationListItem[];
  onSelectConversation: (conversationId: string) => Promise<void>;
  onTogglePinnedConversation: (conversationId: string) => void;
  pinnedConversationIds: string[];
  conversationError: string | null;
  
  // Dynamic section summary
  panelBody: ReactNode;
}

// Inline SVG Icons mapping the custom sections
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function WorkspacesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function ModelsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

function CompanionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const SECTION_ICONS: Record<WorkspaceSection, () => React.JSX.Element> = {
  chat: ChatIcon,
  workspaces: WorkspacesIcon,
  models: ModelsIcon,
  companion: CompanionIcon,
  activity: ActivityIcon,
  settings: SettingsIcon,
};

export function WorkspaceSidebar({
  activeSection,
  isCollapsed,
  isOverlayOpen,
  onRequestToggle,
  onRequestCollapse,
  onSelectSection,
  conversationCount,
  session,
  dashboard,
  sectionMeta,
  sectionOrder,
  activeConversationId,
  conversationSearch,
  onConversationSearchChange,
  onCreateConversation,
  filteredConversations,
  onSelectConversation,
  onTogglePinnedConversation,
  pinnedConversationIds,
  conversationError,
  panelBody,
}: WorkspaceSidebarProps) {
  const { connected } = useConnection();

  return (
    <>
      {/* Mobile background backdrop overlay */}
      <div
        aria-hidden={!isOverlayOpen}
        className={[
          "workspace-shell-backdrop lg:hidden",
          isOverlayOpen ? "workspace-shell-backdrop-open" : "",
        ].join(" ")}
        onClick={onRequestCollapse}
      />

      <nav
        id="sidebar"
        className={[
          "sidebar",
          isCollapsed ? "collapsed" : "",
          isOverlayOpen ? "sidebar-mobile-open" : "",
        ].join(" ")}
      >
        {/* Brand & Toggle header */}
        <div className="sb-top">
          <div className="sb-brand select-none">
            <LoomLogo markClassName="h-7 w-7" textClassName="sb-brand-name text-[15px]" />
          </div>

          <button
            id="toggleBtn"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="sb-toggle"
            onClick={onRequestToggle}
            type="button"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

        {/* Primary Action Button: New chat - FIXED */}
        <button
          className="sb-primary border-none w-[calc(100%-24px)] flex-shrink-0"
          onClick={() => {
            void onCreateConversation();
          }}
          type="button"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>New chat</span>
          {isCollapsed && <div className="sb-tooltip">New chat</div>}
        </button>

        <div className="sb-nav px-0">
          {/* Search Bar */}
          <div
            className="sb-search flex-shrink-0"
            onClick={() => isCollapsed && onRequestToggle()}
            tabIndex={isCollapsed ? 0 : -1}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <label className="sr-only" htmlFor="sidebarSearchInput">
              Search conversations
            </label>
            <input
              id="sidebarSearchInput"
              className="w-full bg-transparent border-none outline-none text-xs text-text-primary placeholder:text-text-muted focus:ring-0"
              onChange={(event) => {
                onConversationSearchChange(event.target.value);
                if (activeSection !== "chat") {
                  onSelectSection("chat");
                }
              }}
              placeholder="Search..."
              value={conversationSearch}
            />
            {isCollapsed && <div className="sb-tooltip">Search</div>}
          </div>

          <div className="sb-nav-content">
            {/* Navigation list */}
            <div className="sb-projects flex flex-col flex-shrink-0">
              <div className="sb-section-label">Projects</div>

              <div className="sb-projects-list space-y-0.5">
                {sectionOrder.map((section) => {
                  const selected = section === activeSection;
                  const Icon = SECTION_ICONS[section];
                  const meta = sectionMeta[section];

                  return (
                    <button
                      key={section}
                      className={[
                        "sb-item border-none text-left w-[calc(100%-16px)]",
                        selected ? "active" : "",
                      ].join(" ")}
                      onClick={() => onSelectSection(section)}
                      type="button"
                    >
                      <Icon />
                      <span>{meta.label}</span>
                      <div className="sb-tooltip">{meta.label}</div>

                      {section === "chat" && conversationCount > 0 && !isCollapsed && (
                        <span
                          title={`${conversationCount} tracked conversation threads`}
                          aria-label={`${conversationCount} tracked conversation threads`}
                          className="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white shadow-sm border border-[#080a0e]"
                        >
                          {conversationCount}
                        </span>
                      )}
                      {section === "chat" && conversationCount > 0 && !isCollapsed && (
                        <div className="sb-tooltip">
                          {conversationCount} tracked conversation threads
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recent conversation list */}
            {!isCollapsed && activeSection === "chat" && (
              <div className="mt-4 flex min-h-0 flex-1 flex-col">
                <div className="sb-section-label flex-shrink-0">Recent</div>

                {conversationError ? (
                  <div className="mx-3 mt-2 rounded border border-state-degraded/20 bg-state-degraded/5 px-3 py-2 text-[11px] text-state-degraded flex-shrink-0">
                    {conversationError}
                  </div>
                ) : null}

              <div className="sb-recent-list-scroll mt-2 min-h-0 flex-1 pr-1">
                  {filteredConversations.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-white/5 mx-3 px-3 py-4 text-[10px] text-text-muted text-center leading-relaxed">
                      No threads found.
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {filteredConversations.map((conversation) => {
                        const active = conversation.id === activeConversationId;
                        const pinned = pinnedConversationIds.includes(conversation.id);

                        return (
                          <div
                            key={conversation.id}
                            className={[
                              "sb-item group border-none text-left w-[calc(100%-16px)] flex justify-between items-center pr-2",
                              active ? "active" : "",
                            ].join(" ")}
                          >
                            <button
                              className="flex-grow min-w-0 flex items-center gap-2.5 text-left border-none bg-transparent p-0 text-text-muted hover:text-text-primary"
                              onClick={() => void onSelectConversation(conversation.id)}
                              type="button"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 w-4 h-4">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <path d="M14 2v6h6" />
                              </svg>
                              <span className="truncate">{conversation.title}</span>
                            </button>

                            <button
                              aria-label={pinned ? "Unpin conversation" : "Pin conversation"}
                              className={[
                                "rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider transition shrink-0",
                                pinned
                                  ? "bg-accent/20 text-white"
                                  : "text-text-muted opacity-0 group-hover:opacity-100 hover:bg-white/5 hover:text-text-primary",
                              ].join(" ")}
                              onClick={() => onTogglePinnedConversation(conversation.id)}
                              type="button"
                            >
                              {pinned ? "Pinned" : "Pin"}
                            </button>

                            <div className="sb-tooltip">{conversation.title}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Summary panel - ONLY when expanded and activeSection !== "chat" */}
            {!isCollapsed && activeSection !== "chat" && (
              <div className="mt-4 flex min-h-0 flex-1 flex-col">
                <div className="sb-section-label flex-shrink-0">{sectionMeta[activeSection].label} Summary</div>
                <div className="sb-summary-scroll min-h-0 flex-1 overflow-y-auto px-3 py-2 space-y-4 text-xs text-text-secondary">
                  {panelBody}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Area - FIXED */}
        <div
          className="sb-footer flex-shrink-0"
          onClick={() => onSelectSection("settings")}
          tabIndex={0}
        >
          <div className="sb-avatar select-none">
            {session?.user.displayName?.[0] ?? "U"}
          </div>
          <div className="sb-footer-meta min-w-0">
            <div className="sb-footer-name truncate">
              {session?.user.displayName ?? "User"}
            </div>
            <div className="sb-footer-sub truncate">
              {connected ? "Companion online" : "Companion offline"}
            </div>
          </div>
          {isCollapsed && (
            <div className="sb-tooltip">
              {session?.user.displayName ?? "User"} ({connected ? "Online" : "Offline"})
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
