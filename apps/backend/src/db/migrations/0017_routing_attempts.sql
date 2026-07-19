CREATE TABLE IF NOT EXISTS "routing_attempts" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "request_id" varchar(120) NOT NULL,
  "user_id" varchar(50) NOT NULL,
  "conversation_id" varchar(50),
  "agent_run_id" varchar(50),
  "mode" varchar(10) NOT NULL,
  "registry_model_id" varchar(50),
  "status" varchar(30) NOT NULL,
  "eligible_count" integer DEFAULT 0 NOT NULL,
  "ineligible_count" integer DEFAULT 0 NOT NULL,
  "reason_code" varchar(80),
  "reason_message" text,
  "metadata_json" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "routing_attempts_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id"),
  CONSTRAINT "routing_attempts_conversation_id_conversations_id_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id"),
  CONSTRAINT "routing_attempts_agent_run_id_agent_runs_id_fk"
    FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id"),
  CONSTRAINT "routing_attempts_registry_model_id_model_registry_id_fk"
    FOREIGN KEY ("registry_model_id") REFERENCES "model_registry"("id"),
  CONSTRAINT "chk_routing_attempts_mode"
    CHECK ("mode" IN ('chat', 'agent')),
  CONSTRAINT "chk_routing_attempts_status"
    CHECK ("status" IN ('selected', 'no_eligible_models')),
  CONSTRAINT "chk_routing_attempts_counts"
    CHECK ("eligible_count" >= 0 AND "ineligible_count" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_routing_attempts_request"
  ON "routing_attempts" ("request_id");

CREATE INDEX IF NOT EXISTS "idx_routing_attempts_user_created"
  ON "routing_attempts" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_routing_attempts_conversation_created"
  ON "routing_attempts" ("conversation_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_routing_attempts_agent_run_created"
  ON "routing_attempts" ("agent_run_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_routing_attempts_registry_created"
  ON "routing_attempts" ("registry_model_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_routing_attempts_status_created"
  ON "routing_attempts" ("status", "created_at");

CREATE INDEX IF NOT EXISTS "idx_routing_attempts_mode_created"
  ON "routing_attempts" ("mode", "created_at");
