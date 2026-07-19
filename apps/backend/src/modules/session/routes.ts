import type { FastifyInstance } from "fastify";
import { badRequest, tooManyRequests, unauthorized } from "../../lib/http-errors.js";
import {
  LEGACY_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
} from "../../plugins/session.js";
import type { SessionService } from "./service.js";

interface RegisterSessionRoutesOptions {
  sessionService: SessionService;
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_LIMIT = 5;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireString(value: unknown, message: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw badRequest(message);
  }

  return value.trim();
}

export async function registerSessionRoutes(
  app: FastifyInstance,
  options: RegisterSessionRoutesOptions,
) {
  const loginAttempts = new Map<string, { count: number; resetAt: number }>();

  app.get("/", async (request, reply) => {
    if (!request.sessionUser) {
      const query = (request.query as { optional?: unknown } | undefined) ?? {};
      if (query.optional === "true") {
        reply.status(204);
        return;
      }

      throw unauthorized("Authentication required.");
    }

    return {
      user: request.sessionUser,
    };
  });

  app.patch("/", async (request) => {
    if (!request.sessionUser) {
      throw unauthorized("Authentication required.");
    }

    const body =
      (request.body as
        | {
            displayName?: unknown;
          }
        | undefined) ?? {};
    const displayName = requireString(body.displayName, "Display name is required.");

    if (displayName.length > 80) {
      throw badRequest("Display name must be 80 characters or fewer.");
    }

    const user = await options.sessionService.updateProfile({
      userId: request.sessionUser.id,
      displayName,
    });

    return { user };
  });

  app.post("/login", async (request, reply) => {
    const body =
      (request.body as
        | {
            email?: unknown;
            password?: unknown;
          }
        | undefined) ?? {};

    const email = requireString(body.email, "Email is required.").toLowerCase();
    const rateLimitKey = request.ip;
    consumeLoginAttempt(loginAttempts, rateLimitKey);

    const user = await options.sessionService.authenticate({
      email,
      password: requireString(body.password, "Password is required."),
    });
    loginAttempts.delete(rateLimitKey);
    const session = await options.sessionService.createSession(user.id);
    const cookieOptions = getSessionCookieOptions();

    reply.setCookie(SESSION_COOKIE_NAME, session.token, {
      ...cookieOptions,
      expires: session.expiresAt,
    });
    reply.clearCookie(LEGACY_SESSION_COOKIE_NAME, cookieOptions);

    return { user };
  });

  app.post("/register", async (request, reply) => {
    const body =
      (request.body as
        | {
            email?: unknown;
            password?: unknown;
            displayName?: unknown;
          }
        | undefined) ?? {};

    const email = requireString(body.email, "Email is required.").toLowerCase();
    const password = requireString(body.password, "Password is required.");
    const displayName = requireString(body.displayName, "Display name is required.");

    if (!EMAIL_PATTERN.test(email)) {
      throw badRequest("Enter a valid email address.");
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      throw badRequest("Password must be at least 8 characters.");
    }

    if (displayName.length > 80) {
      throw badRequest("Display name must be 80 characters or fewer.");
    }

    const user = await options.sessionService.registerUser({
      email,
      password,
      displayName,
    });
    const session = await options.sessionService.createSession(user.id);
    const cookieOptions = getSessionCookieOptions();

    reply.setCookie(SESSION_COOKIE_NAME, session.token, {
      ...cookieOptions,
      expires: session.expiresAt,
    });
    reply.clearCookie(LEGACY_SESSION_COOKIE_NAME, cookieOptions);

    return { user };
  });

  app.post("/logout", async (request, reply) => {
    await options.sessionService.revokeSession(
      request.cookies[SESSION_COOKIE_NAME],
    );
    const cookieOptions = getSessionCookieOptions();
    reply.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
    reply.clearCookie(LEGACY_SESSION_COOKIE_NAME, cookieOptions);
    reply.status(204);
  });
}

function consumeLoginAttempt(
  attempts: Map<string, { count: number; resetAt: number }>,
  key: string,
) {
  const now = Date.now();
  const current = attempts.get(key);
  const next = !current || current.resetAt <= now
    ? { count: 1, resetAt: now + LOGIN_WINDOW_MS }
    : { ...current, count: current.count + 1 };

  attempts.set(key, next);
  if (next.count > LOGIN_ATTEMPT_LIMIT) {
    throw tooManyRequests("Too many login attempts. Try again later.");
  }
}
