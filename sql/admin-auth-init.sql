-- Dedicated Better Auth tables for the admin security boundary.
-- Run this migration before enabling the separate admin login in production.
CREATE TABLE IF NOT EXISTS admin_users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  image text,
  role text NOT NULL DEFAULT 'admin',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  "expiresAt" timestamp NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_accounts (
  id text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamp,
  "refreshTokenExpiresAt" timestamp,
  scope text,
  password text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_verifications (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_accounts_user_provider_idx
  ON admin_accounts ("userId", "providerId");

CREATE INDEX IF NOT EXISTS admin_users_lower_email_idx
  ON admin_users (lower(email));

-- Bootstrap or reset an admin credential from a SQL console.
--
-- The third argument is temporarily stored as plain text. The admin login API
-- verifies it once and immediately replaces it with Better Auth's scrypt hash.
-- Use this only for initial provisioning/recovery, then log in immediately.
-- Prefer a unique temporary password that has never been used elsewhere.
--
-- Example:
-- SELECT provision_admin(
--   'owner@example.com',
--   'Store Owner',
--   'replace-with-a-unique-temporary-password'
-- );
CREATE OR REPLACE FUNCTION provision_admin(
  p_email text,
  p_name text,
  p_plaintext_password text
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_email text := lower(btrim(p_email));
  v_user_id text;
  v_account_id text;
BEGIN
  IF v_email IS NULL OR v_email = '' OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'A valid admin email address is required';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'An admin name is required';
  END IF;

  IF p_plaintext_password IS NULL
     OR length(p_plaintext_password) < 12
     OR length(p_plaintext_password) > 256 THEN
    RAISE EXCEPTION 'The temporary admin password must contain between 12 and 256 characters';
  END IF;

  SELECT id
    INTO v_user_id
    FROM admin_users
   WHERE lower(email) = v_email
   ORDER BY "createdAt"
   LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid()::text;
    INSERT INTO admin_users (
      id, name, email, "emailVerified", role, "createdAt", "updatedAt"
    ) VALUES (
      v_user_id, btrim(p_name), v_email, true, 'admin', now(), now()
    );
  ELSE
    UPDATE admin_users
       SET name = btrim(p_name),
           "emailVerified" = true,
           role = 'admin',
           "updatedAt" = now()
     WHERE id = v_user_id;
  END IF;

  SELECT id
    INTO v_account_id
    FROM admin_accounts
   WHERE "userId" = v_user_id
     AND "providerId" = 'credential'
   ORDER BY "createdAt"
   LIMIT 1;

  IF v_account_id IS NULL THEN
    INSERT INTO admin_accounts (
      id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid()::text,
      v_user_id,
      'credential',
      v_user_id,
      'plain$' || p_plaintext_password,
      now(),
      now()
    );
  ELSE
    UPDATE admin_accounts
       SET password = 'plain$' || p_plaintext_password,
           "updatedAt" = now()
     WHERE id = v_account_id;
  END IF;

  -- A password reset invalidates any existing admin sessions.
  DELETE FROM admin_sessions WHERE "userId" = v_user_id;

  RETURN v_user_id;
END;
$$;
