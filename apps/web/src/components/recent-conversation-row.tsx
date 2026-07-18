"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Share2,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { ConversationListItem } from "../lib/types";
import { getConversationShareUrl } from "../lib/conversation-links";

interface RecentConversationRowProps {
  active: boolean;
  conversation: ConversationListItem;
  pinned: boolean;
  onDelete: (conversationId: string) => Promise<void>;
  onRename: (conversationId: string, title: string) => Promise<void>;
  onSelect: (conversationId: string) => Promise<void> | void;
  onTogglePinned: (conversationId: string) => void;
  showPin?: boolean;
  subtitle: string;
}

export function RecentConversationRow({
  active,
  conversation,
  pinned,
  onDelete,
  onRename,
  onSelect,
  onTogglePinned,
  showPin = true,
  subtitle,
}: RecentConversationRowProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmittingRename, setIsSubmittingRename] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState(conversation.title);

  useEffect(() => {
    setDraftTitle(conversation.title);
  }, [conversation.title]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  useEffect(() => {
    if (!isMenuOpen) {
      setIsConfirmingDelete(false);
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMenuOpen]);

  const shareLabel = useMemo(() => {
    switch (shareState) {
      case "copied":
        return "Copied";
      case "failed":
        return "Share failed";
      default:
        return "Share";
    }
  }, [shareState]);

  const relativeTimestamp = useMemo(() => {
    const source = conversation.lastMessageAt ?? conversation.updatedAt;
    const timestamp = new Date(source);
    if (Number.isNaN(timestamp.getTime())) {
      return subtitle;
    }

    const elapsedMs = Date.now() - timestamp.getTime();
    const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000));

    if (elapsedMinutes < 1) return "Just now";
    if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) return `${elapsedHours}h ago`;

    const elapsedDays = Math.floor(elapsedHours / 24);
    if (elapsedDays < 7) return `${elapsedDays}d ago`;

    return timestamp.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }, [conversation.lastMessageAt, conversation.updatedAt, subtitle]);

  async function handleRenameSubmit() {
    const nextTitle = draftTitle.trim();
    if (!nextTitle || nextTitle === conversation.title) {
      setDraftTitle(conversation.title);
      setIsEditing(false);
      setActionError(null);
      return;
    }

    setIsSubmittingRename(true);
    setActionError(null);

    try {
      await onRename(conversation.id, nextTitle);
      setIsEditing(false);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to rename conversation.",
      );
    } finally {
      setIsSubmittingRename(false);
    }
  }

  async function handleShare() {
    const shareUrl = getConversationShareUrl(conversation.id);
    if (!shareUrl || !navigator.clipboard?.writeText) {
      setShareState("failed");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareState("copied");
      setIsMenuOpen(false);
      window.setTimeout(() => setShareState("idle"), 1800);
    } catch {
      setShareState("failed");
      window.setTimeout(() => setShareState("idle"), 1800);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    setActionError(null);

    try {
      await onDelete(conversation.id);
      setIsMenuOpen(false);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to delete conversation.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div
      className={[
        "group relative mx-3 flex h-10 w-[calc(100%-24px)] items-center gap-2 rounded-lg px-3 transition border-l-2",
        active
          ? "bg-surface-elevated border-accent text-text-primary"
          : "border-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary",
      ].join(" ")}
    >
      <div
        className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden rounded-lg bg-transparent text-left cursor-pointer"
        onClick={() => void onSelect(conversation.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            void onSelect(conversation.id);
          }
        }}
        role="button"
        tabIndex={0}
      >
        <FileText
          aria-hidden="true"
          className="shrink-0 text-[color:var(--sb-text-muted)]"
          size={16}
          strokeWidth={1.5}
        />

        <div className="min-w-0 flex-1 overflow-hidden">
          {isEditing ? (
            <>
              <div
                className="flex items-center gap-1.5"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <input
                  ref={inputRef}
                  aria-label="Conversation title"
                  className="min-w-0 flex-1 rounded-md border border-[color:var(--sb-border)] bg-surface px-2 py-1 text-[12px] font-medium text-text-primary outline-none transition focus:border-accent"
                  disabled={isSubmittingRename}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleRenameSubmit();
                    }

                    if (event.key === "Escape") {
                      event.preventDefault();
                      setDraftTitle(conversation.title);
                      setIsEditing(false);
                      setActionError(null);
                    }
                  }}
                  value={draftTitle}
                />
                <button
                  aria-label="Save title"
                  className="rounded-md px-2 py-1 text-[10px] font-semibold text-state-healthy transition hover:bg-[color:var(--sb-bg-hover)] disabled:opacity-50"
                  disabled={isSubmittingRename}
                  onClick={() => void handleRenameSubmit()}
                  type="button"
                >
                  Save
                </button>
                <button
                  aria-label="Cancel rename"
                  className="rounded-md px-2 py-1 text-[10px] font-semibold text-text-muted transition hover:bg-[color:var(--sb-bg-hover)]"
                  disabled={isSubmittingRename}
                  onClick={() => {
                    setDraftTitle(conversation.title);
                    setIsEditing(false);
                    setActionError(null);
                  }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
              {actionError ? (
                <p className="mt-1 text-[10px] leading-4 text-state-blocked">
                  {actionError}
                </p>
              ) : null}
            </>
          ) : (
            <p className="recent-conversation-title-text truncate text-[13px] font-normal leading-5 text-[color:var(--sb-text)] group-hover:font-medium">
              {conversation.title}
            </p>
          )}
        </div>
      </div>

      {!isEditing ? (
        <div className="recent-conversation-actions flex shrink-0 items-center gap-1.5 ml-auto">
          {/* Timestamp displayed by default, hidden on hover on desktop */}
          <span className="recent-conversation-time font-mono text-[9px] uppercase tracking-wider text-text-muted lg:group-hover:hidden">
            {relativeTimestamp}
          </span>
          {showPin && pinned && (
            <Pin
              aria-label="Pinned conversation"
              className="text-[color:var(--sb-text-faint)] lg:group-hover:hidden"
              size={12}
              strokeWidth={1.5}
            />
          )}

          {/* Desktop Hover buttons */}
          <div className="hidden lg:group-hover:flex items-center gap-1">
            {showPin && (
              <button
                aria-label={pinned ? "Unpin conversation" : "Pin conversation"}
                className="text-text-muted hover:text-accent p-1 transition"
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePinned(conversation.id);
                }}
                type="button"
              >
                {pinned ? <PinOff size={13} strokeWidth={1.5} /> : <Pin size={13} strokeWidth={1.5} />}
              </button>
            )}
            <button
              aria-label="Rename conversation"
              className="text-text-muted hover:text-accent p-1 transition"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              type="button"
            >
              <Pencil size={13} strokeWidth={1.5} />
            </button>
            <button
              aria-label="Share conversation"
              className="text-text-muted hover:text-accent p-1 transition"
              onClick={(e) => {
                e.stopPropagation();
                void handleShare();
              }}
              type="button"
            >
              <Share2 size={13} strokeWidth={1.5} />
            </button>
            <button
              aria-label="Delete conversation"
              className="text-text-muted hover:text-red-500 p-1 transition"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm("Are you sure you want to delete this conversation?")) {
                  void handleDelete();
                }
              }}
              type="button"
            >
              <Trash2 size={13} strokeWidth={1.5} />
            </button>
          </div>

          {/* Mobile/Touch More Actions Dropdown Fallback */}
          <div className="relative lg:hidden" ref={menuRef}>
            <button
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
              aria-label="Conversation actions"
              className="text-text-muted hover:text-accent p-1 transition"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen((open) => !open);
              }}
              type="button"
            >
              <MoreHorizontal size={15} strokeWidth={1.5} />
            </button>
            
            {isMenuOpen && (
              <div 
                className="absolute right-0 top-full z-[100] mt-1.5 w-36 rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel)] py-1 font-sans text-xs"
                role="menu"
              >
                {showPin && (
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-text-secondary hover:bg-[color:var(--color-bg-hover)] hover:text-text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePinned(conversation.id);
                      setIsMenuOpen(false);
                    }}
                    role="menuitem"
                  >
                    <Pin size={12} strokeWidth={1.5} />
                    <span>{pinned ? "Unpin" : "Pin"}</span>
                  </button>
                )}
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-text-secondary hover:bg-[color:var(--color-bg-hover)] hover:text-text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                    setIsMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <Pencil size={12} strokeWidth={1.5} />
                  <span>Rename</span>
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-text-secondary hover:bg-[color:var(--color-bg-hover)] hover:text-text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleShare();
                    setIsMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <Share2 size={12} strokeWidth={1.5} />
                  <span>{shareLabel}</span>
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-500 hover:bg-[color:var(--color-bg-hover)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Are you sure you want to delete this conversation?")) {
                      void handleDelete();
                    }
                    setIsMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <Trash2 size={12} strokeWidth={1.5} />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
