DROP INDEX IF EXISTS "idx_messages_conversation_sequence";
CREATE UNIQUE INDEX IF NOT EXISTS "uq_messages_conversation_sequence"
  ON "messages" USING btree ("conversation_id", "sequence_no");
