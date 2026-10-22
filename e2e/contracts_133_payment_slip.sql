-- ============================================
-- Bite Me Baby — SQL Contract: Migration 133 payment slip upload
-- Date: 2026-10-20 · Run on ephemeral PG17 (apply_all_migrations.sh) or SQL Editor
-- ONE transaction, ROLLBACK at the end — zero persisted data.
--
-- Proves:
--   G1  bucket `payment-slips` exists + PRIVATE + both storage policies present
--   G2  payment_intents.slip_path / slip_uploaded_at columns exist
--   G3  submit_payment_slip: SECURITY DEFINER + EXECUTE authenticated only (no anon)
--   G4  owner attaches slip on pending promptpay intent → processing + slip_path
--       recorded; re-upload while processing replaces the path (evidence updated)
--   G5  path outside the caller's own folder → ERR_SLIP_PATH_FORBIDDEN
--   G6  non-owner / no pending promptpay → ERR_NO_PENDING_PROMPTPAY
--   G7  slip-only submit still requires admin confirm_offline_payment → paid
--       (client can NEVER mark paid — canonical authority unchanged)
-- ============================================

BEGIN;
RESET ROLE;

-- ============================================
-- 0. FIXTURES (admin / owner / stranger)
-- ============================================
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('71717171-7171-7171-7171-717171717171', 'c133-admin@bmb.test',   'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('72727272-7272-7272-7272-727272727272', 'c133-owner@bmb.test',   'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('73737373-7373-7373-7373-737373737373', 'c133-stranger@bmb.test','x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, role, created_at, updated_at)
VALUES
  ('71717171-7171-7171-7171-717171717171', 'admin',    now(), now()),
  ('72727272-7272-7272-7272-727272727272', 'customer', now(), now()),
  ('73737373-7373-7373-7373-737373737373', 'customer', now(), now())
ON CONFLICT (id) DO NOTHING;
UPDATE public.profiles SET role = 'admin'    WHERE id = '71717171-7171-7171-7171-717171717171';
UPDATE public.profiles SET role = 'customer' WHERE id IN (
  '72727272-7272-7272-7272-727272727272',
  '73737373-7373-7373-7373-737373737373');

-- harness parity: Supabase มี default table grants ให้ authenticated (RLS คุมแถว);
-- prelude ของ replay ไม่มี → ให้สิทธิ์ชั่วคราวใน transaction นี้ (ROLLBACK ตอนจบ)
GRANT SELECT ON public.orders, public.payment_intents TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_payment_slip(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_offline_payment(text) TO authenticated;

INSERT INTO public.orders (id, order_number, status, customer_name, customer_phone, total_amount, payment_method, payment_status, customer_ref, created_at, updated_at)
VALUES ('ord-BMB-C133-1', 'BMB-C133-1', 'confirmed', 'QA133', '0990001331', 173, 'promptpay_qr', 'pending', '72727272-7272-7272-7272-727272727272', NOW(), NOW())
ON CONFLICT (order_number) DO NOTHING;

INSERT INTO public.payment_intents (id, order_number, amount, currency, status, method, provider, metadata, created_at, updated_at)
VALUES ('pi-c133-1', 'BMB-C133-1', 173, 'thb', 'pending', 'promptpay_qr', 'promptpay', '{}', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- G1 storage bucket + policies
-- ============================================
DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'payment-slips' AND public = false
  ), 'G1 bucket payment-slips must exist and be PRIVATE';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'payment_slips_customer_upload'
  ), 'G1 upload policy missing';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'payment_slips_admin_or_owner_read'
  ), 'G1 read policy missing';
  RAISE NOTICE 'G1 OK — payment-slips bucket PRIVATE + policies';
END $$;

-- ============================================
-- G2 columns + G3 function security
-- ============================================
DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'payment_intents' AND column_name = 'slip_path'
  ), 'G2 payment_intents.slip_path missing';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'payment_intents' AND column_name = 'slip_uploaded_at'
  ), 'G2 payment_intents.slip_uploaded_at missing';
  ASSERT (SELECT prosecdef FROM pg_proc WHERE proname = 'submit_payment_slip') = true,
    'G3 submit_payment_slip must be SECURITY DEFINER';
  ASSERT NOT has_function_privilege('anon', 'public.submit_payment_slip(text,text)', 'EXECUTE'),
    'G3 anon must NOT execute submit_payment_slip';
  ASSERT has_function_privilege('authenticated', 'public.submit_payment_slip(text,text)', 'EXECUTE'),
    'G3 authenticated must execute submit_payment_slip';
  RAISE NOTICE 'G2 G3 OK — columns + SECURITY DEFINER + grants';
END $$;

