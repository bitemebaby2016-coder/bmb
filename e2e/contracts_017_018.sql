-- ============================================
-- Bite Me Baby — QA-03 SQL Contract Suite for migrations 017/018 (OWNER: SQL Editor)
-- ALL tests run inside a transaction that ROLLS BACK — zero production writes persist.
-- Must pass AFTER:  supabase db push   (migrations 017 + 018)
-- ============================================
BEGIN;

-- helper assertion: raise on failure
DO $$
DECLARE
  v_prod public.products%ROWTYPE;
  v_round public.delivery_rounds%ROWTYPE;
  v_result jsonb;
  v_has fn%TYPE;
  v_audit_count integer;
BEGIN
  -- 0) functions exist
  IF to_regprocedure('public.create_pre_order_with_items(text,integer,text,date,text,text,numeric,numeric,text,text)') IS NULL
     THEN RAISE EXCEPTION 'FAIL create_pre_order_with_items missing'; END IF;
  IF to_regprocedure('public.quote_pre_order(text,integer)') IS NULL
     THEN RAISE EXCEPTION 'FAIL quote_pre_order missing'; END IF;
  IF to_regprocedure('public.cancel_pre_order(text)') IS NULL
     THEN RAISE EXCEPTION 'FAIL cancel_pre_order missing'; END IF;
  IF to_regprocedure('public.append_audit_log(text,text,text,text,jsonb,text)') IS NULL
     THEN RAISE EXCEPTION 'FAIL append_audit_log missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'orders_guard_status_transition')
     THEN RAISE EXCEPTION 'FAIL orders status trigger missing'; END IF;

  -- 1) pick a pre-order product + open round with spare capacity
  SELECT * INTO v_prod FROM public.products WHERE is_preorder = true ORDER BY created_at LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'SKIP no pre-order product seeded'; END IF;
  SELECT * INTO v_round FROM public.delivery_rounds
   WHERE status IN ('active','open','scheduled') AND current_count < max_capacity
   ORDER BY current_count ASC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'SKIP no open round with capacity'; END IF;

  -- 2) create a pre-order via the RPC (price must match products.price)
  v_result := public.create_pre_order_with_items(
    p_product_id := v_prod.id,
    p_quantity := 2,
    p_delivery_round_id := v_round.id,
    p_scheduled_date := v_round.scheduled_date,
    p_customer_name := 'QA Contract',
    p_customer_phone := '0800000000'
  );
  IF (v_result->>'unit_price')::numeric <> v_prod.price THEN
    RAISE EXCEPTION 'FAIL unit_price not authoritative: got %', v_result->>'unit_price';
  END IF;
  IF (v_result->>'total_amount')::numeric <> round(v_prod.price * 2, 2) THEN
    RAISE EXCEPTION 'FAIL total_amount wrong: got %', v_result->>'total_amount';
  END IF;

  -- 3) cancel it (capacity refund path)
  v_result := public.cancel_pre_order(p_order_number := v_result->>'order_number');
  IF v_result->>'status' <> 'cancelled' THEN
    RAISE EXCEPTION 'FAIL cancel_pre_order did not cancel';
  END IF;

  -- 4) append_audit_log writes a row (even inside this rollback txn)
  v_result := public.append_audit_log('qa_probe','order',NULL,'qa sql contract');
  SELECT count(*) INTO v_audit_count FROM public.audit_logs WHERE action = 'qa_probe';
  IF v_audit_count < 1 THEN RAISE EXCEPTION 'FAIL append_audit_log no row'; END IF;

  RAISE NOTICE 'QA-03 017/018 SQL suite PASS (transaction rolled back — no writes persisted)';
END $$;

ROLLBACK;
-- ============================================
-- END — paste output into e2e/contracts-017-018-sql-result.txt (owner action, read-only)
-- ============================================