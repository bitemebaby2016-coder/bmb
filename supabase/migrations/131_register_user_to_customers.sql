-- ============================================================
-- 131 — signup → customers registry (registered users must appear)
-- Problem (2026-10-20):
--   handle_new_user() (006) only created profiles — the admin
--   "customers" page reads public.customers, which the signup path
--   never wrote to, so registered users never appeared in the list.
-- Fix:
--   1) handle_new_user() also upserts customers — key convention from
--      017_pre_order_server_authoritative: customers.id = auth uid (TEXT),
--      customers.user_id = auth uid (uuid).
--   2) Backfill: every existing profiles row gets a customers row.
-- Safety:
--   * idempotent / re-run safe (ON CONFLICT fills blanks only — never
--     clobbers an existing name/phone/email)
--   * profiles behavior unchanged (ON CONFLICT DO NOTHING)
--   * is_admin()/is_staff()/RLS untouched
-- Verified: replay 001-131 clean on PG17 · e2e/contracts_131_register_customers.sql
-- ============================================================

-- ---------- 1. handle_new_user() → profiles + customers ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_name  TEXT;
BEGIN
  v_phone := NULLIF(COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''), '');
  v_name  := NULLIF(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), '');

  INSERT INTO public.profiles (id, email, phone, name, role, is_active)
  VALUES (NEW.id, NULLIF(NEW.email, ''), v_phone, v_name, 'customer', true)
  ON CONFLICT (id) DO NOTHING;

  -- customers registry row (same key convention as 017 pre-order flow)
  INSERT INTO public.customers (id, user_id, full_name, phone, email)
  VALUES (
    NEW.id::text,
    NEW.id,
    COALESCE(v_name, 'Customer'),
    v_phone,
    NULLIF(NEW.email, '')
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id    = COALESCE(customers.user_id, EXCLUDED.user_id),
    full_name  = COALESCE(NULLIF(btrim(COALESCE(customers.full_name, '')), ''), EXCLUDED.full_name),
    phone      = COALESCE(NULLIF(btrim(COALESCE(customers.phone, '')), ''), EXCLUDED.phone),
    email      = COALESCE(NULLIF(btrim(COALESCE(customers.email, '')), ''), EXCLUDED.email),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- 2. backfill existing accounts (idempotent) ----------
INSERT INTO public.customers (id, user_id, full_name, phone, email)
SELECT
  p.id::text,
  p.id,
  COALESCE(NULLIF(btrim(COALESCE(p.name, '')), ''), 'Customer'),
  NULLIF(btrim(COALESCE(p.phone, '')), ''),
  NULLIF(btrim(COALESCE(p.email, '')), '')
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = p.id::text)
ON CONFLICT (id) DO NOTHING;