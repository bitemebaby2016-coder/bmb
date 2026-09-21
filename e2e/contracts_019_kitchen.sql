-- ============================================
-- Bite Me Baby — QA-03 SQL Contract Suite for migration 019 (OWNER: SQL Editor)
-- ALL tests run inside a transaction that ROLLS BACK — zero production writes persist.
-- Must pass AFTER:  supabase db push   (migration 019)
-- ============================================
BEGIN;

DO $$
DECLARE
  v_prod public.products%ROWTYPE;
  v_round public.delivery_rounds%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_result jsonb;
  v_req jsonb;
  v_stock numeric;
BEGIN
  -- 0) functions exist
  IF to_regprocedure('public.deduct_inventory_for_order(text)') IS NULL
     OR to_regprocedure('public.restore_inventory_for_order(text)') IS NULL
     OR to_regprocedure('public.create_production_batch(text,date)') IS NULL
     OR to_regprocedure('public.kitchen_queue(text,date)') IS NULL
     OR to_regprocedure('public.get_inventory_requirements(text,integer)') IS NULL THEN
    RAISE EXCEPTION 'FAIL kitchen RPCs missing';
  END IF;

  -- 1) recipes seed present
  IF NOT EXISTS (SELECT 1 FROM public.recipes) THEN
    RAISE EXCEPTION 'FAIL recipes seed missing';
  END IF;

  -- 2) pick an open round
  SELECT * INTO v_round FROM public.delivery_rounds
   WHERE status IN ('active','open','scheduled') AND current_count < max_capacity
   ORDER BY current_count ASC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'SKIP no open round with capacity'; END IF;

  -- 3) reset stock snapshot, create a test order via 007-style RPC (as service ctx),
  --    then deduct + verify stock decreased + restore + verify back.
  --    (this exercise uses a synthetic order row to stay inside the rollback txn)
  INSERT INTO public.orders (id, order_number, customer_id, customer_name, customer_phone,
                             delivery_round_id, status, delivery_method, payment_method, total_amount)
  VALUES ('qa-kitchen-probe', 'QA-KITCHEN-001', 'qa-cust', 'QA Kitchen', '0800000000',
          v_round.id, 'pending', 'self_delivery', 'promptpay_qr', 0)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.order_items (id, order_id, product_id, product_name, quantity, unit_price)
  SELECT 'qa-kitchen-oi-1', 'qa-kitchen-probe', r.product_id, p.name, 2, p.price
    FROM public.recipes r JOIN public.products p ON p.id = r.product_id
   LIMIT 1;

  SELECT current_stock INTO v_stock FROM public.inventory WHERE id = (SELECT ingredient_id FROM public.recipes LIMIT 1);

  v_result := public.deduct_inventory_for_order('QA-KITCHEN-001');
  IF (SELECT current_stock FROM public.inventory WHERE id = (SELECT ingredient_id FROM public.recipes LIMIT 1)) >= v_stock THEN
    RAISE EXCEPTION 'FAIL deduct did not reduce stock';
  END IF;

  v_result := public.restore_inventory_for_order('QA-KITCHEN-001');
  IF (SELECT current_stock FROM public.inventory WHERE id = (SELECT ingredient_id FROM public.recipes LIMIT 1)) <> v_stock THEN
    RAISE EXCEPTION 'FAIL restore did not return stock';
  END IF;

  -- 4) inventory requirements query
  v_req := public.get_inventory_requirements((SELECT product_id FROM public.recipes LIMIT 1), 1);
  IF (v_req->>'ok')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL get_inventory_requirements';
  END IF;

  -- 5) production batch from the probe order (confirmed) + queue read
  UPDATE public.orders SET status = 'confirmed' WHERE order_number = 'QA-KITCHEN-001';
  v_result := public.create_production_batch(v_round.id, CURRENT_DATE);
  IF (v_result->>'items_count')::integer < 1 THEN
    RAISE EXCEPTION 'FAIL create_production_batch items_count=0';
  END IF;
  v_result := public.kitchen_queue(v_round.id, CURRENT_DATE);
  IF NOT (v_result->>'batches')::jsonb @> '[{"status":"open"}]' THEN
    RAISE EXCEPTION 'FAIL kitchen_queue did not list batch';
  END IF;

  RAISE NOTICE 'QA-03 migration 019 SQL suite PASS (transaction rolled back — no writes persisted)';
END $$;

ROLLBACK;
-- ============================================
-- END — paste output into e2e/contracts-019-kitchen-sql-result.txt (owner action, read-only)
-- ============================================