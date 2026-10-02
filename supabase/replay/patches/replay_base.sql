-- REPLAY BASE PATCH (ISOLATED LOCAL ONLY) â€” bare supabase/postgres precondition
-- The bare supabase/postgres image does not create the storage schema
-- (that is done by the storage-api service in a full stack). Replay storage
-- policies need a minimal skeleton. Schema-only: no data, no grants change.
-- (2) auth.jwt() stub (created by gotrue service in a full stack). Reads the
-- same request.jwt.claims GUC the tests set - identical contract.
-- Requires supabase_auth_admin membership for postgres (replay.ps1 bootstrap).
SET ROLE supabase_auth_admin;
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $fn$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$fn$;
SET ROLE supabase_auth_admin;
-- (4) auth.uid() contract alignment: this bare image reads the per-claim GUC
-- request.jwt.claim.sub, while the full stack (gotrue init) reads the JSON
-- request.jwt.claims. Tests/fixtures use the full-stack contract - align.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $fuid$
  SELECT nullif((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'sub'), '')::uuid
$fuid$;
-- (3) gotrue users-table columns the full stack has but the bare image's
--     older auth skeleton lacks (seed fixtures need them).
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS phone_confirmed_at timestamptz;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_change_token_new text;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_change_sent_at timestamptz;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS phone_change_token text;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS phone_change_sent_at timestamptz;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS reauthentication_token text;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS reauthentication_sent_at timestamptz;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS banned_until timestamptz;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, confirmed_at, now());
RESET ROLE;

CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  public boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id uuid REFERENCES storage.buckets (id),
  name text,
  created_at timestamptz DEFAULT now()
);
GRANT USAGE ON SCHEMA storage TO public;
GRANT SELECT ON storage.buckets TO public;
GRANT SELECT ON storage.objects TO public;





