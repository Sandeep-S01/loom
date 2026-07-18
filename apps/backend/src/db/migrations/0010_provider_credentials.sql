CREATE TABLE IF NOT EXISTS "provider_credentials" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "provider_id" varchar(50) NOT NULL,
  "secret_ref" varchar(255) NOT NULL,
  "status" varchar(20) DEFAULT 'unchecked' NOT NULL,
  "last_checked_at" timestamp with time zone,
  "last_success_at" timestamp with time zone,
  "last_failure_at" timestamp with time zone,
  "last_failure_code" varchar(80),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "provider_credentials_provider_id_providers_id_fk"
    FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_provider_credentials_provider_secret"
  ON "provider_credentials" ("provider_id", "secret_ref");

CREATE INDEX IF NOT EXISTS "idx_provider_credentials_provider"
  ON "provider_credentials" ("provider_id");

CREATE INDEX IF NOT EXISTS "idx_provider_credentials_status"
  ON "provider_credentials" ("status");

CREATE INDEX IF NOT EXISTS "idx_provider_credentials_last_checked"
  ON "provider_credentials" ("last_checked_at");
