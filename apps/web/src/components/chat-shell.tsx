"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createConversation,
  getConversationMessages,
  getSession,
  listConversations,
  sendMessage,
} from "../lib/api";
import type {
  ConversationListItem,
  ConversationMessagesResponse,
  SessionResponse,
} from "../lib/types";
import { ConversationSidebar } from "./conversation-sidebar";
import { MessageComposer } from "./message-composer";
import { MessageThread } from "./message-thread";

export function ChatShell() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] =
    useState<ConversationMessagesResponse["conversation"] | null>(null);
  const [messages, setMessages] = useState<ConversationMessagesResponse["messages"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [capacityBlocked, setCapacityBlocked] = useState(false);
  const [providerSwitchNote, setProviderSwitchNote] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, startSending] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const sessionResponse = await getSession();
        const conversationsResponse = await listConversations();

        if (cancelled) {
          return;
        }

        setSession(sessionResponse);
        setConversations(conversationsResponse.conversations);

        const firstConversation = conversationsResponse.conversations[0];
        if (firstConversation) {
          await selectConversation(firstConversation.id, cancelled);
        }
      } catch (bootError) {
        if (!cancelled) {
          setError(
            bootError instanceof Error ? bootError.message : "Failed to load chat workspace.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsBooting(false);
        }
      }
    }

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  async function selectConversation(conversationId: string, cancelled = false) {
    setError(null);
    setIsLoadingMessages(true);

    try {
      const response = await getConversationMessages(conversationId);

      if (cancelled) {
        return;
      }

      setActiveConversationId(conversationId);
      setActiveConversation(response.conversation);
      setMessages(response.messages);
      setCapacityBlocked(false);
      setProviderSwitchNote(null);
    } catch (selectionError) {
      if (!cancelled) {
        setError(
          selectionError instanceof Error
            ? selectionError.message
            : "Failed to load conversation.",
        );
      }
    } finally {
      if (!cancelled) {
        setIsLoadingMessages(false);
      }
    }
  }

  async function handleCreateConversation() {
    setError(null);

    try {
      const response = await createConversation({
        mode: "chat",
        title: "New Conversation",
      });

      setConversations((current) => [response.conversation, ...current]);
      setActiveConversationId(response.conversation.id);
      setActiveConversation({
        id: response.conversation.id,
        mode: "chat",
        title: response.conversation.title,
      });
      setMessages([]);
      setCapacityBlocked(false);
      setProviderSwitchNote(null);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create conversation.",
      );
    }
  }

  async function ensureConversation() {
    if (activeConversationId) {
      return activeConversationId;
    }

    const response = await createConversation({
      mode: "chat",
      title: "New Conversation",
    });

    setConversations((current) => [response.conversation, ...current]);
    setActiveConversationId(response.conversation.id);
    setActiveConversation({
      id: response.conversation.id,
      mode: "chat",
      title: response.conversation.title,
    });

    return response.conversation.id;
  }

  async function handleSend(text: string) {
    startSending(async () => {
      try {
        setError(null);
        setCapacityBlocked(false);
        setProviderSwitchNote(null);

        const conversationId = await ensureConversation();
        const optimisticId = `local-${Date.now()}`;

        setMessages((current) => [
          ...current,
          {
            id: optimisticId,
            role: "user",
            content: [{ type: "text", text }],
            createdAt: new Date().toISOString(),
          },
        ]);

        const response = await sendMessage(conversationId, {
          content: [{ type: "text", text }],
        });
        const assistantMessage = response.assistantMessage;

        if (assistantMessage) {
          setMessages((current) => {
            const withoutOptimistic = current.filter((item) => item.id !== optimisticId);

            return [
              ...withoutOptimistic,
              {
                id: response.userMessage.id,
                role: "user",
                content: [{ type: "text", text }],
                createdAt: new Date().toISOString(),
              },
              assistantMessage,
            ];
          });
        } else {
          setMessages((current) =>
            current.map((item) =>
              item.id === optimisticId ? { ...item, id: response.userMessage.id } : item,
            ),
          );
        }

        if (response.providerSwitched?.switched) {
          setProviderSwitchNote("Response continued after switching models.");
        }

        if (response.capacityBlocked) {
          setCapacityBlocked(true);
        }

        const updatedConversations = await listConversations();
        setConversations(updatedConversations.conversations);
      } catch (sendError) {
        setError(
          sendError instanceof Error ? sendError.message : "Failed to send message.",
        );
      }
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.18),_transparent_30%),linear-gradient(180deg,_rgba(15,17,23,1)_0%,_rgba(9,10,15,1)_100%)]">
      <header className="border-b border-white/10 bg-surface/80 px-4 py-4 backdrop-blur md:px-6">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-text-muted">
              Loom Workspace
            </p>
            <h1 className="text-xl font-semibold text-text-primary">
              Single-user chat core
            </h1>
          </div>
          <p className="text-sm text-text-secondary">
            {session?.user.displayName ?? "Loading session..."}
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <ConversationSidebar
          activeConversationId={activeConversationId}
          conversations={conversations}
          isLoading={isBooting}
          onCreateConversation={handleCreateConversation}
          onSelectConversation={(conversationId) => {
            void selectConversation(conversationId);
          }}
        />

        <section className="flex min-h-[70vh] flex-1 flex-col">
          <div className="border-b border-white/10 px-4 py-4 md:px-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                  Active thread
                </p>
                <h2 className="text-lg font-semibold text-text-primary">
                  {activeConversation?.title ?? "New Conversation"}
                </h2>
              </div>
              <p className="text-sm text-text-secondary">
                {isSending ? "Sending..." : "Ready"}
              </p>
            </div>

            {providerSwitchNote ? (
              <div className="mt-4 rounded-xl border border-state-degraded/30 bg-state-degraded/10 px-4 py-3 text-sm text-state-degraded">
                {providerSwitchNote}
              </div>
            ) : null}

            {capacityBlocked ? (
              <div className="mt-4 rounded-xl border border-state-blocked/30 bg-state-blocked/10 px-4 py-3 text-sm text-state-blocked">
                All currently configured free models are unavailable.
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-xl border border-state-blocked/30 bg-state-blocked/10 px-4 py-3 text-sm text-state-blocked">
                {error}
              </div>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
            <MessageThread isLoading={isLoadingMessages || isBooting} messages={messages} />
          </div>

          <MessageComposer disabled={isSending || isBooting} onSend={handleSend} />
        </section>
      </div>
    </div>
  );
}
