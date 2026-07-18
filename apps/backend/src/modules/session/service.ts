import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb } from "../../db/connection.js";
import { auditEvents, browserSessions, users } from "../../db/schema.js";
import type { SessionUserContext } from "../../plugins/request-context.js";
import { conflict, unauthorized } from "../../lib/http-errors.js";
import { generateId } from "@clm/shared-utils";

const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

export interface SessionService {
  resolveSessionUser(sessionToken?: string): Promise<SessionUserContext | null>;
  authenticate(input: {
    email: string;
    password: string;
  }): Promise<SessionUserContext>;
  createSession(userId: string): Promise<CreatedSession>;
  revokeSession(sessionToken?: string): Promise<void>;
  registerUser(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<SessionUserContext>;
  updateProfile(input: {
    userId: string;
    displayName: string;
  }): Promise<SessionUserContext>;
}

const DEFAULT_USER: SessionUserContext = {
  id: "usr_seeded",
  email: "user@clm.local",
  displayName: "Primary User",
  role: "admin",
};

export function createInMemorySessionService(options: {
  allowDevSessionFallback?: boolean;
  sessionTtlMs?: number;
} = {}): SessionService {
  let user = { ...DEFAULT_USER };
  const registeredUsers = new Map<string, SessionUserContext>([
    [user.email, user],
  ]);
  const passwords = new Map<string, string>([[user.email, "changeme"]]);
  const sessions = new Map<string, { userId: string; expiresAt: Date }>();
  const allowDevSessionFallback = options.allowDevSessionFallback ?? true;

  return {
    async resolveSessionUser(sessionToken) {
      if (!sessionToken) {
        return allowDevSessionFallback ? user : null;
      }

      const session = sessions.get(sessionToken);
      if (!session || session.expiresAt.getTime() <= Date.now()) {
        sessions.delete(sessionToken);
        return null;
      }

      return [...registeredUsers.values()].find((candidate) => candidate.id === session.userId) ?? null;
    },
    async authenticate(input) {
      const email = input.email.trim().toLowerCase();
      const authenticatedUser = registeredUsers.get(email);
      if (!authenticatedUser || passwords.get(email) !== input.password) {
        throw unauthorized("Invalid email or password.");
      }

      return authenticatedUser;
    },
    async createSession(userId) {
      if (![...registeredUsers.values()].some((candidate) => candidate.id === userId)) {
        throw unauthorized("Authentication required.");
      }

      const token = createSessionToken();
      const expiresAt = new Date(
        Date.now() + (options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS),
      );
      sessions.set(token, { userId, expiresAt });
      return { token, expiresAt };
    },
    async revokeSession(sessionToken) {
      if (sessionToken) {
        sessions.delete(sessionToken);
      }
    },
    async registerUser(input) {
      const email = input.email.trim().toLowerCase();
      if (registeredUsers.has(email)) {
        throw conflict("An account with this email already exists.");
      }

      const createdUser = {
        id: generateId("user"),
        email,
        displayName: input.displayName,
        role: "customer" as const,
      };
      registeredUsers.set(email, createdUser);
      passwords.set(email, input.password);
      return createdUser;
    },
    async updateProfile(input) {
      const existing = [...registeredUsers.values()].find(
        (candidate) => candidate.id === input.userId,
      );
      if (!existing) {
        throw unauthorized("Authentication required.");
      }

      const updatedUser = {
        ...existing,
        displayName: input.displayName,
      };
      registeredUsers.set(updatedUser.email, updatedUser);
      if (updatedUser.id === user.id) {
        user = updatedUser;
      }

      return updatedUser;
    },
  };
}

export function createDatabaseSessionService(options: {
  allowDevSessionFallback?: boolean;
  sessionTtlMs?: number;
} = {}): SessionService {
  return {
    async resolveSessionUser(sessionToken?: string) {
      const db = getDb();

      if (sessionToken) {
        const [existing] = await db
          .select({
            id: users.id,
            email: users.email,
            displayName: users.displayName,
            role: users.role,
          })
          .from(browserSessions)
          .innerJoin(users, eq(browserSessions.userId, users.id))
          .where(
            and(
              eq(browserSessions.tokenHash, hashSessionToken(sessionToken)),
              isNull(browserSessions.revokedAt),
              gt(browserSessions.expiresAt, new Date()),
            ),
          )
          .limit(1);

        if (existing) {
          return {
            id: existing.id,
            email: existing.email,
            displayName: existing.displayName,
            role: normalizeUserRole(existing.role),
          };
        }

        return null;
      }

      if (!options.allowDevSessionFallback) {
        return null;
      }

      const fallbackEmail = process.env.DEFAULT_USER_EMAIL ?? "user@clm.local";

      const seededUser = await db.query.users.findFirst({
        where: eq(users.email, fallbackEmail),
      });

      if (!seededUser) {
        throw new Error("Seeded single user not found");
      }

      return {
        id: seededUser.id,
        email: seededUser.email,
        displayName: seededUser.displayName,
        role: normalizeUserRole(seededUser.role),
      };
    },
    async authenticate(input) {
      const db = getDb();
      const user = await db.query.users.findFirst({
        where: eq(users.email, input.email.trim().toLowerCase()),
      });

      if (!user) {
        throw unauthorized("Invalid email or password.");
      }

      const validPassword = await bcrypt.compare(input.password, user.passwordHash);
      if (!validPassword) {
        throw unauthorized("Invalid email or password.");
      }

      const authenticatedUser = {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: normalizeUserRole(user.role),
      };

      const now = new Date();
      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ lastLoginAt: now, updatedAt: now })
          .where(eq(users.id, user.id));
        await tx.insert(auditEvents).values({
          id: generateId("auditEvent"),
          userId: user.id,
          eventType: "session_login",
          subjectType: "user",
          subjectId: user.id,
          payloadJson: null,
          createdAt: now,
        });
      });

      return authenticatedUser;
    },
    async createSession(userId) {
      const db = getDb();
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      if (!user) {
        throw unauthorized("Authentication required.");
      }

      const token = createSessionToken();
      const expiresAt = new Date(
        Date.now() + (options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS),
      );
      await db.insert(browserSessions).values({
        id: `ses_${randomUUID()}`,
        userId,
        tokenHash: hashSessionToken(token),
        expiresAt,
      });

      return { token, expiresAt };
    },
    async revokeSession(sessionToken) {
      if (!sessionToken) {
        return;
      }

      const db = getDb();
      const tokenHash = hashSessionToken(sessionToken);
      const [session] = await db
        .select({ userId: browserSessions.userId })
        .from(browserSessions)
        .where(eq(browserSessions.tokenHash, tokenHash))
        .limit(1);
      const now = new Date();

      await db.transaction(async (tx) => {
        await tx
          .update(browserSessions)
          .set({ revokedAt: now, lastSeenAt: now })
          .where(
            and(
              eq(browserSessions.tokenHash, tokenHash),
              isNull(browserSessions.revokedAt),
            ),
          );

        if (session) {
          await tx.insert(auditEvents).values({
            id: generateId("auditEvent"),
            userId: session.userId,
            eventType: "session_logout",
            subjectType: "user",
            subjectId: session.userId,
            payloadJson: null,
            createdAt: now,
          });
        }
      });
    },
    async registerUser(input) {
      const db = getDb();
      const email = input.email.trim().toLowerCase();
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (existingUser) {
        throw conflict("An account with this email already exists.");
      }

      const now = new Date();
      const createdUser = {
        id: generateId("user"),
        email,
        displayName: input.displayName,
        passwordHash: await bcrypt.hash(input.password, 10),
        role: "customer",
        createdAt: now,
        updatedAt: now,
      };

      await db.transaction(async (tx) => {
        await tx.insert(users).values(createdUser);
        await tx.insert(auditEvents).values({
          id: generateId("auditEvent"),
          userId: createdUser.id,
          eventType: "user_registered",
          subjectType: "user",
          subjectId: createdUser.id,
          payloadJson: null,
          createdAt: now,
        });
      });

      return {
        id: createdUser.id,
        email: createdUser.email,
        displayName: createdUser.displayName,
        role: "customer",
      };
    },
    async updateProfile(input) {
      const db = getDb();
      const [updatedUser] = await db
        .update(users)
        .set({
          displayName: input.displayName,
          updatedAt: new Date(),
        })
        .where(eq(users.id, input.userId))
        .returning({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          role: users.role,
        });

      if (!updatedUser) {
        throw unauthorized("Authentication required.");
      }

      return {
        ...updatedUser,
        role: normalizeUserRole(updatedUser.role),
      };
    },
  };
}

function normalizeUserRole(value: string | null | undefined): SessionUserContext["role"] {
  return value === "admin" ? "admin" : "customer";
}

function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
