"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  LayoutDashboard,
  Folder,
  KeyRound,
  LogOut,
  MessageSquare,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import type { WorkspaceSection, WorkspaceSectionMeta } from "./workspace-sections";
import type { SessionResponse, DashboardResponse, ConversationListItem } from "../lib/types";
import { useConnection } from "../context/connection-context";
import { LoomLogo } from "./loom-logo";
import { RecentConversationRow } from "./recent-conversation-row";

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
  onRenameConversation: (conversationId: string, title: string) => Promise<void>;
  onDeleteConversation: (conversationId: string) => Promise<void>;
  onTogglePinnedConversation: (conversationId: string) => void;
  pinnedConversationIds: string[];
  conversationError: string | null;
  onLogout: () => Promise<void>;
  mode?: "workspace" | "admin";
}

const SECTION_ICONS: Record<WorkspaceSection, LucideIcon> = {
  dashboard: LayoutDashboard,
  chat: MessageSquare,
  workspaces: Folder,
  models: KeyRound,
  companion: Monitor,
  activity: ChartNoAxesColumnIncreasing,
  settings: Settings,
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
  onRenameConversation,
  onDeleteConversation,
  onTogglePinnedConversation,
  pinnedConversationIds,
  conversationError,
  onLogout,
  mode = "workspace",
}: WorkspaceSidebarProps) {
  const { connected } = useConnection();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const primarySections = sectionOrder.filter((section) => section !== "settings");
  const pinnedConversations = filteredConversations.filter((conversation) =>
    pinnedConversationIds.includes(conversation.id),
  );
  const recentConversations = filteredConversations.filter(
    (conversation) => !pinnedConversationIds.includes(conversation.id),
  );

  useEffect(() => {
    if (isSearchOpen && !isCollapsed) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen, isCollapsed]);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsAccountMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isAccountMenuOpen]);

  function renderSectionButton(
    section: WorkspaceSection,
  ) {
    const selected = section === activeSection;
    const Icon = SECTION_ICONS[section];
    const meta = sectionMeta[section];
    const label = meta.label;

    return (
      <button
        key={section}
        className={[
          "sb-button sb-button-nav sb-item text-left",
          selected ? "active" : "",
        ].join(" ")}
        onClick={() => onSelectSection(section)}
        type="button"
      >
        <Icon aria-hidden="true" size={18} strokeWidth={1.5} />
        <span>{label}</span>
        <div className="sb-tooltip">{label}</div>
      </button>
    );
  }

  function renderConversationList(
    conversations: ConversationListItem[],
    options?: { emptyLabel?: string; showPin?: boolean },
  ) {
    if (conversationError) {
      return (
        <div className="mx-3 mt-2 rounded border border-state-degraded/20 bg-state-degraded/5 px-3 py-2 text-[11px] text-state-degraded flex-shrink-0">
          {conversationError}
        </div>
      );
    }

    if (conversations.length === 0) {
      return options?.emptyLabel ? (
        <div className="mx-3 rounded-lg border border-dashed border-[color:var(--sb-border)] px-3 py-4 text-center text-[10px] leading-relaxed text-text-muted">
          {options.emptyLabel}
        </div>
      ) : null;
    }

    return (
      <div className="space-y-1">
        {conversations.map((conversation) => {
          const active = conversation.id === activeConversationId;
          const pinned = pinnedConversationIds.includes(conversation.id);

          return (
            <RecentConversationRow
              key={conversation.id}
              active={active}
              conversation={conversation}
              onDelete={onDeleteConversation}
              onRename={onRenameConversation}
              onSelect={onSelectConversation}
              onTogglePinned={onTogglePinnedConversation}
              pinned={pinned}
              showPin={options?.showPin}
              subtitle={
                conversation.lastMessageAt
                  ? new Date(conversation.lastMessageAt).toLocaleDateString()
                  : "No messages yet"
              }
            />
          );
        })}
      </div>
    );
  }

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
        <div className="sb-top">
          <LoomLogo
            className={[
              "sb-logo-lockup select-none text-text-primary",
              isCollapsed ? "sb-logo-lockup-collapsed" : "",
            ].join(" ")}
            markClassName="sb-logo-compact"
            showWordmark={!isCollapsed}
            textClassName="sb-logo-wordmark"
            variant="mono"
          />

          <div className="sb-top-actions">
            {!isCollapsed ? (
              <button
                aria-label="Search conversations"
                className="sb-button sb-button-ghost-icon"
                onClick={() => setIsSearchOpen((current) => !current)}
                type="button"
              >
                <Search aria-hidden="true" size={18} strokeWidth={1.5} />
              </button>
            ) : null}
            <button
              id="toggleBtn"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="sb-button sb-button-ghost-icon sb-toggle"
              onClick={onRequestToggle}
              type="button"
            >
              {isCollapsed ? (
                <PanelLeftOpen aria-hidden="true" size={18} strokeWidth={1.5} />
              ) : (
                <PanelLeftClose aria-hidden="true" size={18} strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>

        <button
          className="sb-button sb-button-primary sb-primary flex-shrink-0"
          onClick={() => {
            void onCreateConversation();
          }}
          type="button"
        >
          <Plus aria-hidden="true" size={20} strokeWidth={1.5} />
          <span>New chat</span>
          {isCollapsed && <div className="sb-tooltip">New chat</div>}
        </button>

        <div className="sb-nav px-0">
          {!isCollapsed && (isSearchOpen || conversationSearch) ? (
            <div className="sb-search flex-shrink-0">
              <Search aria-hidden="true" size={18} strokeWidth={1.5} />
              <label className="sr-only" htmlFor="sidebarSearchInput">
                Search conversations
              </label>
              <input
                ref={searchInputRef}
                id="sidebarSearchInput"
                className="w-full bg-transparent border-none outline-none text-xs text-text-primary placeholder:text-text-muted focus:ring-0"
                onChange={(event) => {
                  onConversationSearchChange(event.target.value);
                  if (activeSection !== "chat") {
                    onSelectSection("chat");
                  }
                }}
                placeholder="Search chats..."
                value={conversationSearch}
              />
            </div>
          ) : null}

          <div
            className={[
              "sb-nav-content",
              isCollapsed ? "sb-nav-content-centered" : "",
            ].join(" ")}
          >
            <div className="sb-projects flex flex-col flex-shrink-0">
              <div className="sb-projects-list space-y-0.5">
                {primarySections.map((section) => renderSectionButton(section))}
              </div>
            </div>

            {!isCollapsed && activeSection === "chat" && (
              <div className="sb-recent-wrap">
                {pinnedConversations.length > 0 ? (
                  <div className="sb-starred-group">
                    <div className="sb-section-label flex-shrink-0">Pinned</div>
                    {renderConversationList(pinnedConversations, { showPin: true })}
                  </div>
                ) : null}

                <div className="sb-recents-heading">
                  <div className="sb-section-label flex-shrink-0">Recents</div>
                  {recentConversations.length > 0 ? (
                    <button
                      aria-label="Search recents"
                      className="sb-button sb-button-ghost-icon sb-mini-action"
                      onClick={() => setIsSearchOpen((current) => !current)}
                      type="button"
                    >
                      <SlidersHorizontal aria-hidden="true" size={18} strokeWidth={1.5} />
                    </button>
                  ) : null}
                </div>

                <div className="sb-recent-list-scroll mt-0 min-h-0 flex-1">
                  {renderConversationList(recentConversations, {
                    emptyLabel: "No threads found.",
                    showPin: true,
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="sb-account-wrap flex-shrink-0" ref={accountMenuRef}>
          <button
            aria-expanded={isAccountMenuOpen}
            aria-haspopup="menu"
            aria-label={`Open account menu. User: ${session?.user.displayName ?? "User"}. Companion is ${connected ? "online" : "offline"}.`}
            className="sb-button sb-button-nav sb-footer"
            onClick={() => setIsAccountMenuOpen((current) => !current)}
            type="button"
          >
            <div className="sb-avatar select-none" aria-hidden="true">
              {session?.user.displayName?.[0] ?? "U"}
              <span
                aria-hidden="true"
                className={[
                  "sb-avatar-status",
                  connected ? "online" : "offline",
                ].join(" ")}
              />
            </div>
            <div className="sb-footer-meta">
              <div className="sb-footer-name truncate">
                {session?.user.displayName ?? "User"}
              </div>
              <div className="sb-footer-sub truncate">
                {connected ? "Companion online" : "Companion offline"}
              </div>
            </div>
            <ChevronDown
              aria-hidden="true"
              className="sb-account-chevron"
              size={16}
              strokeWidth={1.5}
            />
            {isCollapsed && (
              <div className="sb-tooltip">
                {session?.user.displayName ?? "User"} ({connected ? "Online" : "Offline"})
              </div>
            )}
          </button>

          {isAccountMenuOpen ? (
            <div className="sb-account-menu" role="menu">
              <button
                className="sb-button sb-button-nav sb-account-menu-item"
                onClick={() => {
                  setIsAccountMenuOpen(false);
                  onSelectSection("companion");
                }}
                type="button"
              >
                <Monitor aria-hidden="true" size={16} strokeWidth={1.5} />
                <span>Companion setup</span>
              </button>
              <button
                className="sb-button sb-button-nav sb-account-menu-item"
                onClick={() => {
                  setIsAccountMenuOpen(false);
                  onSelectSection("settings");
                }}
                type="button"
              >
                <Settings aria-hidden="true" size={16} strokeWidth={1.5} />
                <span>Settings</span>
              </button>
              {session?.user.role === "admin" ? (
                <a
                  className="sb-button sb-button-nav sb-account-menu-item"
                  href={mode === "admin" ? "/dashboard" : "/admin"}
                  role="menuitem"
                >
                  <KeyRound aria-hidden="true" size={16} strokeWidth={1.5} />
                  <span>{mode === "admin" ? "Workspace" : "Admin Console"}</span>
                </a>
              ) : null}
              <button
                className="sb-button sb-button-nav sb-account-menu-item"
                onClick={() => {
                  setIsAccountMenuOpen(false);
                  void onLogout();
                }}
                type="button"
              >
                <LogOut aria-hidden="true" size={16} strokeWidth={1.5} />
                <span>Sign out</span>
              </button>
            </div>
          ) : null}
        </div>
      </nav>
    </>
  );
}
