CREATE TABLE IF NOT EXISTS "model_registry" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "catalog_model_id" varchar(50) NOT NULL,
  "status" varchar(20) DEFAULT 'registered' NOT NULL,
  "approved_by_user_id" varchar(50) NOT NULL,
  "approved_at" timestamp with time zone NOT NULL,
  "archived_by_user_id" varchar(50),
  "archived_at" timestamp with time zone,
  "archive_reason" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "model_registry_catalog_model_id_model_catalog_id_fk"
    FOREIGN KEY ("catalog_model_id") REFERENCES "model_catalog"("id"),
  CONSTRAINT "model_registry_approved_by_user_id_users_id_fk"
    FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id"),
  CONSTRAINT "model_registry_archived_by_user_id_users_id_fk"
    FOREIGN KEY ("archived_by_user_id") REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "idx_model_registry_catalog"
  ON "model_registry" ("catalog_model_id");

CREATE INDEX IF NOT EXISTS "idx_model_registry_status"
  ON "model_registry" ("status");

CREATE INDEX IF NOT EXISTS "idx_model_registry_approved_at"
  ON "model_registry" ("approved_at");

CREATE INDEX IF NOT EXISTS "idx_model_registry_archived_at"
  ON "model_registry" ("archived_at");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_model_registry_active_catalog"
  ON "model_registry" ("catalog_model_id")
  WHERE "status" = 'registered' AND "archived_at" IS NULL;
