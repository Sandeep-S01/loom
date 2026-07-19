import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { forbidden, unauthorized } from "../lib/http-errors.js";
import type { SessionService } from "../modules/session/service.js";

const SESSION_COOKIE_NAME = "loom_session";
const LEGACY_SESSION_COOKIE_NAME = "clm_session_user_id";
const CSRF_COOKIE_NAME = "loom_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
export {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
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

export function getCsrfCookieOptions() {
  return {
    httpOnly: false,
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
    ensureCsrfCookie(request, reply);

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

    enforceCsrfToken(request, sessionUser != null || Boolean(sessionToken));
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

function ensureCsrfCookie(request: FastifyRequest, reply: FastifyReply) {
  if (process.env.NODE_ENV !== "production") return;
  if (!request.url.startsWith("/api/v1/")) return;
  if (request.cookies[CSRF_COOKIE_NAME]) return;
  if (isCompanionBearerRequest(request)) return;

  reply.setCookie(CSRF_COOKIE_NAME, randomBytes(32).toString("base64url"), {
    ...getCsrfCookieOptions(),
    maxAge: 7 * 24 * 60 * 60,
  });
}

function enforceCsrfToken(request: FastifyRequest, hasSessionContext: boolean) {
  if (process.env.NODE_ENV !== "production") return;
  if (isSafeMethod(request.method)) return;
  if (!request.url.startsWith("/api/v1/")) return;
  if (isCompanionBearerRequest(request)) return;
  if (!hasSessionContext && isUnauthenticatedSessionMutation(request)) return;

  const cookieToken = request.cookies[CSRF_COOKIE_NAME];
  const headerToken = request.headers[CSRF_HEADER_NAME];
  const requestToken = Array.isArray(headerToken) ? headerToken[0] : headerToken;

  if (
    typeof cookieToken !== "string" ||
    typeof requestToken !== "string" ||
    !tokensMatch(cookieToken, requestToken)
  ) {
    throw forbidden("CSRF token is missing or invalid.");
  }
}

function tokensMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function isUnauthenticatedSessionMutation(request: FastifyRequest) {
  return (
    request.method === "POST" &&
    (request.url === "/api/v1/session/login" ||
      request.url === "/api/v1/session/register")
  );
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

  if (isOptionalSessionLookup(request)) {
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

function isOptionalSessionLookup(request: FastifyRequest) {
  return (
    request.method === "GET" &&
    request.url.startsWith("/api/v1/session?") &&
    new URL(request.url, "http://localhost").searchParams.get("optional") === "true"
  );
}
