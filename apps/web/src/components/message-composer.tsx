"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  AttachmentChips,
  ComposerModelMenu,
  ComposerPopover,
  ComposerSettingsMenu,
} from "./message-composer-controls";
import {
  appendUniqueFiles,
  buildImageContentPart,
  buildAttachmentKey,
  loadComposerSettings,
  normalizeModelOptions,
  saveComposerSettings,
  type ComposerModelOption,
  type ComposerSettings,
} from "./message-composer-state";

interface MessageComposerProps {
  availableModels?: ComposerModelOption[];
  disabled?: boolean;
  draftValue?: string;
  onDraftChange?: (value: string) => void;
  onSend: (input: {
    text: string;
    modelId: string | null;
    images?: Awaited<ReturnType<typeof buildImageContentPart>>[];
  }) => void | Promise<void>;
}

export function MessageComposer({
  availableModels = [],
  disabled = false,
  draftValue,
  onDraftChange,
  onSend,
}: MessageComposerProps) {
  const [internalValue, setInternalValue] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ComposerSettings>(() =>
    loadComposerSettings(),
  );
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [openPopover, setOpenPopover] = useState<"settings" | "models" | null>(null);
  const value = draftValue ?? internalValue;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const normalizedModels = normalizeModelOptions(availableModels);
  const selectedModel =
    normalizedModels.find((model) => model.id === selectedModelId) ??
    normalizedModels[0] ??
    null;
  const selectedSendModel =
    attachments.length > 0
      ? selectedModel?.supportsVision
        ? selectedModel
        : normalizedModels.find((model) => model.supportsVision) ?? null
      : selectedModel;
  const visionUnavailable = attachments.length > 0 && !selectedSendModel;

  function updateValue(nextValue: string) {
    onDraftChange?.(nextValue);

    if (draftValue === undefined) {
      setInternalValue(nextValue);
    }
  }

  // Auto-resize textarea height based on content scrollHeight
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  useEffect(() => {
    if (!selectedModelId && normalizedModels[0]) {
      setSelectedModelId(normalizedModels[0].id);
    }
  }, [normalizedModels, selectedModelId]);

  useEffect(() => {
    saveComposerSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!openPopover) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setOpenPopover(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenPopover(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openPopover]);

  async function handleSubmit() {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || disabled) {
      return;
    }

    if (visionUnavailable) {
      setComposerError(
        "No active vision-capable model is available right now. Wait for Gemini to recover or enable another vision model.",
      );
      return;
    }

    setComposerError(null);
    let images: Awaited<ReturnType<typeof buildImageContentPart>>[];
    try {
      images = await Promise.all(
        attachments
          .filter((file) => file.type.startsWith("image/"))
          .map((file) => buildImageContentPart(file)),
      );
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : "Failed to read attached image.");
      return;
    }
    const previousValue = value;
    const previousAttachments = attachments;
    updateValue("");
    setAttachments([]);

    try {
      await onSend({
        text: trimmed,
        modelId: selectedSendModel?.id ?? null,
        images,
      });
    } catch (error) {
      updateValue(previousValue);
      setAttachments(previousAttachments);
      throw error;
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (settings.enterToSend && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  function handleAttachmentChange(event: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    if (incoming.length === 0) {
      return;
    }

    try {
      const nextAttachments = appendUniqueFiles(attachments, incoming);
      setComposerError(null);
      setAttachments(nextAttachments);
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : "Unable to attach image.");
    }
    event.target.value = "";
  }

  function removeAttachment(key: string) {
    setComposerError(null);
    setAttachments((current) =>
      current.filter((file) => buildAttachmentKey(file) !== key),
    );
  }

  function handleSettingChange(key: keyof ComposerSettings, nextValue: boolean) {
    setSettings((current) => ({
      ...current,
      [key]: nextValue,
    }));
  }

  const isButtonDisabled =
    disabled || visionUnavailable || (value.trim().length === 0 && attachments.length === 0);

  return (
    <div className="composer-wrap">
      <div className="composer">
        <input
          ref={fileInputRef}
          className="sr-only"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onChange={handleAttachmentChange}
          type="file"
        />
        <textarea
          ref={textareaRef}
          aria-label="Message"
          placeholder="Reply..."
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => updateValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <AttachmentChips attachments={attachments} onRemove={removeAttachment} />
        {(composerError || visionUnavailable) ? (
          <div className="composer-error" role="status">
            {composerError ??
              "No active vision-capable model is available right now. Wait for Gemini to recover or enable another vision model."}
          </div>
        ) : null}
        <div className="composer-toolbar">
          <div className="composer-tools" ref={popoverRef}>
            <button
              aria-label="Attach files"
              className={["tool-btn", attachments.length > 0 ? "tool-btn-active" : ""].join(" ")}
              title="Attach file"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <button
              aria-label="Composer settings"
              className={["tool-btn", openPopover === "settings" ? "tool-btn-active" : ""].join(" ")}
              title="Tools"
              onClick={() =>
                setOpenPopover((current) =>
                  current === "settings" ? null : "settings",
                )
              }
              type="button"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <button
              aria-label="Choose model"
              className={["tool-btn composer-model-btn flex items-center gap-2", openPopover === "models" ? "tool-btn-active" : ""].join(" ")}
              title={selectedSendModel ? `Model: ${selectedSendModel.label}` : "Choose model"}
              onClick={() =>
                setOpenPopover((current) => (current === "models" ? null : "models"))
              }
              type="button"
            >
              {selectedSendModel ? (
                <span
                  className={[
                    "w-2 h-2 rounded-full flex-shrink-0",
                    selectedSendModel.effectiveStatus === "rate_limited"
                      ? "bg-state-degraded"
                      : selectedSendModel.effectiveStatus === "disabled"
                      ? "bg-state-blocked"
                      : "bg-state-healthy"
                  ].join(" ")}
                />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5">
                  <path d="M12 3l8 4-8 4-8-4 8-4z" />
                  <path d="M4 11l8 4 8-4" />
                  <path d="M4 15l8 4 8-4" />
                </svg>
              )}
              <span className="font-mono text-[13px] font-medium text-text-primary">
                {selectedSendModel ? selectedSendModel.label : "Choose model"}
              </span>
              {selectedSendModel?.providerName ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface-elevated text-text-secondary border border-border-subtle uppercase tracking-wider font-semibold">
                  {selectedSendModel.providerName}
                </span>
              ) : null}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5 text-text-secondary flex-shrink-0">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {openPopover === "settings" ? (
              <ComposerPopover placement="top-start">
                <ComposerSettingsMenu
                  onSettingChange={handleSettingChange}
                  settings={settings}
                />
              </ComposerPopover>
            ) : null}
            {openPopover === "models" && normalizedModels.length > 0 ? (
              <ComposerPopover placement="top-start">
                <ComposerModelMenu
                  models={normalizedModels}
                  onSelectModel={(modelId) => {
                    setSelectedModelId(modelId);
                    setOpenPopover(null);
                  }}
                  selectedModelId={selectedSendModel?.id ?? selectedModel?.id ?? null}
                />
              </ComposerPopover>
            ) : null}
          </div>
          
          <button
            className="send-btn"
            disabled={isButtonDisabled}
            onClick={handleSubmit}
            type="button"
            title="Send message"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
      <div className="composer-hint">AI can make mistakes. Verify important information.</div>
    </div>
  );
}
