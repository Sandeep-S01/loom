CREATE INDEX IF NOT EXISTS "idx_audit_events_created"
  ON "audit_events" ("created_at");

CREATE INDEX IF NOT EXISTS "idx_audit_events_subject_created"
  ON "audit_events" ("subject_type", "subject_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_audit_events_device_created"
  ON "audit_events" ("device_id", "created_at");
