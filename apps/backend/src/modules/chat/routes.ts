import type { FastifyInstance } from "fastify";
import { badRequest, conflict, notFound } from "../../lib/http-errors.js";
import type { ConversationRepository } from "../conversations/repository.js";
import type { ChatService } from "./service.js";

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
      content?: Array<{ type?: string; text?: string }>;
    };

    if (!Array.isArray(body?.content) || body.content.length === 0) {
      throw badRequest("Message content is required");
    }

    for (const item of body.content) {
      if (item.type !== "text" || typeof item.text !== "string" || item.text.trim() === "") {
        throw badRequest("Only non-empty text message content is supported");
      }
    }

    return options.chatService.sendMessage({
      userId: request.sessionUser.id,
      conversationId: params.conversationId,
      mode: conversation.mode as "chat" | "agent",
      content: body.content.map((item) => ({
        type: "text" as const,
        text: item.text!.trim(),
      })),
    });
  });
}
