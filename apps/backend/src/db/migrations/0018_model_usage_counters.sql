CREATE TABLE IF NOT EXISTS "model_usage_counters" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "registry_model_id" varchar(50) NOT NULL,
  "provider_id" varchar(50) NOT NULL,
  "bucket_start" timestamp with time zone NOT NULL,
  "bucket_granularity" varchar(10) NOT NULL,
  "request_count" integer DEFAULT 0 NOT NULL,
  "success_count" integer DEFAULT 0 NOT NULL,
  "failure_count" integer DEFAULT 0 NOT NULL,
  "fallback_count" integer DEFAULT 0 NOT NULL,
  "rate_limit_count" integer DEFAULT 0 NOT NULL,
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  "total_tokens" integer DEFAULT 0 NOT NULL,
  "latency_ms_total" integer DEFAULT 0 NOT NULL,
  "latency_sample_count" integer DEFAULT 0 NOT NULL,
  "cost_usd_micros" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "model_usage_counters_registry_model_id_model_registry_id_fk"
    FOREIGN KEY ("registry_model_id") REFERENCES "model_registry"("id"),
  CONSTRAINT "model_usage_counters_provider_id_providers_id_fk"
    FOREIGN KEY ("provider_id") REFERENCES "providers"("id"),
  CONSTRAINT "chk_model_usage_counters_granularity"
    CHECK ("bucket_granularity" IN ('hour', 'day')),
  CONSTRAINT "chk_model_usage_counters_counts"
    CHECK (
      "request_count" >= 0
      AND "success_count" >= 0
      AND "failure_count" >= 0
      AND "fallback_count" >= 0
      AND "rate_limit_count" >= 0
    ),
  CONSTRAINT "chk_model_usage_counters_values"
    CHECK (
      "input_tokens" >= 0
      AND "output_tokens" >= 0
      AND "total_tokens" >= 0
      AND "latency_ms_total" >= 0
      AND "latency_sample_count" >= 0
      AND "cost_usd_micros" >= 0
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_model_usage_counters_bucket"
  ON "model_usage_counters" (
    "registry_model_id",
    "bucket_start",
    "bucket_granularity"
  );

CREATE INDEX IF NOT EXISTS "idx_model_usage_counters_provider_bucket"
  ON "model_usage_counters" ("provider_id", "bucket_start");

CREATE INDEX IF NOT EXISTS "idx_model_usage_counters_bucket"
  ON "model_usage_counters" ("bucket_granularity", "bucket_start");

CREATE INDEX IF NOT EXISTS "idx_model_usage_counters_registry_bucket"
  ON "model_usage_counters" ("registry_model_id", "bucket_start");
