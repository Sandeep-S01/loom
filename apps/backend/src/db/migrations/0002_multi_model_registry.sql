ALTER TABLE "providers" ADD COLUMN "driver_key" varchar(50) DEFAULT 'openrouter' NOT NULL;
ALTER TABLE "providers" ADD COLUMN "default_secret_ref" varchar(255);
ALTER TABLE "providers" ADD COLUMN "metadata_json" jsonb;

ALTER TABLE "models" ADD COLUMN "admin_status" varchar(20) DEFAULT 'active' NOT NULL;
ALTER TABLE "models" ADD COLUMN "runtime_status" varchar(30) DEFAULT 'healthy' NOT NULL;
ALTER TABLE "models" ADD COLUMN "secret_ref" varchar(255);
ALTER TABLE "models" ADD COLUMN "cooldown_until" timestamp with time zone;
ALTER TABLE "models" ADD COLUMN "requests_per_minute_limit" integer;
ALTER TABLE "models" ADD COLUMN "tokens_per_day_limit" integer;
ALTER TABLE "models" ADD COLUMN "tokens_used_today" integer DEFAULT 0 NOT NULL;
ALTER TABLE "models" ADD COLUMN "tokens_used_day_bucket" date;
ALTER TABLE "models" ADD COLUMN "consecutive_failures" integer DEFAULT 0 NOT NULL;
ALTER TABLE "models" ADD COLUMN "last_failure_code" varchar(40);
ALTER TABLE "models" ADD COLUMN "last_failure_at" timestamp with time zone;
ALTER TABLE "models" ADD COLUMN "last_success_at" timestamp with time zone;
ALTER TABLE "models" ADD COLUMN "cost_input_per_1m_usd_micros" integer;
ALTER TABLE "models" ADD COLUMN "cost_output_per_1m_usd_micros" integer;
ALTER TABLE "models" ADD COLUMN "deleted_at" timestamp with time zone;
CREATE INDEX "idx_models_admin_deleted" ON "models" USING btree ("admin_status","deleted_at");

CREATE TABLE "model_usage_events" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "conversation_id" varchar(50),
  "message_id" varchar(50),
  "provider_id" varchar(50) NOT NULL,
  "model_id" varchar(50) NOT NULL,
  "attempt_no" integer NOT NULL,
  "was_manual_selection" boolean DEFAULT false NOT NULL,
  "was_failover" boolean DEFAULT false NOT NULL,
  "request_kind" varchar(20) NOT NULL,
  "status" varchar(30) NOT NULL,
  "failure_code" varchar(40),
  "latency_ms" integer,
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  "total_tokens" integer DEFAULT 0 NOT NULL,
  "cost_usd_micros" integer DEFAULT 0 NOT NULL,
  "idempotency_key" varchar(120) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "model_usage_events" ADD CONSTRAINT "model_usage_events_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "model_usage_events" ADD CONSTRAINT "model_usage_events_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "model_usage_events" ADD CONSTRAINT "model_usage_events_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "model_usage_events" ADD CONSTRAINT "model_usage_events_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "idx_model_usage_events_model_created" ON "model_usage_events" USING btree ("model_id","created_at");
CREATE INDEX "idx_model_usage_events_conversation_created" ON "model_usage_events" USING btree ("conversation_id","created_at");

CREATE TABLE "model_usage_rollups" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "model_id" varchar(50) NOT NULL,
  "bucket_start" timestamp with time zone NOT NULL,
  "bucket_granularity" varchar(10) NOT NULL,
  "request_count" integer DEFAULT 0 NOT NULL,
  "success_count" integer DEFAULT 0 NOT NULL,
  "error_count" integer DEFAULT 0 NOT NULL,
  "rate_limit_count" integer DEFAULT 0 NOT NULL,
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  "total_tokens" integer DEFAULT 0 NOT NULL,
  "cost_usd_micros" integer DEFAULT 0 NOT NULL
);
ALTER TABLE "model_usage_rollups" ADD CONSTRAINT "model_usage_rollups_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "uq_model_usage_rollups_bucket" ON "model_usage_rollups" USING btree ("model_id","bucket_start","bucket_granularity");
CREATE INDEX "idx_model_usage_rollups_bucket" ON "model_usage_rollups" USING btree ("bucket_start","bucket_granularity");
