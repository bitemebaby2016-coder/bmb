-- ============================================
-- Bite Me Baby — Phase 2 WP4 Integration Contract (PostgreSQL จริง)
-- Migration 225 (GRN Workflow RPC) · รันบน fresh DB หลัง apply 001→225
-- Pattern เดียวกับ contracts_wp2_224:
--   BEGIN ... ROLLBACK · set_config jwt + SET ROLE authenticated
-- ครอบ: number-gen, partial/multi receipt, over-receive reject,
--   accepted/rejected balance, conversion snapshot, role gate, branch scope, audit
-- ============================================

BEGIN;
RESET ROLE;

-- FIXTURES
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-000000c22501', 'c225-inv-a@example.com'),
  ('00000000-0000-4000-8000-000000c22502', 'c225-inv-b@example.com'),
  ('00000000-0000-4000-8000-000000c22503', 'c225-staff@example.com');

INSERT INTO public.branches (id, tenant_id, code, name, slug, address_line1, latitude, longitude)
VALUES
  ('branch-p2-a', 'tenant-bmb-001', 'p2a', 'P2 Branch A', 'p2a', '1 Test Rd', 13.7000000, 100.5000000),
  ('branch-p2-b', 'tenant-bmb-001', 'p2b', 'P2 Branch B', 'p2b', '2 Test Rd', 13.8000000, 100.6000000)
ON CONFLICT (id) DO NOTHING;

UPDATE profiles SET role='inventory', tenant_id='tenant-bmb-001', branch_id='branch-p2-a' WHERE id='00000000-0000-4000-8000-000000c22501';
UPDATE profiles SET role='inventory', tenant_id='tenant-bmb-001', branch_id='branch-p2-b' WHERE id='00000000-0000-4000-8000-000000c22502';
UPDATE profiles SET role='staff',     tenant_id='tenant-bmb-001', branch_id='branch-p2-a' WHERE id='00000000-0000-4000-8000-000000c22503';

INSERT INTO public.suppliers (id, name, code, phone, is_active)
VALUES ('sup-p2', 'P2 Supplier', 'P2SUP', '0990000001', true);

INSERT INTO public.inventory (id, name, category)
VALUES ('inv-p2', 'P2 Ingredient', 'p2test');

INSERT INTO public.supplier_products
  (id, supplier_id, ingredient_id, purchase_unit, use_unit, conversion_factor, is_active, last_approved_price)
VALUES ('sp-p2', 'sup-p2', 'inv-p2', 'carton', 'bottle', 12.0000, true, 120.0000);

-- PO approved (receivable) branch A + PO branch B (cross-branch test)
INSERT INTO public.purchase_orders (id, po_number, supplier_id, status, requested_by, tenant_id, branch_id)
VALUES
  ('po-W4-A', 'PO-W4FIX-A', 'sup-p2', 'approved', '00000000-0000-4000-8000-000000c22503', 'tenant-bmb-001', 'branch-p2-a'),
  ('po-W4-B', 'PO-W4FIX-B', 'sup-p2', 'approved', '00000000-0000-4000-8000-000000c22503', 'tenant-bmb-001', 'branch-p2-b');

INSERT INTO public.purchase_order_lines
  (id, po_id, supplier_product_id, ingredient_id, ordered_qty, purchase_unit, use_unit, conversion_factor, unit_price)
VALUES
  ('pol-W4-A', 'po-W4-A', 'sp-p2', 'inv-p2', 10.0000, 'carton', 'bottle', 12.0000, 120.0000),
  ('pol-W4-B', 'po-W4-B', 'sp-p2', 'inv-p2', 10.0000, 'carton', 'bottle', 12.0000, 120.0000);

-- ============================================
-- T225.1 — functions exist
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='generate_grn_number' AND pronamespace='public'::regnamespace) THEN
    RAISE EXCEPTION '225.1 FAIL: generate_grn_number missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='create_grn_draft' AND pronamespace='public'::regnamespace) THEN
    RAISE EXCEPTION '225.1 FAIL: create_grn_draft missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='approve_grn' AND pronamespace='public'::regnamespace) THEN
    RAISE EXCEPTION '225.1 FAIL: approve_grn missing'; END IF;
  RAISE NOTICE '225.1 PASS: 3 GRN workflow functions exist';
END $$;

-- ============================================
-- T225.2 — number format GRN-YYYYMMDD-{seq}
-- ============================================
DO $$
DECLARE v_num TEXT;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22501","role":"authenticated"}', false);
  SET ROLE authenticated;
  v_num := public.generate_grn_number();
  RESET ROLE;
  IF v_num !~ '^GRN-[0-9]{8}-[0-9]{4}$' THEN RAISE EXCEPTION '225.2 FAIL: bad grn_number %', v_num; END IF;
  RAISE NOTICE '225.2 PASS: grn_number format OK (%)', v_num;
END $$;

