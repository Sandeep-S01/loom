import type { FastifyInstance } from "fastify";
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
}
