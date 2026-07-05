"use client";

import React, { useState, useRef, useEffect } from "react";

interface MessageComposerProps {
  disabled?: boolean;
  draftValue?: string;
  onDraftChange?: (value: string) => void;
  onSend: (text: string) => void | Promise<void>;
}

export function MessageComposer({
  disabled = false,
  draftValue,
  onDraftChange,
  onSend,
}: MessageComposerProps) {
  const [internalValue, setInternalValue] = useState("");
  const value = draftValue ?? internalValue;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  async function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) {
      return;
    }

    await onSend(trimmed);
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const isButtonDisabled = disabled || value.trim().length === 0;

  return (
    <div className="composer-wrap">
      <div className="composer">
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
        <div className="composer-toolbar">
          <div className="composer-tools">
            <button className="tool-btn" title="Attach file" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <button className="tool-btn" title="Tools" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
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
