import type { FastifyInstance } from "fastify";
import { badRequest, notFound } from "../../lib/http-errors.js";
import type { ConversationRepository } from "./repository.js";

interface RegisterConversationRoutesOptions {
  conversationRepository: ConversationRepository;
}

export async function registerConversationRoutes(
  app: FastifyInstance,
  options: RegisterConversationRoutesOptions,
) {
  app.get("/", async (request) => {
    if (!request.sessionUser) {
      throw new Error("Session user is not available");
    }

    const conversations = await options.conversationRepository.listForUser(
      request.sessionUser.id,
    );

    return {
      conversations: conversations.map((item) => ({
        id: item.id,
        mode: item.mode,
        title: item.title,
        lastMessageAt: item.lastMessageAt,
        updatedAt: item.updatedAt,
      })),
    };
  });

  app.post("/", async (request, reply) => {
    if (!request.sessionUser) {
      throw new Error("Session user is not available");
    }

    const body = request.body as { mode?: string; title?: string } | undefined;
    const title = body?.title?.trim() || "New Conversation";
    if (title.length > 500) {
      throw badRequest("Conversation title must be 500 characters or fewer");
    }

    const conversation = await options.conversationRepository.createForUser(
      request.sessionUser.id,
      title,
    );

    reply.status(201);

    return {
      conversation: {
        id: conversation.id,
        mode: conversation.mode,
        title: conversation.title,
        lastMessageAt: conversation.lastMessageAt,
        updatedAt: conversation.updatedAt,
      },
    };
  });

  app.patch("/:conversationId", async (request) => {
    if (!request.sessionUser) {
      throw new Error("Session user is not available");
    }

    const params = request.params as { conversationId: string };
    const body = request.body as { title?: string } | undefined;
    const nextTitle = body?.title?.trim();

    if (!nextTitle) {
      throw badRequest("Conversation title is required");
    }
    if (nextTitle.length > 500) {
      throw badRequest("Conversation title must be 500 characters or fewer");
    }

    const conversation = await options.conversationRepository.updateForUser(
      request.sessionUser.id,
      params.conversationId,
      {
        title: nextTitle,
      },
    );

    if (!conversation) {
      throw notFound("Conversation not found");
    }

    return {
      conversation: {
        id: conversation.id,
        mode: conversation.mode,
        title: conversation.title,
        lastMessageAt: conversation.lastMessageAt,
        updatedAt: conversation.updatedAt,
      },
    };
  });

  app.delete("/:conversationId", async (request, reply) => {
    if (!request.sessionUser) {
      throw new Error("Session user is not available");
    }

    const params = request.params as { conversationId: string };
    const conversation = await options.conversationRepository.updateForUser(
      request.sessionUser.id,
      params.conversationId,
      {
        archived: true,
      },
    );

    if (!conversation) {
      throw notFound("Conversation not found");
    }

    reply.status(204);
    return null;
  });
}