-- ============================================
-- T225.3 — create draft (partial) + conversion snapshot + inherited org
-- ============================================
DO $$
DECLARE v_res JSONB; v_id TEXT; v_grn goods_receipts%ROWTYPE; v_grl goods_receipt_lines%ROWTYPE;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22501","role":"authenticated"}', false);
  SET ROLE authenticated;
  v_res := public.create_grn_draft('po-W4-A',
    '[{"po_line_id":"pol-W4-A","received_qty":3,"accepted_qty":2,"rejected_qty":1,"actual_unit_price":125,"lot_number":"LOT1"}]'::jsonb,
    NULL, NULL, 'first receipt');
  RESET ROLE;
  v_id := v_res->>'grn_id';
  IF (v_res->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION '225.3 FAIL: not ok %', v_res; END IF;
  SELECT * INTO v_grn FROM goods_receipts WHERE id = v_id;
  IF v_grn.tenant_id <> 'tenant-bmb-001' OR v_grn.branch_id <> 'branch-p2-a' THEN
    RAISE EXCEPTION '225.3 FAIL: org not inherited from PO (%/%)', v_grn.tenant_id, v_grn.branch_id; END IF;
  SELECT * INTO v_grl FROM goods_receipt_lines WHERE grn_id = v_id;
  IF v_grl.conversion_factor <> 12.0000 OR v_grl.actual_unit_price <> 125.0000 OR v_grl.lot_number <> 'LOT1' THEN
    RAISE EXCEPTION '225.3 FAIL: conversion/price/lot snapshot wrong'; END IF;
  IF v_grl.accepted_qty <> 2 OR v_grl.rejected_qty <> 1 THEN
    RAISE EXCEPTION '225.3 FAIL: accepted/rejected split wrong'; END IF;
  RAISE NOTICE '225.3 PASS: create draft + inherited org + conversion/price/lot snapshot + split';
END $$;

-- ============================================
-- T225.4 — over-receive rejected (cumulative + this > ordered)
-- ============================================
DO $$
DECLARE v_ok BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22501","role":"authenticated"}', false);
  SET ROLE authenticated;
  -- pol-W4-A ordered 10, already 3 received (from 225.3 in same tx) -> attempt 8 => 11 > 10
  BEGIN
    PERFORM public.create_grn_draft('po-W4-A',
      '[{"po_line_id":"pol-W4-A","received_qty":8}]'::jsonb, NULL, NULL, NULL);
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'ERR_OVER_RECEIVE%' THEN v_ok := true; END IF;
  END;
  RESET ROLE;
  IF NOT v_ok THEN RAISE EXCEPTION '225.4 FAIL: over-receive not rejected'; END IF;
  RAISE NOTICE '225.4 PASS: over-receive rejected (partial receiving guard)';
END $$;

-- ============================================
-- T225.5 — acceptance balance enforced (accepted+rejected != received)
-- ============================================
DO $$
DECLARE v_ok BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22501","role":"authenticated"}', false);
  SET ROLE authenticated;
  BEGIN
    PERFORM public.create_grn_draft('po-W4-A',
      '[{"po_line_id":"pol-W4-A","received_qty":5,"accepted_qty":2,"rejected_qty":1}]'::jsonb, NULL, NULL, NULL);
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'ERR_ACCEPTANCE_BALANCE%' THEN v_ok := true; END IF;
  END;
  RESET ROLE;
  IF NOT v_ok THEN RAISE EXCEPTION '225.5 FAIL: acceptance balance not enforced'; END IF;
  RAISE NOTICE '225.5 PASS: accepted+rejected=received enforced';
END $$;

-- ============================================
-- T225.6 — approve role gate (staff denied, inventory ok)
-- ============================================
DO $$
DECLARE v_id TEXT; v_res JSONB; v_denied BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22501","role":"authenticated"}', false);
  SET ROLE authenticated;
  v_res := public.create_grn_draft('po-W4-A',
    '[{"po_line_id":"pol-W4-A","received_qty":1}]'::jsonb, NULL, NULL, NULL);
  v_id := v_res->>'grn_id';
  RESET ROLE;
  -- staff approve -> denied
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22503","role":"authenticated"}', false);
  SET ROLE authenticated;
  BEGIN
    PERFORM public.approve_grn(v_id);
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'ERR_FORBIDDEN_APPROVER%' THEN v_denied := true; END IF;
  END;
  RESET ROLE;
  IF NOT v_denied THEN RAISE EXCEPTION '225.6 FAIL: staff approve not denied'; END IF;
  -- inventory approve -> ok
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22501","role":"authenticated"}', false);
  SET ROLE authenticated;
  v_res := public.approve_grn(v_id);
  RESET ROLE;
  IF (v_res->>'status') <> 'approved' THEN RAISE EXCEPTION '225.6 FAIL: inventory approve not approved'; END IF;
  RAISE NOTICE '225.6 PASS: staff approve denied + inventory approve OK';
END $$;

-- ============================================
-- T225.7 — branch scope (invB cannot create GRN for branch A PO)
-- ============================================
DO $$
DECLARE v_ok BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22502","role":"authenticated"}', false);
  SET ROLE authenticated;
  BEGIN
    PERFORM public.create_grn_draft('po-W4-A',
      '[{"po_line_id":"pol-W4-A","received_qty":1}]'::jsonb, NULL, NULL, NULL);
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'ERR_FORBIDDEN_SCOPE%' THEN v_ok := true; END IF;
  END;
  RESET ROLE;
  IF NOT v_ok THEN RAISE EXCEPTION '225.7 FAIL: cross-branch GRN create not denied'; END IF;
  RAISE NOTICE '225.7 PASS: cross-branch GRN create denied (org scope)';
END $$;

-- ============================================
-- T225.8 — audit trail (grn_create/grn_approve)
-- ============================================
DO $$
DECLARE v_n INT;
BEGIN
  SELECT count(*) INTO v_n FROM audit_logs
   WHERE action IN ('grn_create','grn_approve') AND entity_type='goods_receipt';
  IF v_n < 2 THEN RAISE EXCEPTION '225.8 FAIL: audit rows=% (expect >=2)', v_n; END IF;
  RAISE NOTICE '225.8 PASS: audit trail written (% rows)', v_n;
END $$;

ROLLBACK;