ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" varchar(20) DEFAULT 'customer' NOT NULL;

UPDATE "users"
SET "role" = 'admin'
WHERE "email" = COALESCE(current_setting('app.default_user_email', true), 'user@clm.local')
   OR "email" = 'user@clm.local';
