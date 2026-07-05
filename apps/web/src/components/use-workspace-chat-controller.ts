"use client";

import { useMemo, useRef, useState, type RefObject } from "react";
import {
  createConversation,
  getConversationMessages,
  listConversations,
  sendMessage,
} from "../lib/api";
import type { ConversationListItem, ConversationMessagesResponse } from "../lib/types";
import {
  applySendResponse,
  buildUserTextMessage,
  removeMessageById,
} from "./workspace-chat-helpers";

interface UseWorkspaceChatControllerOptions {
  isMountedRef: RefObject<boolean>;
  onRefreshWorkspaceData: () => Promise<void>;
  pinnedConversationIds: string[];
}

export function useWorkspaceChatController({
  isMountedRef,
  onRefreshWorkspaceData,
  pinnedConversationIds,
}: UseWorkspaceChatControllerOptions) {
  const conversationRequestOrderRef = useRef(0);
  const requestedConversationIdRef = useRef<string | null>(null);
  const sendLockRef = useRef(false);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [conversationSearch, setConversationSearch] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] =
    useState<ConversationMessagesResponse["conversation"] | null>(null);
  const [messages, setMessages] = useState<ConversationMessagesResponse["messages"]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [capacityBlocked, setCapacityBlocked] = useState(false);
  const [providerSwitchNote, setProviderSwitchNote] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const filteredConversations = useMemo(() => {
    const term = conversationSearch.trim().toLowerCase();
    const visible = term
      ? conversations.filter((item) => item.title.toLowerCase().includes(term))
      : conversations;

    return [...visible].sort((left, right) => {
      const leftPinned = pinnedConversationIds.includes(left.id);
      const rightPinned = pinnedConversationIds.includes(right.id);

      if (leftPinned !== rightPinned) {
        return leftPinned ? -1 : 1;
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });
  }, [conversationSearch, conversations, pinnedConversationIds]);

  function hydrateConversations(nextConversations: ConversationListItem[]) {
    setConversations(nextConversations);
  }

  function setRequestedConversationId(conversationId: string | null) {
    requestedConversationIdRef.current = conversationId;
    setActiveConversationId(conversationId);
  }

  function resetConversationDraftState() {
    setMessages([]);
    setDraftMessage("");
    setCapacityBlocked(false);
    setProviderSwitchNote(null);
  }

  function activateConversation(conversation: ConversationListItem) {
    setConversations((current) => [
      conversation,
      ...current.filter((item) => item.id !== conversation.id),
    ]);
    setRequestedConversationId(conversation.id);
    setActiveConversation({
      id: conversation.id,
      mode: "chat",
      title: conversation.title,
    });
    resetConversationDraftState();
  }

  async function createConversationRecord() {
    setChatError(null);

    try {
      const response = await createConversation({
        mode: "chat",
        title: "New Conversation",
      });

      if (!isMountedRef.current) {
        return null;
      }

      activateConversation(response.conversation);
      return response.conversation.id;
    } catch (error) {
      if (isMountedRef.current) {
        setChatError(
          error instanceof Error ? error.message : "Failed to create conversation.",
        );
      }

      return null;
    }
  }

  async function selectConversation(conversationId: string) {
    const requestOrder = ++conversationRequestOrderRef.current;
    requestedConversationIdRef.current = conversationId;

    setChatError(null);
    setIsLoadingMessages(true);

    try {
      const response = await getConversationMessages(conversationId);

      if (
        !isMountedRef.current ||
        requestOrder !== conversationRequestOrderRef.current
      ) {
        return false;
      }

      setRequestedConversationId(conversationId);
      setActiveConversation(response.conversation);
      setMessages(response.messages);
      setDraftMessage("");
      setCapacityBlocked(false);
      setProviderSwitchNote(null);
      return true;
    } catch (error) {
      if (
        isMountedRef.current &&
        requestOrder === conversationRequestOrderRef.current
      ) {
        setChatError(
          error instanceof Error ? error.message : "Failed to load conversation.",
        );
      }

      return false;
    } finally {
      if (
        isMountedRef.current &&
        requestOrder === conversationRequestOrderRef.current
      ) {
        setIsLoadingMessages(false);
      }
    }
  }

  async function createChatConversation() {
    const conversationId = await createConversationRecord();
    return conversationId !== null;
  }

  async function ensureConversation() {
    if (activeConversationId) {
      return activeConversationId;
    }

    return createConversationRecord();
  }

  async function send(text: string) {
    if (sendLockRef.current) {
      return;
    }

    sendLockRef.current = true;
    let optimisticId: string | null = null;
    let sendingConversationId: string | null = null;

    try {
      setIsSending(true);
      setChatError(null);
      setCapacityBlocked(false);
      setProviderSwitchNote(null);

      sendingConversationId = await ensureConversation();
      if (!sendingConversationId || !isMountedRef.current) {
        return;
      }

      const createdAt = new Date().toISOString();
      const nextOptimisticId = `local-${Date.now()}`;
      optimisticId = nextOptimisticId;

      if (requestedConversationIdRef.current === sendingConversationId) {
        setMessages((current) => [
          ...current,
          buildUserTextMessage({
            createdAt,
            id: nextOptimisticId,
            text,
          }),
        ]);
      }

      const response = await sendMessage(sendingConversationId, {
        content: [{ type: "text", text }],
      });

      if (!isMountedRef.current) {
        return;
      }

      if (requestedConversationIdRef.current === sendingConversationId) {
        const assistantId = response.assistantMessage?.id ?? `local-assistant-${Date.now()}`;
        const fullText = response.assistantMessage?.content[0]?.text ?? "";

        setMessages((current) => [
          ...current.filter((m) => m.id !== nextOptimisticId),
          {
            id: response.userMessage.id,
            role: "user",
            content: [{ type: "text", text }],
            createdAt,
          },
          {
            id: assistantId,
            role: "assistant",
            content: [{ type: "text", text: "" }],
            createdAt: new Date().toISOString(),
            providerId: response.assistantMessage?.providerId,
            modelId: response.assistantMessage?.modelId,
          }
        ]);
        setDraftMessage("");

        if (response.providerSwitched?.switched) {
          setProviderSwitchNote("Response continued after switching models.");
        }

        if (response.capacityBlocked) {
          setCapacityBlocked(true);
        }

        let currentText = "";
        const words = fullText.split(/(\s+)/);
        let wordIndex = 0;

        const streamInterval = setInterval(() => {
          if (!isMountedRef.current || wordIndex >= words.length) {
            clearInterval(streamInterval);
            setMessages((current) =>
              current.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, content: [{ type: "text", text: fullText }] }
                  : msg
              )
            );
            return;
          }

          currentText += words[wordIndex];
          wordIndex++;

          setMessages((current) =>
            current.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: [{ type: "text", text: currentText }] }
                : msg
            )
          );
        }, 15);
      }

      try {
        const conversationsResponse = await listConversations();
        if (!isMountedRef.current) {
          return;
        }

        setConversations(conversationsResponse.conversations);
        await onRefreshWorkspaceData();
      } catch (error) {
        if (isMountedRef.current) {
          setChatError(
            error instanceof Error
              ? error.message
              : "Failed to refresh workspace data.",
          );
        }
      }
    } catch (error) {
      if (isMountedRef.current) {
        if (
          optimisticId &&
          sendingConversationId &&
          requestedConversationIdRef.current === sendingConversationId
        ) {
          const failedOptimisticId = optimisticId;
          setMessages((current) => removeMessageById(current, failedOptimisticId));
        }

        setChatError(
          error instanceof Error ? error.message : "Failed to send message.",
        );
      }
    } finally {
      sendLockRef.current = false;

      if (isMountedRef.current) {
        setIsSending(false);
      }
    }
  }

  return {
    activeConversation,
    activeConversationId,
    capacityBlocked,
    chatError,
    conversationSearch,
    conversations,
    createChatConversation,
    draftMessage,
    filteredConversations,
    hydrateConversations,
    isLoadingMessages,
    isSending,
    messages,
    providerSwitchNote,
    selectConversation,
    send,
    setConversationSearch,
    setDraftMessage,
  };
}
