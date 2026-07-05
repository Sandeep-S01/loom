import { eq } from "drizzle-orm";
import { getDb } from "../../db/connection.js";
import { users } from "../../db/schema.js";
import type { SessionUserContext } from "../../plugins/request-context.js";

export interface SessionService {
  resolveSessionUser(sessionUserId?: string): Promise<SessionUserContext>;
}

const DEFAULT_USER: SessionUserContext = {
  id: "usr_seeded",
  email: "user@clm.local",
  displayName: "Primary User",
};

export function createInMemorySessionService(): SessionService {
  return {
    async resolveSessionUser() {
      return DEFAULT_USER;
    },
  };
}

export function createDatabaseSessionService(): SessionService {
  return {
    async resolveSessionUser(sessionUserId?: string) {
      const db = getDb();

      if (sessionUserId) {
        const existing = await db.query.users.findFirst({
          where: eq(users.id, sessionUserId),
        });

        if (existing) {
          return {
            id: existing.id,
            email: existing.email,
            displayName: existing.displayName,
          };
        }
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
      };
    },
  };
}
