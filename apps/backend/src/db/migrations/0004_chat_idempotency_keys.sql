CREATE TABLE IF NOT EXISTS "chat_idempotency_keys" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "user_id" varchar(50) NOT NULL,
  "conversation_id" varchar(50) NOT NULL,
  "idempotency_key" varchar(120) NOT NULL,
  "status" varchar(20) DEFAULT 'processing' NOT NULL,
  "request_id" varchar(120) NOT NULL,
  "response_json" jsonb,
  "error_code" varchar(80),
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chat_idempotency_keys_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "chat_idempotency_keys_conversation_id_conversations_id_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE no action ON UPDATE no action
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_chat_idempotency_scope"
  ON "chat_idempotency_keys" ("user_id", "conversation_id", "idempotency_key");

CREATE INDEX IF NOT EXISTS "idx_chat_idempotency_expires"
  ON "chat_idempotency_keys" ("expires_at");
