CREATE TABLE IF NOT EXISTS "discovery_jobs" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "provider_id" varchar(50) NOT NULL,
  "status" varchar(20) DEFAULT 'running' NOT NULL,
  "trigger_type" varchar(20) DEFAULT 'manual' NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone,
  "discovered_count" integer DEFAULT 0 NOT NULL,
  "upserted_count" integer DEFAULT 0 NOT NULL,
  "skipped_count" integer DEFAULT 0 NOT NULL,
  "failure_code" varchar(80),
  "failure_message" text,
  "created_by_user_id" varchar(50),
  "metadata_json" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "discovery_jobs_provider_id_providers_id_fk"
    FOREIGN KEY ("provider_id") REFERENCES "providers"("id"),
  CONSTRAINT "discovery_jobs_created_by_user_id_users_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id"),
  CONSTRAINT "chk_discovery_jobs_status"
    CHECK ("status" IN ('running', 'succeeded', 'failed')),
  CONSTRAINT "chk_discovery_jobs_trigger_type"
    CHECK ("trigger_type" IN ('manual', 'scheduled', 'internal')),
  CONSTRAINT "chk_discovery_jobs_counts"
    CHECK (
      "discovered_count" >= 0
      AND "upserted_count" >= 0
      AND "skipped_count" >= 0
    )
);

CREATE INDEX IF NOT EXISTS "idx_discovery_jobs_provider_started"
  ON "discovery_jobs" ("provider_id", "started_at");

CREATE INDEX IF NOT EXISTS "idx_discovery_jobs_status_started"
  ON "discovery_jobs" ("status", "started_at");

CREATE INDEX IF NOT EXISTS "idx_discovery_jobs_created_by"
  ON "discovery_jobs" ("created_by_user_id");

CREATE TABLE IF NOT EXISTS "provider_sync_status" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "provider_id" varchar(50) NOT NULL,
  "last_job_id" varchar(50),
  "status" varchar(20) DEFAULT 'never_synced' NOT NULL,
  "last_started_at" timestamp with time zone,
  "last_success_at" timestamp with time zone,
  "last_failure_at" timestamp with time zone,
  "last_failure_code" varchar(80),
  "last_failure_message" text,
  "last_discovered_count" integer DEFAULT 0 NOT NULL,
  "last_upserted_count" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "provider_sync_status_provider_id_providers_id_fk"
    FOREIGN KEY ("provider_id") REFERENCES "providers"("id"),
  CONSTRAINT "provider_sync_status_last_job_id_discovery_jobs_id_fk"
    FOREIGN KEY ("last_job_id") REFERENCES "discovery_jobs"("id"),
  CONSTRAINT "chk_provider_sync_status_status"
    CHECK ("status" IN ('never_synced', 'syncing', 'succeeded', 'failed')),
  CONSTRAINT "chk_provider_sync_status_counts"
    CHECK ("last_discovered_count" >= 0 AND "last_upserted_count" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_provider_sync_status_provider"
  ON "provider_sync_status" ("provider_id");

CREATE INDEX IF NOT EXISTS "idx_provider_sync_status_status"
  ON "provider_sync_status" ("status");

CREATE INDEX IF NOT EXISTS "idx_provider_sync_status_last_started"
  ON "provider_sync_status" ("last_started_at");

CREATE INDEX IF NOT EXISTS "idx_provider_sync_status_last_success"
  ON "provider_sync_status" ("last_success_at");
