import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { SessionService } from "../modules/session/service.js";

const SESSION_COOKIE_NAME = "clm_session_user_id";

export async function registerSessionContext(
  app: FastifyInstance,
  sessionService: SessionService,
) {
  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionUserId = request.cookies[SESSION_COOKIE_NAME];
    const sessionUser = await sessionService.resolveSessionUser(sessionUserId);

    request.sessionUser = sessionUser;

    if (sessionUserId !== sessionUser.id) {
      reply.setCookie(SESSION_COOKIE_NAME, sessionUser.id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }
  });
}
