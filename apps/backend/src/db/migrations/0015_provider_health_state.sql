CREATE TABLE IF NOT EXISTS "provider_health_state" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "provider_id" varchar(50) NOT NULL,
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
  CONSTRAINT "provider_health_state_provider_id_providers_id_fk"
    FOREIGN KEY ("provider_id") REFERENCES "providers"("id"),
  CONSTRAINT "provider_health_state_updated_by_user_id_users_id_fk"
    FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id"),
  CONSTRAINT "chk_provider_health_state_status"
    CHECK ("status" IN (
      'healthy',
      'degraded',
      'unavailable',
      'auth_invalid',
      'unknown'
    )),
  CONSTRAINT "chk_provider_health_state_consecutive_failures"
    CHECK ("consecutive_failures" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_provider_health_state_provider"
  ON "provider_health_state" ("provider_id");

CREATE INDEX IF NOT EXISTS "idx_provider_health_state_status"
  ON "provider_health_state" ("status");

CREATE INDEX IF NOT EXISTS "idx_provider_health_state_cooldown"
  ON "provider_health_state" ("cooldown_until");

CREATE INDEX IF NOT EXISTS "idx_provider_health_state_last_checked"
  ON "provider_health_state" ("last_checked_at");

CREATE INDEX IF NOT EXISTS "idx_provider_health_state_updated"
  ON "provider_health_state" ("updated_at");
