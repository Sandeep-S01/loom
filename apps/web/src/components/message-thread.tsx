"use client";

import { useEffect, useRef, useState } from "react";
import type { ConversationMessagesResponse } from "../lib/types";
import { getSafeMessageRolePresentation } from "./message-thread-content";

interface MessageThreadProps {
  messages: ConversationMessagesResponse["messages"];
  isLoading: boolean;
  isSending?: boolean;
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

export function MessageThread({ messages, isLoading, isSending = false }: { messages: any[]; isLoading: boolean; isSending?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const isFirstLoadRef = useRef(true);
  const shouldAutoScrollRef = useRef(true);

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
          const fullText = message.content?.[0]?.text ?? "";

          // Render system logs or tool pings in terminal-styled codeblocks
          if (!isUser && !isAssistant) {
            const isTool = message.role === "tool";
            return (
              <div key={message.id} className="py-2.5 flex gap-3 w-full items-start max-w-[720px] mx-auto">
                <div className="h-6.5 w-6.5 rounded bg-white/5 text-[9px] font-mono font-bold text-text-muted flex items-center justify-center shrink-0 border border-white/5 select-none">
                  {isTool ? "T" : "S"}
                </div>
                <div className="flex-1 min-w-0 rounded-lg border border-white/5 bg-[#0d1015]/40 px-3.5 py-2.5 text-[11px] font-mono text-text-secondary leading-relaxed">
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
                  <div className="msg-text">{fullText}</div>
                </div>
              </div>
            );
          }

          // Assistant Message: Left-aligned avatar row without bubble
          return (
            <div key={message.id} className="msg-row assistant group" role="article" aria-label="Assistant message">
              <div className="msg-avatar select-none">A</div>
              <div className="msg-body">
                <MarkdownText text={fullText} />
                
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
                    className="msg-action-btn"
                    title="Good response"
                    onClick={() => alert("Thank you for the feedback!")}
                    type="button"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                    </svg>
                  </button>
                  <button
                    className="msg-action-btn"
                    title="Regenerate"
                    onClick={() => alert("Regeneration is handled by sending a new prompt in the thread.")}
                    type="button"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M1 4v6h6" />
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing dot animation block */}
        {isSending && (
          <div className="msg-row assistant" id="typingRow">
            <div className="msg-avatar select-none">A</div>
            <div className="msg-body">
              <div className="typing-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
