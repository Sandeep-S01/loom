CREATE TABLE IF NOT EXISTS "model_runtime_state" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "registry_model_id" varchar(50) NOT NULL,
  "status" varchar(30) DEFAULT 'unknown' NOT NULL,
  "cooldown_until" timestamp with time zone,
  "consecutive_failures" integer DEFAULT 0 NOT NULL,
  "last_failure_code" varchar(80),
  "last_failure_at" timestamp with time zone,
  "last_success_at" timestamp with time zone,
  "last_checked_at" timestamp with time zone,
  "reason" text,
  "updated_by_user_id" varchar(50),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "model_runtime_state_registry_model_id_model_registry_id_fk"
    FOREIGN KEY ("registry_model_id") REFERENCES "model_registry"("id"),
  CONSTRAINT "model_runtime_state_updated_by_user_id_users_id_fk"
    FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id"),
  CONSTRAINT "chk_model_runtime_state_status"
    CHECK ("status" IN (
      'healthy',
      'degraded',
      'rate_limited',
      'open_circuit',
      'auth_invalid',
      'unknown'
    )),
  CONSTRAINT "chk_model_runtime_state_consecutive_failures"
    CHECK ("consecutive_failures" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_model_runtime_state_registry_model"
  ON "model_runtime_state" ("registry_model_id");

CREATE INDEX IF NOT EXISTS "idx_model_runtime_state_status"
  ON "model_runtime_state" ("status");

CREATE INDEX IF NOT EXISTS "idx_model_runtime_state_cooldown"
  ON "model_runtime_state" ("cooldown_until");

CREATE INDEX IF NOT EXISTS "idx_model_runtime_state_last_checked"
  ON "model_runtime_state" ("last_checked_at");

CREATE INDEX IF NOT EXISTS "idx_model_runtime_state_updated"
  ON "model_runtime_state" ("updated_at");
