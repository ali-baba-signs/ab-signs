BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "twoFactorEnabled" boolean NOT NULL DEFAULT true;

UPDATE users SET "twoFactorEnabled" = true WHERE "twoFactorEnabled" IS DISTINCT FROM true;

CREATE TABLE IF NOT EXISTS two_factors (
  id text PRIMARY KEY,
  "userId" text NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  secret text NOT NULL DEFAULT 'email-otp-only',
  "backupCodes" text NOT NULL DEFAULT '[]',
  verified boolean NOT NULL DEFAULT true,
  "failedVerificationCount" integer NOT NULL DEFAULT 0,
  "lockedUntil" timestamp
);

INSERT INTO two_factors (id, "userId")
SELECT gen_random_uuid()::text, id FROM users
ON CONFLICT ("userId") DO NOTHING;

CREATE OR REPLACE FUNCTION ensure_customer_email_mfa()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."twoFactorEnabled" := true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_require_email_mfa ON users;
CREATE TRIGGER users_require_email_mfa
BEFORE INSERT OR UPDATE OF "twoFactorEnabled" ON users
FOR EACH ROW EXECUTE FUNCTION ensure_customer_email_mfa();

CREATE OR REPLACE FUNCTION create_customer_email_mfa_record()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO two_factors (id, "userId")
  VALUES (gen_random_uuid()::text, NEW.id)
  ON CONFLICT ("userId") DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_create_email_mfa_record ON users;
CREATE TRIGGER users_create_email_mfa_record
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION create_customer_email_mfa_record();

COMMIT;
