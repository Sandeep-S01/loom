import type { FastifyInstance } from "fastify";
import { badRequest, conflict, notFound } from "../../lib/http-errors.js";
import type { ConversationRepository } from "../conversations/repository.js";
import type { ChatService } from "./service.js";
import type { ChatContextBlockRequest } from "@clm/shared-types";

interface RegisterChatRoutesOptions {
  conversationRepository: ConversationRepository;
  chatService: ChatService;
}

export async function registerChatRoutes(
  app: FastifyInstance,
  options: RegisterChatRoutesOptions,
) {
  app.get("/:conversationId/messages", async (request) => {
    if (!request.sessionUser) {
      throw new Error("Session user is not available");
    }

    const params = request.params as { conversationId: string };
    const conversation = await options.conversationRepository.findForUser(
      request.sessionUser.id,
      params.conversationId,
    );

    if (!conversation) {
      throw notFound("Conversation not found");
    }

    const messageItems = await options.conversationRepository.listMessages(
      params.conversationId,
    );

    return {
      conversation: {
        id: conversation.id,
        mode: conversation.mode,
        title: conversation.title,
      },
      messages: messageItems.map((item) => ({
        id: item.id,
        role: item.role,
        content: item.content,
        providerId: item.providerId,
        modelId: item.modelId,
        createdAt: item.createdAt,
      })),
    };
  });

  app.post("/:conversationId/messages", async (request) => {
    if (!request.sessionUser) {
      throw new Error("Session user is not available");
    }

    const params = request.params as { conversationId: string };
    const conversation = await options.conversationRepository.findForUser(
      request.sessionUser.id,
      params.conversationId,
    );

    if (!conversation) {
      throw notFound("Conversation not found");
    }

    if (conversation.mode !== "chat") {
      throw conflict("Conversation is not a chat thread");
    }

    const body = request.body as {
      content?: Array<Record<string, unknown>>;
      modelId?: string;
      idempotencyKey?: string;
      workspaceId?: string;
      contextBlocks?: Array<Record<string, unknown>>;
    };

    if (!Array.isArray(body?.content) || body.content.length === 0) {
      throw badRequest("Message content is required");
    }

    for (const item of body.content) {
      if (item.type === "text") {
        if (typeof item.text !== "string" || item.text.trim() === "") {
          throw badRequest("Only non-empty text message content is supported");
        }
        continue;
      }

      if (item.type === "image") {
        if (
          typeof item.data !== "string" ||
          typeof item.filename !== "string" ||
          typeof item.mimeType !== "string" ||
          typeof item.size !== "number"
        ) {
          throw badRequest("Image message content is invalid");
        }
        continue;
      }

      throw badRequest("Only text and image message content is supported");
    }

    if (body.modelId !== undefined && typeof body.modelId !== "string") {
      throw badRequest("Selected model must be a string.");
    }

    if (
      body.idempotencyKey !== undefined &&
      (typeof body.idempotencyKey !== "string" ||
        body.idempotencyKey.trim().length > 120)
    ) {
      throw badRequest("Idempotency key must be a string up to 120 characters.");
    }

    if (body.workspaceId !== undefined && typeof body.workspaceId !== "string") {
      throw badRequest("Workspace id must be a string.");
    }

    if (
      body.contextBlocks !== undefined &&
      !Array.isArray(body.contextBlocks)
    ) {
      throw badRequest("Context blocks must be an array.");
    }

    return options.chatService.sendMessage({
      userId: request.sessionUser.id,
      conversationId: params.conversationId,
      mode: conversation.mode as "chat" | "agent",
      selectedModelId: body.modelId?.trim() || undefined,
      idempotencyKey: body.idempotencyKey?.trim() || undefined,
      workspaceId: body.workspaceId?.trim() || undefined,
      contextBlocks: parseContextBlocks(body.contextBlocks ?? []),
      content: body.content.map((item) =>
        item.type === "text"
          ? {
              type: "text" as const,
              text: (item.text as string).trim(),
            }
          : {
              type: "image" as const,
              data: item.data as string,
              filename: item.filename as string,
              mimeType: item.mimeType as "image/png" | "image/jpeg" | "image/webp",
              size: item.size as number,
            },
      ),
    });
  });
}

function parseContextBlocks(
  blocks: Array<Record<string, unknown>>,
): ChatContextBlockRequest[] {
  return blocks.map((block) => {
    if (
      ![
        "workspace_file",
        "selected_file",
        "companion",
        "attachment",
        "summary",
        "manual",
      ].includes(String(block.sourceType)) ||
      typeof block.content !== "string"
    ) {
      throw badRequest("Context block is invalid.");
    }

    return {
      sourceType: block.sourceType as ChatContextBlockRequest["sourceType"],
      content: block.content,
      path: typeof block.path === "string" ? block.path : undefined,
      language: typeof block.language === "string" ? block.language : undefined,
      lastModified:
        typeof block.lastModified === "string" ? block.lastModified : undefined,
      sizeBytes: typeof block.sizeBytes === "number" ? block.sizeBytes : undefined,
      priority: typeof block.priority === "number" ? block.priority : undefined,
    };
  });
}
