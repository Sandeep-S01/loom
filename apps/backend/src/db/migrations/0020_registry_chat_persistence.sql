ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "registry_model_id" varchar(50);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_registry_model_id_model_registry_id_fk'
  ) THEN
    ALTER TABLE "messages"
      ADD CONSTRAINT "messages_registry_model_id_model_registry_id_fk"
      FOREIGN KEY ("registry_model_id") REFERENCES "model_registry"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_messages_registry_model_created"
  ON "messages" ("registry_model_id", "created_at");

ALTER TABLE "provider_attempts"
  ADD COLUMN IF NOT EXISTS "registry_model_id" varchar(50);

ALTER TABLE "provider_attempts"
  ALTER COLUMN "model_id" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'provider_attempts_registry_model_id_model_registry_id_fk'
  ) THEN
    ALTER TABLE "provider_attempts"
      ADD CONSTRAINT "provider_attempts_registry_model_id_model_registry_id_fk"
      FOREIGN KEY ("registry_model_id") REFERENCES "model_registry"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_provider_attempts_registry_started"
  ON "provider_attempts" ("registry_model_id", "started_at");
