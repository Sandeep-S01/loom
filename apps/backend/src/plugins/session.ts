import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { forbidden, unauthorized } from "../lib/http-errors.js";
import type { SessionService } from "../modules/session/service.js";

const SESSION_COOKIE_NAME = "loom_session";
const LEGACY_SESSION_COOKIE_NAME = "clm_session_user_id";
export {
  LEGACY_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
};

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}

export async function registerSessionContext(
  app: FastifyInstance,
  sessionService: SessionService,
) {
  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    enforceTrustedBrowserOrigin(request);

    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const sessionUser = await sessionService.resolveSessionUser(sessionToken);

    request.sessionUser = sessionUser;

    if (sessionUser && !sessionToken) {
      const session = await sessionService.createSession(sessionUser.id);
      const cookieOptions = getSessionCookieOptions();
      reply.setCookie(SESSION_COOKIE_NAME, session.token, {
        ...cookieOptions,
        expires: session.expiresAt,
      });
      reply.clearCookie(LEGACY_SESSION_COOKIE_NAME, cookieOptions);
    }

    if (!sessionUser && requiresAuthenticatedSession(request)) {
      throw unauthorized("Authentication required.");
    }
  });
}

function enforceTrustedBrowserOrigin(request: FastifyRequest) {
  if (process.env.NODE_ENV !== "production" || isSafeMethod(request.method)) {
    return;
  }

  if (isCompanionBearerRequest(request)) {
    return;
  }

  const origin = request.headers.origin;
  const trustedOrigins = getTrustedBrowserOrigins();
  if (!origin || !trustedOrigins.includes(origin)) {
    throw forbidden("Request origin is not allowed.");
  }
}

function isSafeMethod(method: string) {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

function isCompanionBearerRequest(request: FastifyRequest) {
  if (request.url === "/api/v1/companion/pair/complete") {
    return true;
  }

  return (
    request.headers.authorization?.startsWith("Bearer ") === true &&
    request.url === "/api/v1/workspaces/select"
  );
}

function getTrustedBrowserOrigins() {
  return [process.env.FRONTEND_URL, process.env.FRONTEND_URLS]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function requiresAuthenticatedSession(request: FastifyRequest) {
  if (!request.url.startsWith("/api/v1/")) {
    return false;
  }

  if (request.url.startsWith("/api/v1/health")) {
    return false;
  }

  if (
    request.method === "POST" &&
    (request.url === "/api/v1/session/login" ||
      request.url === "/api/v1/session/register" ||
      request.url === "/api/v1/session/logout" ||
      request.url === "/api/v1/companion/pair/complete" ||
      request.url === "/api/v1/workspaces/select")
  ) {
    return false;
  }

  return true;
}
