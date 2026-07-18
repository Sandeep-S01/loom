"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AvailableModelItem,
  ConversationMessagesResponse,
  ProvidersResponse,
} from "../lib/types";
import { getSafeMessageRolePresentation } from "./message-thread-content";

interface MessageThreadProps {
  messages: ConversationMessagesResponse["messages"];
  isLoading: boolean;
  isSending?: boolean;
  availableModels?: AvailableModelItem[];
  onRegenerate?: (input: { text: string; modelId: string | null }) => Promise<void> | void;
  pendingModelId?: string | null;
  providersStatus?: ProvidersResponse | null;
}

function MarkdownText({ text }: { text: string }) {
  // Split code blocks (marked by triple backticks) from text
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="msg-text">
      {parts.map((part, index) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          // Extract content between backticks and check for language tag
          const content = part.slice(3, -3);
          const firstNewLine = content.indexOf("\n");
          let language = "text";
          let code = content.trim();

          if (firstNewLine !== -1) {
            const possibleLang = content.slice(0, firstNewLine).trim();
            if (/^[a-zA-Z0-9_-]+$/.test(possibleLang)) {
              language = possibleLang;
              code = content.slice(firstNewLine).trim();
            }
          }

          return (
            <pre key={index}>
              <code className={language ? `language-${language}` : ""}>{code}</code>
            </pre>
          );
        }

        // Inline code markdown check (marked by backticks)
        const subparts = part.split(/(`[^`\n]+`)/g);
        
        return (
          <p key={index}>
            {subparts.map((subpart, subIndex) => {
              if (subpart.startsWith("`") && subpart.endsWith("`")) {
                return <code key={subIndex}>{subpart.slice(1, -1)}</code>;
              }
              return subpart;
            })}
          </p>
        );
      })}
    </div>
  );
}

export function MessageThread({
  messages,
  isLoading,
  isSending = false,
  availableModels = [],
  onRegenerate,
  pendingModelId = null,
  providersStatus = null,
}: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackById, setFeedbackById] = useState<Record<string, "good" | undefined>>({});
  const [activeModelDropdownMessageId, setActiveModelDropdownMessageId] = useState<string | null>(null);
  const isFirstLoadRef = useRef(true);
  const shouldAutoScrollRef = useRef(true);
  const modelDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activeModelDropdownMessageId) return;

    function handlePointerDown(event: MouseEvent) {
      if (!modelDropdownRef.current?.contains(event.target as Node)) {
        setActiveModelDropdownMessageId(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [activeModelDropdownMessageId]);
  const modelNameById = new Map<string, string>();

  for (const model of availableModels) {
    modelNameById.set(model.id, model.name);
  }

  for (const provider of providersStatus?.providers ?? []) {
    for (const model of provider.models) {
      modelNameById.set(model.id, model.name);
    }
  }
  const thinkingModelName =
    (pendingModelId ? modelNameById.get(pendingModelId) : null) ??
    availableModels[0]?.name ??
    "Loom";

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      shouldAutoScrollRef.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };

    handleScroll();
    el.addEventListener("scroll", handleScroll);

    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Follow only on first load or when the user is already near the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (isFirstLoadRef.current || shouldAutoScrollRef.current) {
      el.scrollTop = el.scrollHeight;
    }

    if (messages.length > 0) {
      isFirstLoadRef.current = false;
    }
  }, [messages, isSending]);

  const handleCopy = (text: string, messageId: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  function findPreviousUserPrompt(assistantMessageId: string) {
    const assistantIndex = messages.findIndex((message) => message.id === assistantMessageId);
    if (assistantIndex <= 0) {
      return null;
    }

    for (let index = assistantIndex - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.role === "user") {
        const text = message.content
          ?.filter((item) => item.type === "text")
          .map((item) => item.text)
          .join("\n")
          .trim();
        return text || null;
      }
    }

    return null;
  }

  return (
    <div className="chat-scroll" ref={scrollRef}>
      <div className="msg-column" role="log" aria-busy={isLoading}>
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-xs text-text-secondary py-12">
            <svg className="animate-spin h-4 w-4 text-text-secondary mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading messages...
          </div>
        ) : null}

        {!isLoading && messages.length === 0 ? (
          <div className="text-center py-20 text-xs text-text-muted select-none">
            No messages in this conversation.
          </div>
        ) : null}

        {!isLoading && messages.map((message) => {
          const isUser = message.role === "user";
          const isAssistant = message.role === "assistant";
          const presentation = getSafeMessageRolePresentation(message.role);
          const textParts = message.content?.filter((item) => item.type === "text") ?? [];
          const imageParts = message.content?.filter((item) => item.type === "image") ?? [];
          const fullText = textParts.map((item) => item.text).join("\n");

          // Render system logs or tool pings in terminal-styled codeblocks
          if (!isUser && !isAssistant) {
            const isTool = message.role === "tool";
            const textLower = fullText.toLowerCase();
            const isFailover = textLower.includes("failover") || textLower.includes("failed over");

            if (isFailover) {
              return (
                <div key={message.id} className="py-3 flex items-center gap-3 w-full max-w-[720px] mx-auto select-none" role="status" aria-live="polite">
                  <div className="flex-grow border-t border-[color:var(--color-status-failover)]/20" />
                  <div className="flex items-center gap-2.5 rounded-md border border-[color:var(--color-status-failover)]/30 bg-[color:var(--color-status-failover)]/5 px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[color:var(--color-status-failover)]">
                    <span className="w-1.5 h-1.5 bg-[color:var(--color-status-failover)] rounded-full pulse-dot"></span>
                    STATUS: FAILOVER_RECOVER // {fullText}
                  </div>
                  <div className="flex-grow border-t border-[color:var(--color-status-failover)]/20" />
                </div>
              );
            }

            return (
              <div key={message.id} className="py-2.5 flex gap-3 w-full items-start max-w-[720px] mx-auto">
                <div className="h-6.5 w-6.5 rounded border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)] text-[9px] font-mono font-bold text-text-muted flex items-center justify-center shrink-0 select-none">
                  {isTool ? "T" : "S"}
                </div>
                <div className="flex-1 min-w-0 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)] px-3.5 py-2.5 text-[11px] font-mono text-text-secondary leading-relaxed">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted mr-2 block mb-1">
                    {presentation.label}
                  </span>
                  <p className="whitespace-pre-wrap">{fullText}</p>
                </div>
              </div>
            );
          }

          // User Message: Right-aligned bubble
          if (isUser) {
            return (
              <div key={message.id} className="msg-row user" role="article" aria-label="User message">
                <div className="msg-body">
                  {imageParts.length > 0 ? (
                    <div className="msg-image-grid" aria-label="Attached images">
                      {imageParts.map((image) => (
                        <figure key={`${message.id}-${image.filename}`} className="msg-image-frame">
                          {/* Message images are data URLs returned by the chat API. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt={image.filename}
                            src={`data:${image.mimeType};base64,${image.data}`}
                          />
                          <figcaption>{image.filename}</figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : null}
                  {fullText ? <div className="msg-text">{fullText}</div> : null}
                </div>
              </div>
            );
          }

          // Assistant Message: Left-aligned avatar row without bubble
          return (
            <div key={message.id} className="msg-row assistant group" role="article" aria-label="Assistant message">
              <div className="msg-avatar msg-avatar-assistant select-none">
                <span className="assistant-orb" aria-hidden="true" />
              </div>
              <div className="msg-body">
                <MarkdownText text={fullText} />
                {message.modelId ? (
                  <div className="mt-3 select-none flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-text-secondary">
                    <span className="w-1.5 h-1.5 bg-[color:var(--color-accent)] rounded-full"></span>
                    Answered by {modelNameById.get(message.modelId) ?? message.modelId}
                  </div>
                ) : null}
                
                {/* Actions row under assistant message */}
                <div className="msg-actions">
                  <button
                    className="msg-action-btn"
                    title={copiedId === message.id ? "Copied!" : "Copy response"}
                    onClick={() => handleCopy(fullText, message.id)}
                    type="button"
                  >
                    {copiedId === message.id ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-state-healthy">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </button>
                  <button
                    aria-pressed={feedbackById[message.id] === "good"}
                    className={[
                      "msg-action-btn",
                      feedbackById[message.id] === "good" ? "msg-action-btn-active" : "",
                    ].join(" ")}
                    title={feedbackById[message.id] === "good" ? "Marked as helpful" : "Good response"}
                    onClick={() =>
                      setFeedbackById((current) => {
                        const next = { ...current };
                        if (next[message.id] === "good") {
                          delete next[message.id];
                        } else {
                          next[message.id] = "good";
                        }
                        return next;
                      })
                    }
                    type="button"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                    </svg>
                  </button>
                  <button
                    className="msg-action-btn"
                    disabled={isSending || !onRegenerate}
                    title="Regenerate response"
                    onClick={() => {
                      const text = findPreviousUserPrompt(message.id);
                      if (!text || !onRegenerate) {
                        return;
                      }

                      void onRegenerate({
                        text,
                        modelId: message.modelId ?? null,
                      });
                    }}
                    type="button"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M1 4v6h6" />
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                  </button>
                  <div className="relative">
                    <button
                      className="msg-action-btn"
                      disabled={isSending || !onRegenerate}
                      title="Switch model and regenerate"
                      onClick={() => {
                        setActiveModelDropdownMessageId((id) => (id === message.id ? null : message.id));
                      }}
                      type="button"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                        <line x1="6" y1="3" x2="6" y2="15" />
                        <circle cx="18" cy="6" r="3" />
                        <circle cx="6" cy="18" r="3" />
                        <path d="M18 9a9 9 0 0 1-9 9" />
                      </svg>
                    </button>
                    
                    {activeModelDropdownMessageId === message.id && (
                      <div 
                        ref={modelDropdownRef}
                        className="absolute left-0 bottom-full z-[100] mb-2 max-h-56 w-48 overflow-y-auto rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel)] py-1.5"
                        role="menu"
                      >
                        <div className="px-2.5 py-1 text-[9px] uppercase tracking-widest text-text-secondary font-mono font-bold border-b border-[color:var(--color-border-subtle)]/50 mb-1 select-none">
                          Route Alternative
                        </div>
                        {availableModels.map((model) => (
                          <button
                            key={model.id}
                            className="flex w-full items-center justify-between px-3 py-1.5 text-left font-mono text-[10px] text-text-secondary hover:bg-[color:var(--color-bg-hover)] hover:text-text-primary transition-colors"
                            onClick={() => {
                              const text = findPreviousUserPrompt(message.id);
                              if (text && onRegenerate) {
                                void onRegenerate({
                                  text,
                                  modelId: model.id,
                                });
                              }
                              setActiveModelDropdownMessageId(null);
                            }}
                            role="menuitem"
                          >
                            <span>{model.name}</span>
                            {model.id === message.modelId && (
                              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing dot animation block */}
        {isSending && (
          <div className="msg-row assistant thinking-row" id="typingRow">
            <div className="msg-avatar msg-avatar-assistant thinking-avatar select-none">
              <span className="assistant-orb" aria-hidden="true" />
            </div>
            <div className="msg-body">
              <div className="thinking-inline" aria-live="polite">
                <span className="thinking-text">
                  <span className="thinking-model">{thinkingModelName}</span>
                  <span> is thinking</span>
                </span>
                <span className="typing-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
