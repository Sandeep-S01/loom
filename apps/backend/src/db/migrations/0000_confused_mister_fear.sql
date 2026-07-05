CREATE TABLE "agent_run_events" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"agent_run_id" varchar(50) NOT NULL,
	"event_type" varchar(30) NOT NULL,
	"payload_json" jsonb NOT NULL,
	"sequence_no" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"conversation_id" varchar(50) NOT NULL,
	"workspace_id" varchar(50) NOT NULL,
	"objective" text NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"final_summary" text,
	"stop_reason" varchar(30),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"user_id" varchar(50) NOT NULL,
	"device_id" varchar(50),
	"event_type" varchar(50) NOT NULL,
	"subject_type" varchar(50) NOT NULL,
	"subject_id" varchar(50) NOT NULL,
	"payload_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "command_executions" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"agent_run_id" varchar(50) NOT NULL,
	"command_text" text NOT NULL,
	"working_directory_relative" varchar(1000) NOT NULL,
	"exit_code" integer,
	"stdout_excerpt" text,
	"stderr_excerpt" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "context_snapshots" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"conversation_id" varchar(50) NOT NULL,
	"agent_run_id" varchar(50),
	"summary_text" text NOT NULL,
	"summary_json" jsonb,
	"source_message_id" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"user_id" varchar(50) NOT NULL,
	"mode" varchar(10) DEFAULT 'chat' NOT NULL,
	"title" varchar(500) DEFAULT 'New Conversation' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"user_id" varchar(50) NOT NULL,
	"device_type" varchar(30) NOT NULL,
	"machine_label" varchar(255),
	"machine_fingerprint_hash" varchar(255),
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_operations" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"agent_run_id" varchar(50) NOT NULL,
	"operation_type" varchar(20) NOT NULL,
	"relative_path" varchar(1000) NOT NULL,
	"target_relative_path" varchar(1000),
	"status" varchar(20) NOT NULL,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"conversation_id" varchar(50) NOT NULL,
	"role" varchar(20) NOT NULL,
	"content_json" jsonb NOT NULL,
	"provider_id" varchar(50),
	"model_id" varchar(50),
	"token_estimate_in" integer,
	"token_estimate_out" integer,
	"sequence_no" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"provider_id" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"external_model_key" varchar(255) NOT NULL,
	"supports_chat" boolean DEFAULT true NOT NULL,
	"supports_agent" boolean DEFAULT false NOT NULL,
	"supports_vision" boolean DEFAULT false NOT NULL,
	"context_window" integer DEFAULT 4096 NOT NULL,
	"priority_rank" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_attempts" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"conversation_id" varchar(50),
	"agent_run_id" varchar(50),
	"provider_id" varchar(50) NOT NULL,
	"model_id" varchar(50) NOT NULL,
	"attempt_no" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	"failure_code" varchar(40),
	"latency_ms" integer,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"base_type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"priority_rank" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"user_id" varchar(50) NOT NULL,
	"device_id" varchar(50) NOT NULL,
	"alias" varchar(255) NOT NULL,
	"canonical_path_hash" varchar(255) NOT NULL,
	"display_path_hint" varchar(1000),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_run_events" ADD CONSTRAINT "agent_run_events_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_executions" ADD CONSTRAINT "command_executions_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_snapshots" ADD CONSTRAINT "context_snapshots_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_operations" ADD CONSTRAINT "file_operations_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models" ADD CONSTRAINT "models_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_attempts" ADD CONSTRAINT "provider_attempts_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_attempts" ADD CONSTRAINT "provider_attempts_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_attempts" ADD CONSTRAINT "provider_attempts_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_attempts" ADD CONSTRAINT "provider_attempts_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_run_events_run_sequence" ON "agent_run_events" USING btree ("agent_run_id","sequence_no");--> statement-breakpoint
CREATE INDEX "idx_agent_runs_workspace_created" ON "agent_runs" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_agent_runs_status_created" ON "agent_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_events_user_created" ON "audit_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_events_type_created" ON "audit_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "idx_command_executions_run_created" ON "command_executions" USING btree ("agent_run_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_conversations_user_updated" ON "conversations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_conversations_user_archived_updated" ON "conversations" USING btree ("user_id","archived","updated_at");--> statement-breakpoint
CREATE INDEX "idx_devices_user_id" ON "devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_file_operations_run_created" ON "file_operations" USING btree ("agent_run_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_conversation_sequence" ON "messages" USING btree ("conversation_id","sequence_no");--> statement-breakpoint
CREATE INDEX "idx_models_provider_active" ON "models" USING btree ("provider_id","active");--> statement-breakpoint
CREATE INDEX "idx_models_agent_active_priority" ON "models" USING btree ("supports_agent","active","priority_rank");--> statement-breakpoint
CREATE INDEX "idx_provider_attempts_provider_started" ON "provider_attempts" USING btree ("provider_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_provider_attempts_run_started" ON "provider_attempts" USING btree ("agent_run_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_provider_attempts_conversation_started" ON "provider_attempts" USING btree ("conversation_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_workspaces_user_last_used" ON "workspaces" USING btree ("user_id","last_used_at");