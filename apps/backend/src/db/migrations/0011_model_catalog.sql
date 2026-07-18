CREATE TABLE IF NOT EXISTS "model_catalog" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "provider_id" varchar(50) NOT NULL,
  "external_model_key" varchar(255) NOT NULL,
  "display_name" varchar(255) NOT NULL,
  "description" text,
  "supports_chat" boolean DEFAULT false NOT NULL,
  "supports_agent" boolean DEFAULT false NOT NULL,
  "supports_vision" boolean DEFAULT false NOT NULL,
  "supports_tool_use" boolean DEFAULT false NOT NULL,
  "supports_json_mode" boolean DEFAULT false NOT NULL,
  "capabilities_json" jsonb NOT NULL,
  "context_window" integer,
  "max_output_tokens" integer,
  "cost_tier" varchar(20) DEFAULT 'free' NOT NULL,
  "pricing_json" jsonb NOT NULL,
  "release_stage" varchar(30) DEFAULT 'stable' NOT NULL,
  "released_at" timestamp with time zone,
  "deprecated_at" timestamp with time zone,
  "deprecation_reason" text,
  "provider_metadata_json" jsonb NOT NULL,
  "first_discovered_at" timestamp with time zone NOT NULL,
  "last_discovered_at" timestamp with time zone NOT NULL,
  "last_changed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "model_catalog_provider_id_providers_id_fk"
    FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_model_catalog_provider_external"
  ON "model_catalog" ("provider_id", "external_model_key");

CREATE INDEX IF NOT EXISTS "idx_model_catalog_provider"
  ON "model_catalog" ("provider_id");

CREATE INDEX IF NOT EXISTS "idx_model_catalog_provider_deprecated"
  ON "model_catalog" ("provider_id", "deprecated_at");

CREATE INDEX IF NOT EXISTS "idx_model_catalog_capabilities"
  ON "model_catalog" ("supports_chat", "supports_agent", "supports_vision");

CREATE INDEX IF NOT EXISTS "idx_model_catalog_cost_tier"
  ON "model_catalog" ("cost_tier");

CREATE INDEX IF NOT EXISTS "idx_model_catalog_release_stage"
  ON "model_catalog" ("release_stage");

CREATE INDEX IF NOT EXISTS "idx_model_catalog_last_discovered"
  ON "model_catalog" ("last_discovered_at");
