-- ============================================
-- Bite Me Baby â€” Phase 2 WP6 Integration Contract (PostgreSQL à¸ˆà¸£à¸´à¸‡)
-- Migration 226 (WAVG Posting + Reversal) Â· à¸£à¸±à¸™à¸šà¸™ fresh DB à¸«à¸¥à¸±à¸‡ apply 001â†’226
-- à¸„à¸£à¸­à¸š: post + WAVG, idempotency (retry same key / hash conflict / already posted),
--   line double-post guard, reversal (positive mirror + out tx + correction),
--   double-reversal reject, PO received/status transitions, role gate, rollback
-- ============================================

BEGIN;
RESET ROLE;

-- FIXTURES
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-000000c22601', 'c226-inv@example.com'),
  ('00000000-0000-4000-8000-000000c22602', 'c226-staff@example.com');

INSERT INTO public.branches (id, tenant_id, code, name, slug, address_line1, latitude, longitude)
VALUES ('branch-p2-a', 'tenant-bmb-001', 'p2a', 'P2 Branch A', 'p2a', '1 Test Rd', 13.7000000, 100.5000000)
ON CONFLICT (id) DO NOTHING;

UPDATE profiles SET role='inventory', tenant_id='tenant-bmb-001', branch_id='branch-p2-a' WHERE id='00000000-0000-4000-8000-000000c22601';
UPDATE profiles SET role='staff',     tenant_id='tenant-bmb-001', branch_id='branch-p2-a' WHERE id='00000000-0000-4000-8000-000000c22602';

INSERT INTO public.suppliers (id, name, code, phone, is_active)
VALUES ('sup-p2', 'P2 Supplier', 'P2SUP', '0990000001', true);
INSERT INTO public.inventory (id, name, category, current_stock, wavg_cost)
VALUES ('inv-p2', 'P2 Ingredient', 'p2test', 0, 0);
INSERT INTO public.supplier_products
  (id, supplier_id, ingredient_id, purchase_unit, use_unit, conversion_factor, is_active, last_approved_price)
VALUES ('sp-p2', 'sup-p2', 'inv-p2', 'carton', 'bottle', 12.0000, true, 120.0000);

INSERT INTO public.purchase_orders (id, po_number, supplier_id, status, requested_by, tenant_id, branch_id)
VALUES ('po-W6', 'PO-W6FIX', 'sup-p2', 'approved', '00000000-0000-4000-8000-000000c22602', 'tenant-bmb-001', 'branch-p2-a');
INSERT INTO public.purchase_order_lines
  (id, po_id, supplier_product_id, ingredient_id, ordered_qty, purchase_unit, use_unit, conversion_factor, unit_price)
VALUES ('pol-W6', 'po-W6', 'sp-p2', 'inv-p2', 10.0000, 'carton', 'bottle', 12.0000, 120.0000);

-- GRN approved: received 2 carton, accepted 2, actual price 132 (landed per purchase unit)
INSERT INTO public.goods_receipts (id, grn_number, po_id, supplier_id, status, tenant_id, branch_id)
VALUES ('grn-W6', 'GRN-W6FIX', 'po-W6', 'sup-p2', 'approved', 'tenant-bmb-001', 'branch-p2-a');
INSERT INTO public.goods_receipt_lines
  (id, grn_id, po_line_id, supplier_product_id, ingredient_id, received_qty, accepted_qty, rejected_qty,
   purchase_unit, use_unit, conversion_factor, actual_unit_price)
VALUES ('grl-W6', 'grn-W6', 'pol-W6', 'sp-p2', 'inv-p2', 2.0000, 2.0000, 0.0000, 'carton', 'bottle', 12.0000, 132.0000);

-- ============================================
-- T226.1 â€” functions exist
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='post_goods_receipt' AND pronamespace='public'::regnamespace) THEN
    RAISE EXCEPTION '226.1 FAIL: post_goods_receipt missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='reverse_grn' AND pronamespace='public'::regnamespace) THEN
    RAISE EXCEPTION '226.1 FAIL: reverse_grn missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='calculate_grn_line_landed_cost' AND pronamespace='public'::regnamespace) THEN
    RAISE EXCEPTION '226.1 FAIL: calculate_grn_line_landed_cost missing'; END IF;
  RAISE NOTICE '226.1 PASS: WP6 functions exist';
END $$;

