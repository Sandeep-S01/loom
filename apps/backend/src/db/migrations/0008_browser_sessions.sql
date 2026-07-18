CREATE TABLE IF NOT EXISTS "browser_sessions" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "user_id" varchar(50) NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "browser_sessions_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE no action
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_browser_sessions_token_hash"
  ON "browser_sessions" ("token_hash");

CREATE INDEX IF NOT EXISTS "idx_browser_sessions_user_expires"
  ON "browser_sessions" ("user_id", "expires_at");
