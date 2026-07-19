CREATE TABLE IF NOT EXISTS "model_policy" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "registry_model_id" varchar(50) NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "visible_in_selector" boolean DEFAULT true NOT NULL,
  "priority_rank" integer DEFAULT 100 NOT NULL,
  "default_for_chat" boolean DEFAULT false NOT NULL,
  "default_for_agent" boolean DEFAULT false NOT NULL,
  "requires_companion" boolean DEFAULT false NOT NULL,
  "requests_per_minute_limit" integer,
  "tokens_per_day_limit" integer,
  "tokens_per_request_limit" integer,
  "notes" text,
  "created_by_user_id" varchar(50) NOT NULL,
  "updated_by_user_id" varchar(50) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "model_policy_registry_model_id_model_registry_id_fk"
    FOREIGN KEY ("registry_model_id") REFERENCES "model_registry"("id"),
  CONSTRAINT "model_policy_created_by_user_id_users_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id"),
  CONSTRAINT "model_policy_updated_by_user_id_users_id_fk"
    FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id"),
  CONSTRAINT "chk_model_policy_priority_rank"
    CHECK ("priority_rank" >= 0),
  CONSTRAINT "chk_model_policy_requests_per_minute_limit"
    CHECK ("requests_per_minute_limit" IS NULL OR "requests_per_minute_limit" > 0),
  CONSTRAINT "chk_model_policy_tokens_per_day_limit"
    CHECK ("tokens_per_day_limit" IS NULL OR "tokens_per_day_limit" > 0),
  CONSTRAINT "chk_model_policy_tokens_per_request_limit"
    CHECK ("tokens_per_request_limit" IS NULL OR "tokens_per_request_limit" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_model_policy_registry_model"
  ON "model_policy" ("registry_model_id");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_model_policy_default_chat"
  ON "model_policy" ("default_for_chat")
  WHERE "default_for_chat" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_model_policy_default_agent"
  ON "model_policy" ("default_for_agent")
  WHERE "default_for_agent" = true;

CREATE INDEX IF NOT EXISTS "idx_model_policy_enabled"
  ON "model_policy" ("enabled");

CREATE INDEX IF NOT EXISTS "idx_model_policy_visible"
  ON "model_policy" ("visible_in_selector");

CREATE INDEX IF NOT EXISTS "idx_model_policy_priority"
  ON "model_policy" ("priority_rank");

CREATE INDEX IF NOT EXISTS "idx_model_policy_updated_at"
  ON "model_policy" ("updated_at");