-- ============================================
-- T226.2 â€” post + WAVG (accepted 2 carton = 24 use units @ landed 132/12=11)
-- ============================================
DO $$
DECLARE v_res JSONB; v_stock NUMERIC; v_wavg NUMERIC; v_itx INT; v_pol_received NUMERIC;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22601","role":"authenticated"}', false);
  SET ROLE authenticated;
  v_res := public.post_goods_receipt('grn-W6', 'idem-W6-1');
  RESET ROLE;
  IF (v_res->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION '226.2 FAIL: post not ok %', v_res; END IF;
  SELECT current_stock, wavg_cost INTO v_stock, v_wavg FROM inventory WHERE id='inv-p2';
  -- accepted 2 * 12 = 24 use units; landed per use = 132/12 = 11
  IF v_stock <> 24 THEN RAISE EXCEPTION '226.2 FAIL: stock=% (expect 24)', v_stock; END IF;
  IF v_wavg <> 11.0000 THEN RAISE EXCEPTION '226.2 FAIL: wavg=% (expect 11)', v_wavg; END IF;
  SELECT count(*) INTO v_itx FROM inventory_transactions WHERE grn_id='grn-W6' AND reference_type='grn';
  IF v_itx <> 1 THEN RAISE EXCEPTION '226.2 FAIL: itx count=% (expect 1)', v_itx; END IF;
  SELECT received_qty INTO v_pol_received FROM purchase_order_lines WHERE id='pol-W6';
  IF v_pol_received <> 2 THEN RAISE EXCEPTION '226.2 FAIL: po received=% (expect 2)', v_pol_received; END IF;
  RAISE NOTICE '226.2 PASS: post + WAVG (stock 24, wavg 11) + itx + po received 2';
END $$;

-- ============================================
-- T226.3 â€” idempotency: retry same key+hash returns idempotent (no double post)
-- ============================================
DO $$
DECLARE v_res JSONB; v_itx INT;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22601","role":"authenticated"}', false);
  SET ROLE authenticated;
  v_res := public.post_goods_receipt('grn-W6', 'idem-W6-1');
  RESET ROLE;
  IF (v_res->>'idempotent')::boolean IS NOT TRUE THEN RAISE EXCEPTION '226.3 FAIL: not idempotent %', v_res; END IF;
  SELECT count(*) INTO v_itx FROM inventory_transactions WHERE grn_id='grn-W6' AND reference_type='grn';
  IF v_itx <> 1 THEN RAISE EXCEPTION '226.3 FAIL: itx count=% after retry (expect 1)', v_itx; END IF;
  RAISE NOTICE '226.3 PASS: idempotent retry (no double post)';
END $$;

-- ============================================
-- T226.4 â€” idempotency conflict: same key different payload -> reject
-- (à¹à¸à¹‰ payload à¸‚à¸­à¸‡ GRN à¸«à¸¥à¸±à¸‡ post à¹à¸¥à¹‰à¸§ retry key à¹€à¸”à¸´à¸¡)
-- ============================================
DO $$
DECLARE v_ok BOOLEAN := false;
BEGIN
  -- mutate a line (superuser) to change payload hash
  UPDATE goods_receipt_lines SET actual_unit_price = 999 WHERE id='grl-W6';
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22601","role":"authenticated"}', false);
  SET ROLE authenticated;
  BEGIN
    PERFORM public.post_goods_receipt('grn-W6', 'idem-W6-1');
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'ERR_IDEMPOTENCY_CONFLICT%' THEN v_ok := true; END IF;
  END;
  RESET ROLE;
  IF NOT v_ok THEN RAISE EXCEPTION '226.4 FAIL: idempotency conflict not raised'; END IF;
  RAISE NOTICE '226.4 PASS: same key + different payload -> ERR_IDEMPOTENCY_CONFLICT';
END $$;

-- ============================================
-- T226.5 â€” already posted with different key -> reject
-- ============================================
DO $$
DECLARE v_ok BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22601","role":"authenticated"}', false);
  SET ROLE authenticated;
  BEGIN
    PERFORM public.post_goods_receipt('grn-W6', 'idem-W6-OTHER');
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'ERR_ALREADY_POSTED%' THEN v_ok := true; END IF;
  END;
  RESET ROLE;
  IF NOT v_ok THEN RAISE EXCEPTION '226.5 FAIL: already posted not raised'; END IF;
  RAISE NOTICE '226.5 PASS: posted + different key -> ERR_ALREADY_POSTED';
END $$;

-- ============================================
-- T226.6 â€” role gate: staff cannot post
-- ============================================
DO $$
DECLARE v_ok BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22602","role":"authenticated"}', false);
  SET ROLE authenticated;
  BEGIN
    PERFORM public.post_goods_receipt('grn-W6', 'idem-x');
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'ERR_FORBIDDEN%' THEN v_ok := true; END IF;
  END;
  RESET ROLE;
  IF NOT v_ok THEN RAISE EXCEPTION '226.6 FAIL: staff post not denied'; END IF;
  RAISE NOTICE '226.6 PASS: staff cannot post (role gate)';
END $$;

-- ============================================
-- T226.7 â€” reversal: positive mirror + out tx + stock down + po received down
-- (note: grl-W6 price was mutated to 999 in 226.4; landed from stored pph = 11)
-- ============================================
DO $$
DECLARE v_rev TEXT; v_stock NUMERIC; v_itx_out INT; v_pol_received NUMERIC; v_corr INT; v_orig_status TEXT;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22601","role":"authenticated"}', false);
  SET ROLE authenticated;
  v_rev := public.reverse_grn('grn-W6', 'test reversal');
  RESET ROLE;
  IF v_rev IS NULL THEN RAISE EXCEPTION '226.7 FAIL: reversal grn id null'; END IF;
  SELECT current_stock INTO v_stock FROM inventory WHERE id='inv-p2';
  IF v_stock <> 0 THEN RAISE EXCEPTION '226.7 FAIL: stock=% after reversal (expect 0)', v_stock; END IF;
  SELECT count(*) INTO v_itx_out FROM inventory_transactions WHERE grn_id=v_rev AND type='out';
  IF v_itx_out <> 1 THEN RAISE EXCEPTION '226.7 FAIL: out itx=% (expect 1)', v_itx_out; END IF;
  SELECT received_qty INTO v_pol_received FROM purchase_order_lines WHERE id='pol-W6';
  IF v_pol_received <> 0 THEN RAISE EXCEPTION '226.7 FAIL: po received=% (expect 0)', v_pol_received; END IF;
  SELECT count(*) INTO v_corr FROM purchase_price_history WHERE price_type='correction' AND grn_id=v_rev;
  IF v_corr <> 1 THEN RAISE EXCEPTION '226.7 FAIL: correction entries=% (expect 1)', v_corr; END IF;
  SELECT status INTO v_orig_status FROM goods_receipts WHERE id='grn-W6';
  IF v_orig_status <> 'reversed' THEN RAISE EXCEPTION '226.7 FAIL: orig status=% (expect reversed)', v_orig_status; END IF;
  RAISE NOTICE '226.7 PASS: reversal (stock 0, out itx, po received 0, correction, orig reversed)';
END $$;

-- ============================================
-- T226.8 â€” double reversal rejected (status gate + unique)
-- ============================================
DO $$
DECLARE v_ok BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22601","role":"authenticated"}', false);
  SET ROLE authenticated;
  BEGIN
    PERFORM public.reverse_grn('grn-W6', 'again');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ERR_INVALID_TRANSITION%' OR SQLERRM LIKE 'ERR_ALREADY_REVERSED%' THEN v_ok := true; END IF;
  END;
  RESET ROLE;
  IF NOT v_ok THEN RAISE EXCEPTION '226.8 FAIL: double reversal not rejected'; END IF;
  RAISE NOTICE '226.8 PASS: double reversal rejected';
END $$;

-- ============================================
-- T226.9 â€” line double-post guard (re-post a fresh approved GRN line twice)
-- ============================================
DO $$
DECLARE v_ok BOOLEAN := false;
BEGIN
  -- new approved GRN + line (superuser)
  INSERT INTO goods_receipts (id, grn_number, po_id, supplier_id, status, tenant_id, branch_id)
  VALUES ('grn-W6-B', 'GRN-W6FIX-B', 'po-W6', 'sup-p2', 'approved', 'tenant-bmb-001', 'branch-p2-a');
  INSERT INTO goods_receipt_lines
    (id, grn_id, po_line_id, supplier_product_id, ingredient_id, received_qty, accepted_qty, rejected_qty,
     purchase_unit, use_unit, conversion_factor, actual_unit_price)
  VALUES ('grl-W6-B', 'grn-W6-B', 'pol-W6', 'sp-p2', 'inv-p2', 1.0000, 1.0000, 0.0000, 'carton', 'bottle', 12.0000, 120.0000);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22601","role":"authenticated"}', false);
  SET ROLE authenticated;
  PERFORM public.post_goods_receipt('grn-W6-B', 'idem-W6-B');
  BEGIN
    PERFORM public.post_goods_receipt_line('grl-W6-B');
  EXCEPTION WHEN OTHERS THEN
    -- GRN status is posted (status gate) or line guard — both prevent double-post
    IF SQLERRM LIKE 'ERR_LINE_ALREADY_POSTED%' OR SQLERRM LIKE 'ERR_GRN_NOT_APPROVED%' THEN v_ok := true; END IF;
  END;
  RESET ROLE;
  IF NOT v_ok THEN RAISE EXCEPTION '226.9 FAIL: line double-post not blocked'; END IF;
  RAISE NOTICE '226.9 PASS: line double-post guard';
END $$;

ROLLBACK;
