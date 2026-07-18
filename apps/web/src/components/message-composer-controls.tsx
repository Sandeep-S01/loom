"use client";

import React, { useEffect, useState, type ReactNode } from "react";
import {
  formatAttachmentSize,
  type ComposerModelOption,
  type ComposerSettings,
} from "./message-composer-state";

interface AttachmentChipsProps {
  attachments: File[];
  onRemove: (key: string) => void;
}

interface ComposerPopoverProps {
  children: ReactNode;
  placement?: "bottom-start" | "top-start";
}

interface ComposerSettingsMenuProps {
  settings: ComposerSettings;
  onSettingChange: (key: keyof ComposerSettings, value: boolean) => void;
}

interface ComposerModelMenuProps {
  models: ComposerModelOption[];
  selectedModelId: string | null;
  onSelectModel: (modelId: string) => void;
}

export function AttachmentChips({
  attachments,
  onRemove,
}: AttachmentChipsProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="composer-attachments" aria-label="Selected attachments">
      {attachments.map((file) => {
        const key = `${file.name}:${file.size}:${file.lastModified}`;

        return (
          <AttachmentChip key={key} file={file} onRemove={() => onRemove(key)} />
        );
      })}
    </div>
  );
}

function AttachmentChip({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);

    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  return (
    <div className="composer-chip">
      {previewUrl ? (
        <>
          {/* Blob previews are ephemeral and cannot use the Next image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" className="composer-chip-thumb" src={previewUrl} />
        </>
      ) : null}
      <div className="min-w-0">
        <p className="composer-chip-name truncate">{file.name}</p>
        <p className="composer-chip-meta">{formatAttachmentSize(file.size)}</p>
      </div>
      <button
        aria-label={`Remove ${file.name}`}
        className="composer-chip-remove"
        onClick={onRemove}
        type="button"
      >
        <svg
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ComposerPopover({
  children,
  placement = "bottom-start",
}: ComposerPopoverProps) {
  return (
    <div
      className={[
        "composer-popover",
        placement === "top-start" ? "composer-popover-top" : "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function ComposerSettingsMenu({
  settings,
  onSettingChange,
}: ComposerSettingsMenuProps) {
  return (
    <div className="space-y-2">
      <p className="composer-popover-title">Composer settings</p>
      <label className="composer-toggle-row">
        <span>
          <span className="composer-toggle-label">Enter to send</span>
          <span className="composer-toggle-help">Shift+Enter inserts a new line.</span>
        </span>
        <input
          checked={settings.enterToSend}
          className="h-4 w-4 rounded border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-base)] text-accent focus:ring-accent"
          onChange={(event) =>
            onSettingChange("enterToSend", event.target.checked)
          }
          type="checkbox"
        />
      </label>
      <label className="composer-toggle-row">
        <span>
          <span className="composer-toggle-label">Show selected model badge</span>
          <span className="composer-toggle-help">Keep the active model visible in the toolbar.</span>
        </span>
        <input
          checked={settings.showModelBadge}
          className="h-4 w-4 rounded border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-base)] text-accent focus:ring-accent"
          onChange={(event) =>
            onSettingChange("showModelBadge", event.target.checked)
          }
          type="checkbox"
        />
      </label>
    </div>
  );
}

export function ComposerModelMenu({
  models,
  selectedModelId,
  onSelectModel,
}: ComposerModelMenuProps) {
  const [pinnedModels, setPinnedModels] = useState<string[]>([]);
  const [isUnavailableExpanded, setIsUnavailableExpanded] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem("clm.chat.pinned_models");
        if (saved) {
          setPinnedModels(JSON.parse(saved));
        }
      } catch (error) {
        console.error("Failed to load pinned models", error);
      }
    }
  }, []);

  const togglePin = (modelId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const next = pinnedModels.includes(modelId)
      ? pinnedModels.filter((id) => id !== modelId)
      : [...pinnedModels, modelId];

    setPinnedModels(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("clm.chat.pinned_models", JSON.stringify(next));
    }
  };

  const activeGroup = models.filter(
    (model) =>
      model.effectiveStatus !== "disabled" &&
      !model.id.toLowerCase().includes("free"),
  );
  const freeGroup = models.filter(
    (model) =>
      model.effectiveStatus !== "disabled" &&
      model.id.toLowerCase().includes("free"),
  );
  const unavailableGroup = models.filter(
    (model) => model.effectiveStatus === "disabled",
  );

  const sortedActiveGroup = [...activeGroup].sort((a, b) => {
    const aPinned = pinnedModels.includes(a.id);
    const bPinned = pinnedModels.includes(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return 0;
  });

  const getLatencyHint = (modelId: string) => {
    const id = modelId.toLowerCase();
    if (id.includes("free")) return "free";
    if (id.includes("pro")) return "high cap";
    if (id.includes("flash")) return "fast";
    return "active";
  };

  const renderModelRow = (
    model: ComposerModelOption,
    isDisabled = false,
  ) => {
    const active = model.id === selectedModelId;
    const isPinned = pinnedModels.includes(model.id);

    return (
      <div
        key={model.id}
        className={[
          "group flex w-full items-center justify-between rounded border px-2 py-1 text-left transition-colors",
          active ? "border-accent/20 bg-accent/10" : "border-transparent hover:bg-bg-hover",
          isDisabled ? "opacity-50" : "",
        ].join(" ")}
      >
        <button
          aria-pressed={active}
          className={[
            "flex min-w-0 flex-1 items-center gap-2 text-left",
            isDisabled ? "cursor-not-allowed" : "cursor-pointer",
          ].join(" ")}
          disabled={isDisabled}
          onClick={() => onSelectModel(model.id)}
          type="button"
        >
          <span
            className={[
              "h-1.5 w-1.5 flex-shrink-0 rounded-full",
              model.effectiveStatus === "rate_limited"
                ? "bg-state-degraded animate-pulse"
                : model.effectiveStatus === "disabled"
                  ? "bg-state-blocked"
                  : "bg-state-healthy",
            ].join(" ")}
          />
          <span className="truncate font-mono text-xs text-text-primary">
            {model.label}
          </span>
          {model.providerName ? (
            <span className="rounded border border-border-subtle bg-bg-active px-1 text-[9px] font-semibold uppercase text-text-secondary">
              {model.providerName}
            </span>
          ) : null}
          {model.effectiveStatus === "rate_limited" ? (
            <span className="text-[9px] italic text-state-degraded">
              (rate-limited)
            </span>
          ) : null}
          {isDisabled ? (
            <span className="text-[9px] italic text-state-blocked">(down)</span>
          ) : null}
        </button>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <span className="text-[10px] text-text-secondary">
            {getLatencyHint(model.id)}
          </span>
          {!isDisabled ? (
            <button
              aria-label={isPinned ? "Unpin model" : "Pin model"}
              className={[
                "text-xs transition-opacity focus:outline-none",
                isPinned
                  ? "opacity-100 text-amber-500"
                  : "opacity-0 text-text-secondary group-hover:opacity-100 hover:text-amber-500",
              ].join(" ")}
              onClick={(event) => togglePin(model.id, event)}
              type="button"
            >
              *
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="w-64 space-y-3 rounded-md border border-border-subtle bg-surface-raised p-2 text-text-primary">
      <p className="border-b border-border-subtle pb-1 text-xs font-semibold text-text-primary">
        Choose model
      </p>

      <div className="space-y-1">
        <p className="px-1 text-[9px] font-bold uppercase tracking-wider text-text-secondary">
          Active Models
        </p>
        {sortedActiveGroup.length > 0 ? (
          sortedActiveGroup.map((model) => renderModelRow(model))
        ) : (
          <p className="px-1 text-[10px] italic text-text-secondary">
            No active models
          </p>
        )}
      </div>

      <div className="space-y-1">
        <p className="px-1 text-[9px] font-bold uppercase tracking-wider text-text-secondary">
          Marketplace (Free)
        </p>
        {freeGroup.length > 0 ? (
          freeGroup.map((model) => renderModelRow(model))
        ) : (
          <p className="px-1 text-[10px] italic text-text-secondary">
            No free models
          </p>
        )}
      </div>

      {unavailableGroup.length > 0 ? (
        <div className="space-y-1">
          <button
            className="flex w-full items-center justify-between px-1 text-[9px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary"
            onClick={() => setIsUnavailableExpanded(!isUnavailableExpanded)}
            type="button"
          >
            <span>Unavailable ({unavailableGroup.length})</span>
            <span className="text-[10px]">{isUnavailableExpanded ? "^" : "v"}</span>
          </button>
          {isUnavailableExpanded ? (
            <div className="space-y-1 pt-1">
              {unavailableGroup.map((model) => renderModelRow(model, true))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
