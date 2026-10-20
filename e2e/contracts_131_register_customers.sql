-- ============================================================
-- Contract 131 — signup must register the customer (ROLLBACK)
-- (transaction ROLLBACK — no persisted test data)
-- Task: registered users must appear in customers (2026-10-20)
-- ============================================================
BEGIN;

-- trigger present on auth.users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'auth' AND c.relname = 'users'
      AND t.tgname = 'on_auth_user_created' AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'CONTRACT FAIL: on_auth_user_created trigger missing on auth.users';
  END IF;
END $$;

-- signup creates BOTH profiles + customers (017 key convention)
DO $$
DECLARE
  v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, phone, raw_user_meta_data)
  VALUES (v_id, 'ct131@example.com', '0812345678', jsonb_build_object('full_name', 'Contract 131'));

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_id AND role = 'customer') THEN
    RAISE EXCEPTION 'CONTRACT FAIL: signup must create profiles row (role customer)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.customers
    WHERE id = v_id::text AND user_id = v_id
      AND full_name = 'Contract 131' AND phone = '0812345678'
      AND email = 'ct131@example.com'
  ) THEN
    RAISE EXCEPTION 'CONTRACT FAIL: signup must create customers row (id=uid text, user_id=uid)';
  END IF;
END $$;

-- signup without name → readable fallback (full_name NOT NULL)
DO $$
DECLARE
  v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_id, 'noname131@example.com');
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = v_id::text AND full_name <> '') THEN
    RAISE EXCEPTION 'CONTRACT FAIL: customers.full_name must never be empty';
  END IF;
END $$;

ROLLBACK;