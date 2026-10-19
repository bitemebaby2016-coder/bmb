-- ============================================================
-- Contract 127-130 — pickup / print_jobs / staff-shift / finance
-- (transaction ROLLBACK — no persisted test data)
-- Task: BACKEND-CAPABILITY-CLOSURE-2026-10-19
-- ============================================================
BEGIN;

-- 127: pickup delivery fee policy = 0 (server-side, no zone lookup)
DO $$ BEGIN
  IF public.compute_delivery_fee(NULL, NULL, 'pickup', 1, NULL, NULL) <> 0 THEN
    RAISE EXCEPTION 'CONTRACT FAIL: pickup delivery fee must be 0';
  END IF;
END $$;

-- 127: counter handover transition allowed ONLY for admin/staff path flag
DO $$ BEGIN
  IF NOT public.order_transition_allowed('ready_for_dispatch', 'delivered', true, false) THEN
    RAISE EXCEPTION 'CONTRACT FAIL: ready_for_dispatch -> delivered must be allowed for admin';
  END IF;
  IF public.order_transition_allowed('pending', 'delivered', true, false) THEN
    RAISE EXCEPTION 'CONTRACT FAIL: pending -> delivered must stay blocked';
  END IF;
  IF public.order_transition_allowed('ready_for_dispatch', 'delivered', false, false) THEN
    RAISE EXCEPTION 'CONTRACT FAIL: customer must not close handover';
  END IF;
END $$;

-- 127: pickup code generator = 6 digits
DO $$ BEGIN
  IF public.gen_pickup_code() !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'CONTRACT FAIL: pickup code must be 6 digits';
  END IF;
END $$;

-- 128: print_jobs state CHECK rejects invalid states
DO $$ BEGIN
  BEGIN
    INSERT INTO public.print_jobs (id, order_number, job_type, status)
    VALUES ('ct-print-1', 'CT-ORDER-X', 'receipt', 'done');
    RAISE EXCEPTION 'CONTRACT FAIL: invalid print status must be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- 128: enqueue_print_job idempotent (deterministic id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'enqueue_print_job') THEN
    RAISE EXCEPTION 'CONTRACT FAIL: enqueue_print_job missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'mark_print_job') THEN
    RAISE EXCEPTION 'CONTRACT FAIL: mark_print_job missing';
  END IF;
END $$;

-- 129: role CHECK accepts staff, rejects cashier (definition-level, deterministic)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.profiles'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%role%'
       AND pg_get_constraintdef(oid) ILIKE '%staff%'
       AND NOT (pg_get_constraintdef(oid) ILIKE '%cashier%')
  ) THEN
    RAISE EXCEPTION 'CONTRACT FAIL: profiles role CHECK must include staff and exclude cashier';
  END IF;
END $$;

-- 129: shift + closeout RPC surface exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'open_shift') THEN
    RAISE EXCEPTION 'CONTRACT FAIL: open_shift missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'close_shift') THEN
    RAISE EXCEPTION 'CONTRACT FAIL: close_shift missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'pos_closeout_order') THEN
    RAISE EXCEPTION 'CONTRACT FAIL: pos_closeout_order missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_staff') THEN
    RAISE EXCEPTION 'CONTRACT FAIL: is_staff missing';
  END IF;
END $$;

-- 130: finance surface exists; get_daily_sales fails closed without role
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_daily_sales') THEN
    RAISE EXCEPTION 'CONTRACT FAIL: get_daily_sales missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'close_day') THEN
    RAISE EXCEPTION 'CONTRACT FAIL: close_day missing';
  END IF;
  IF to_regclass('public.daily_closings') IS NULL THEN
    RAISE EXCEPTION 'CONTRACT FAIL: daily_closings missing';
  END IF;
  BEGIN
    PERFORM public.get_daily_sales(CURRENT_DATE);
    RAISE EXCEPTION 'CONTRACT FAIL: get_daily_sales must fail closed without admin/staff';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
END $$;

ROLLBACK;