ALTER TABLE "models" ADD COLUMN IF NOT EXISTS "source_type" varchar(30) DEFAULT 'manual' NOT NULL;
ALTER TABLE "models" ADD COLUMN IF NOT EXISTS "cost_tier" varchar(20) DEFAULT 'unknown' NOT NULL;
ALTER TABLE "models" ADD COLUMN IF NOT EXISTS "marketplace_status" varchar(30);
ALTER TABLE "models" ADD COLUMN IF NOT EXISTS "last_synced_at" timestamp with time zone;
ALTER TABLE "models" ADD COLUMN IF NOT EXISTS "last_tested_at" timestamp with time zone;
ALTER TABLE "models" ADD COLUMN IF NOT EXISTS "catalog_metadata_json" jsonb;

CREATE INDEX IF NOT EXISTS "idx_models_marketplace" ON "models" ("source_type", "cost_tier", "marketplace_status");