-- ============================================
-- G4 owner attaches slip: pending → processing + evidence recorded
-- ============================================
DO $$
DECLARE v_r jsonb;
BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"72727272-7272-7272-7272-727272727272","role":"authenticated"}', false);

  v_r := public.submit_payment_slip('BMB-C133-1', '72727272-7272-7272-7272-727272727272/BMB-C133-1-1.jpg');
  ASSERT v_r->>'ok' = 'true', 'G4 submit expected ok, got: ' || v_r::text;
  ASSERT (SELECT status FROM public.payment_intents WHERE id = 'pi-c133-1') = 'processing',
    'G4 pending must move to processing';
  ASSERT (SELECT slip_path FROM public.payment_intents WHERE id = 'pi-c133-1')
       = '72727272-7272-7272-7272-727272727272/BMB-C133-1-1.jpg', 'G4 slip_path must be recorded';
  ASSERT (SELECT slip_uploaded_at FROM public.payment_intents WHERE id = 'pi-c133-1') IS NOT NULL,
    'G4 slip_uploaded_at must be set';

  -- G4b re-upload while processing — evidence updated, state untouched
  v_r := public.submit_payment_slip('BMB-C133-1', '72727272-7272-7272-7272-727272727272/BMB-C133-1-2.jpg');
  ASSERT v_r->>'ok' = 'true', 'G4b re-upload expected ok, got: ' || v_r::text;
  ASSERT (SELECT slip_path FROM public.payment_intents WHERE id = 'pi-c133-1')
       = '72727272-7272-7272-7272-727272727272/BMB-C133-1-2.jpg', 'G4b slip_path must be replaced';
  ASSERT (SELECT status FROM public.payment_intents WHERE id = 'pi-c133-1') = 'processing',
    'G4b re-upload must not change status';

  RESET ROLE;
  RAISE NOTICE 'G4 OK — slip evidence recorded (pending → processing)';
END $$;

-- ============================================
-- G5 path outside own folder → ERR_SLIP_PATH_FORBIDDEN
-- ============================================
DO $$
DECLARE v_raised boolean := false;
BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"72727272-7272-7272-7272-727272727272","role":"authenticated"}', false);
  BEGIN
    PERFORM public.submit_payment_slip('BMB-C133-1', '73737373-7373-7373-7373-737373737373/steal.jpg');
  EXCEPTION WHEN raise_exception THEN
    v_raised := true;
    ASSERT SQLERRM LIKE '%ERR_SLIP_PATH_FORBIDDEN%', 'G5 got: ' || SQLERRM;
  END;
  ASSERT v_raised, 'G5 expected ERR_SLIP_PATH_FORBIDDEN but no error was raised';
  RESET ROLE;
  RAISE NOTICE 'G5 OK — foreign-folder path rejected';
END $$;

-- ============================================
-- G6 non-owner → ERR_NO_PENDING_PROMPTPAY (no row is touched)
-- ============================================
DO $$
DECLARE v_raised boolean := false;
BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"73737373-7373-7373-7373-737373737373","role":"authenticated"}', false);
  BEGIN
    PERFORM public.submit_payment_slip('BMB-C133-1', '73737373-7373-7373-7373-737373737373/BMB-C133-1-x.jpg');
  EXCEPTION WHEN raise_exception THEN
    v_raised := true;
    ASSERT SQLERRM LIKE '%ERR_NO_PENDING_PROMPTPAY%', 'G6 got: ' || SQLERRM;
  END;
  ASSERT v_raised, 'G6 expected ERR_NO_PENDING_PROMPTPAY but no error was raised';
  RESET ROLE;
  ASSERT (SELECT slip_path FROM public.payment_intents WHERE id = 'pi-c133-1')
       = '72727272-7272-7272-7272-727272727272/BMB-C133-1-2.jpg', 'G6 stranger must not alter slip evidence';
  RAISE NOTICE 'G6 OK — non-owner rejected';
END $$;

-- ============================================
-- G7 slip-only submit still needs ADMIN confirm (canonical authority)
-- ============================================
DO $$
DECLARE v_r jsonb;
BEGIN
  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"71717171-7171-7171-7171-717171717171","role":"authenticated"}', false);

  -- customer view: attaching a slip NEVER flips orders.payment_status
  RESET ROLE;
  ASSERT (SELECT payment_status FROM public.orders WHERE order_number = 'BMB-C133-1') = 'pending',
    'G7 slip must NOT mark the order paid';

  PERFORM set_config('role', 'authenticated', false);
  PERFORM set_config('request.jwt.claims', '{"sub":"71717171-7171-7171-7171-717171717171","role":"authenticated"}', false);
  v_r := public.confirm_offline_payment('BMB-C133-1');
  ASSERT v_r->>'ok' = 'true', 'G7 admin confirm expected ok, got: ' || v_r::text;
  RESET ROLE;
  ASSERT (SELECT payment_status FROM public.orders WHERE order_number = 'BMB-C133-1') = 'paid',
    'G7 admin confirm must mark paid';
  ASSERT (SELECT status FROM public.payment_intents WHERE id = 'pi-c133-1') = 'completed',
    'G7 intent must complete';
  RAISE NOTICE 'G7 OK — admin remains the sole payment authority';
END $$;

RESET ROLE;
ROLLBACK;
-- ============================================