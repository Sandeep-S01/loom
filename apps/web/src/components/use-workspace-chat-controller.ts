"use client";

import { useMemo, useRef, useState, type RefObject } from "react";
import {
  createConversation,
  deleteConversation,
  getConversationMessages,
  listConversations,
  renameConversation,
  sendMessage,
} from "../lib/api";
import { setConversationIdInLocation } from "../lib/conversation-links";
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
  const pendingSubmissionRef = useRef<{
    fingerprint: string;
    idempotencyKey: string;
  } | null>(null);
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
  const [pendingModelId, setPendingModelId] = useState<string | null>(null);

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
    setConversationIdInLocation(conversationId);
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

  function clearActiveConversationState() {
    setRequestedConversationId(null);
    setActiveConversation(null);
    resetConversationDraftState();
  }

  async function renameConversationRecord(conversationId: string, title: string) {
    setChatError(null);

    try {
      const response = await renameConversation(conversationId, title);

      if (!isMountedRef.current) {
        return;
      }

      setConversations((current) =>
        current.map((item) =>
          item.id === conversationId ? response.conversation : item,
        ),
      );

      if (activeConversationId === conversationId) {
        setActiveConversation((current) =>
          current
            ? {
                ...current,
                title: response.conversation.title,
              }
            : current,
        );
      }

      await onRefreshWorkspaceData();
    } catch (error) {
      if (isMountedRef.current) {
        setChatError(
          error instanceof Error ? error.message : "Failed to rename conversation.",
        );
      }

      throw error;
    }
  }

  async function deleteConversationRecord(conversationId: string) {
    setChatError(null);

    try {
      await deleteConversation(conversationId);

      if (!isMountedRef.current) {
        return;
      }

      const nextConversations = conversations.filter((item) => item.id !== conversationId);
      setConversations(nextConversations);

      if (activeConversationId === conversationId) {
        const nextConversationId = nextConversations[0]?.id ?? null;

        if (nextConversationId) {
          clearActiveConversationState();
          await selectConversation(nextConversationId);
        } else {
          clearActiveConversationState();
        }
      }

      await onRefreshWorkspaceData();
    } catch (error) {
      if (isMountedRef.current) {
        setChatError(
          error instanceof Error ? error.message : "Failed to delete conversation.",
        );
      }

      throw error;
    }
  }

  async function ensureConversation() {
    if (activeConversationId) {
      return activeConversationId;
    }

    return createConversationRecord();
  }

  async function send(input: {
    text: string;
    modelId: string | null;
    images?: Extract<ConversationMessagesResponse["messages"][number]["content"][number], { type: "image" }>[];
  }) {
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
      setPendingModelId(input.modelId);

      sendingConversationId = await ensureConversation();
      if (!sendingConversationId || !isMountedRef.current) {
        return;
      }

      const { text, modelId, images = [] } = input;
      const content: ConversationMessagesResponse["messages"][number]["content"] = [
        ...(text ? [{ type: "text" as const, text }] : []),
        ...images,
      ];
      const createdAt = new Date().toISOString();
      const nextOptimisticId = `local-${Date.now()}`;
      optimisticId = nextOptimisticId;
      const submissionFingerprint = JSON.stringify({
        conversationId: sendingConversationId,
        modelId,
        text,
        images: images.map((image) => ({
          filename: image.filename,
          mimeType: image.mimeType,
          size: image.size,
        })),
      });
      const idempotencyKey =
        pendingSubmissionRef.current?.fingerprint === submissionFingerprint
          ? pendingSubmissionRef.current.idempotencyKey
          : crypto.randomUUID();
      pendingSubmissionRef.current = {
        fingerprint: submissionFingerprint,
        idempotencyKey,
      };

      if (requestedConversationIdRef.current === sendingConversationId) {
        setMessages((current) => [
          ...current,
          buildUserTextMessage({
            content,
            createdAt,
            id: nextOptimisticId,
            text,
          }),
        ]);
      }
      setDraftMessage("");

      const response = await sendMessage(sendingConversationId, {
        content,
        idempotencyKey,
        modelId: modelId ?? undefined,
      });
      pendingSubmissionRef.current = null;

      if (!isMountedRef.current) {
        return;
      }

      if (requestedConversationIdRef.current === sendingConversationId) {
        if (!response.assistantMessage) {
          setMessages((current) => [
            ...current.filter((m) => m.id !== nextOptimisticId),
            {
              id: response.userMessage.id,
              role: "user",
              content,
              createdAt,
            },
          ]);

          if (response.capacityBlocked) {
            setCapacityBlocked(true);
          }

          setChatError(
            response.error?.message ?? "No model was able to respond to this message.",
          );

          try {
            const conversationsResponse = await listConversations();
            if (isMountedRef.current) {
              setConversations(conversationsResponse.conversations);
              await onRefreshWorkspaceData();
            }
          } catch {
            // Keep the clearer model error visible; the next focus refresh will resync recents.
          }

          return;
        }

        const assistantId = response.assistantMessage?.id ?? `local-assistant-${Date.now()}`;
        const fullText =
          response.assistantMessage?.content
            .filter((item) => item.type === "text")
            .map((item) => item.text)
            .join("\n") ?? "";

        setMessages((current) => [
          ...current.filter((m) => m.id !== nextOptimisticId),
          {
            id: response.userMessage.id,
            role: "user",
            content,
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
          setProviderSwitchNote(
            `Selected model unavailable. Response switched from ${response.providerSwitched.fromModelName} to ${response.providerSwitched.toModelName}.`,
          );
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
        setDraftMessage(input.text);
      }
    } finally {
      sendLockRef.current = false;

      if (isMountedRef.current) {
        setIsSending(false);
        setPendingModelId(null);
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
    deleteConversationRecord,
    draftMessage,
    filteredConversations,
    hydrateConversations,
    isLoadingMessages,
    isSending,
    messages,
    pendingModelId,
    providerSwitchNote,
    renameConversationRecord,
    selectConversation,
    send,
    setConversationSearch,
    setDraftMessage,
  };
}
