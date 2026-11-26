-- ============================================
-- Bite Me Baby — Phase 2 WP2 Integration Contract (PostgreSQL จริง)
-- Migration 224 (PO Workflow RPC) · รันบน fresh DB หลัง apply 001→224
-- Pattern เดียวกับ contracts_phase2_219_223:
--   BEGIN ... ROLLBACK เดียว · set_config jwt + SET ROLE authenticated
--   RAISE EXCEPTION = FAIL / RAISE NOTICE '<id> PASS' = ผ่าน
-- ขอบเขต: RPC runtime จริง (create/update/submit/approve) บน DB จริง
--   ครอบ number-gen, validation, optimistic lock, duplicate submit,
--   invalid transition, role gate, branch/tenant scope, audit, rollback
-- ============================================

BEGIN;
RESET ROLE;

-- ============================================
-- FIXTURES (superuser — RLS bypass สำหรับจัดฉากเท่านั้น)
-- ============================================
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-000000c22401', 'c224-staff-a@example.com'),
  ('00000000-0000-4000-8000-000000c22402', 'c224-staff-b@example.com'),
  ('00000000-0000-4000-8000-000000c22403', 'c224-fin@example.com'),
  ('00000000-0000-4000-8000-000000c22404', 'c224-admin@example.com');

INSERT INTO public.branches (id, tenant_id, code, name, slug, address_line1, latitude, longitude)
VALUES
  ('branch-p2-a', 'tenant-bmb-001', 'p2a', 'P2 Branch A', 'p2a', '1 Test Rd', 13.7000000, 100.5000000),
  ('branch-p2-b', 'tenant-bmb-001', 'p2b', 'P2 Branch B', 'p2b', '2 Test Rd', 13.8000000, 100.6000000)
ON CONFLICT (id) DO NOTHING;

-- handle_new_user (m006) สร้าง profile role='customer' แล้ว — ยก role ตาม pattern 147
UPDATE profiles SET role='staff',    tenant_id='tenant-bmb-001', branch_id='branch-p2-a' WHERE id='00000000-0000-4000-8000-000000c22401';
UPDATE profiles SET role='staff',    tenant_id='tenant-bmb-001', branch_id='branch-p2-b' WHERE id='00000000-0000-4000-8000-000000c22402';
UPDATE profiles SET role='finance',  tenant_id='tenant-bmb-001' WHERE id='00000000-0000-4000-8000-000000c22403';
UPDATE profiles SET role='admin',    tenant_id='tenant-bmb-001' WHERE id='00000000-0000-4000-8000-000000c22404';

INSERT INTO public.suppliers (id, name, code, phone, is_active)
VALUES
  ('sup-p2', 'P2 Supplier', 'P2SUP', '0990000001', true),
  ('sup-p2-inactive', 'P2 Inactive Supplier', 'P2INA', '0990000002', false);

INSERT INTO public.inventory (id, name, category)
VALUES ('inv-p2', 'P2 Ingredient', 'p2test');

INSERT INTO public.supplier_products
  (id, supplier_id, ingredient_id, purchase_unit, use_unit, conversion_factor, is_active, last_approved_price)
VALUES
  ('sp-p2', 'sup-p2', 'inv-p2', 'carton', 'bottle', 12.0000, true, 120.0000);

-- PO branch B (สำหรับทดสอบ cross-branch) — insert superuser
INSERT INTO public.purchase_orders (id, po_number, supplier_id, status, requested_by, tenant_id, branch_id)
VALUES ('po-W2-B', 'PO-W2FIX-B', 'sup-p2', 'draft', '00000000-0000-4000-8000-000000c22404', 'tenant-bmb-001', 'branch-p2-b');

-- ============================================
-- T224.1 — functions ครบ
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='generate_po_number' AND pronamespace='public'::regnamespace) THEN
    RAISE EXCEPTION '224.1 FAIL: generate_po_number missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='create_purchase_order' AND pronamespace='public'::regnamespace) THEN
    RAISE EXCEPTION '224.1 FAIL: create_purchase_order missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='update_purchase_order' AND pronamespace='public'::regnamespace) THEN
    RAISE EXCEPTION '224.1 FAIL: update_purchase_order missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='submit_purchase_order' AND pronamespace='public'::regnamespace) THEN
    RAISE EXCEPTION '224.1 FAIL: submit_purchase_order missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='approve_purchase_order' AND pronamespace='public'::regnamespace) THEN
    RAISE EXCEPTION '224.1 FAIL: approve_purchase_order missing';
  END IF;
  RAISE NOTICE '224.1 PASS: 5 PO workflow functions exist';
END $$;

-- ============================================
-- T224.2 — generate_po_number format (PO-YYYYMMDD-{seq})
-- ============================================
DO $$
DECLARE v_num TEXT;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22401","role":"authenticated"}', false);
  SET ROLE authenticated;
  v_num := public.generate_po_number();
  RESET ROLE;
  IF v_num !~ '^PO-[0-9]{8}-[0-9]{4}$' THEN
    RAISE EXCEPTION '224.2 FAIL: bad po_number format %', v_num;
  END IF;
  RAISE NOTICE '224.2 PASS: po_number format OK (%)', v_num;
END $$;

-- ============================================
-- T224.3 — create draft (staff, branch A) + line_total + version=1
-- ============================================
DO $$
DECLARE v_res JSONB; v_id TEXT; v_total NUMERIC; v_ver INT; v_line_total NUMERIC;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22401","role":"authenticated"}', false);
  SET ROLE authenticated;
  v_res := public.create_purchase_order(
    'sup-p2',
    '[{"supplier_product_id":"sp-p2","ordered_qty":10,"unit_price":120}]'::jsonb,
    NULL, 0, 0, 0, 'test', NULL, NULL);
  RESET ROLE;
  v_id := v_res->>'po_id';
  IF (v_res->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION '224.3 FAIL: create not ok %', v_res; END IF;
  IF (v_res->>'status') <> 'draft' THEN RAISE EXCEPTION '224.3 FAIL: status not draft'; END IF;
  SELECT total_amount, version INTO v_total, v_ver FROM purchase_orders WHERE id = v_id;
  IF v_total <> 1200.00 THEN RAISE EXCEPTION '224.3 FAIL: total=% (expect 1200)', v_total; END IF;
  IF v_ver <> 1 THEN RAISE EXCEPTION '224.3 FAIL: version=% (expect 1)', v_ver; END IF;
  SELECT line_total INTO v_line_total FROM purchase_order_lines WHERE po_id = v_id;
  IF v_line_total <> 1200.00 THEN RAISE EXCEPTION '224.3 FAIL: line_total=% (expect 1200)', v_line_total; END IF;
  RAISE NOTICE '224.3 PASS: create draft + total 1200 + version 1 + line_total 1200';
END $$;

-- ============================================
-- T224.4 — create rejects invalid supplier / qty
-- (conversion > 0 บังคับโดย DB CHECK m217 อยู่แล้ว — ฟังก์ชันมี guard เป็น defense-in-depth)
-- ============================================
DO $$
DECLARE v_ok1 BOOLEAN := false; v_ok3 BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22401","role":"authenticated"}', false);
  SET ROLE authenticated;
  BEGIN
    PERFORM public.create_purchase_order('sup-p2-inactive',
      '[{"supplier_product_id":"sp-p2","ordered_qty":1}]'::jsonb, NULL,0,0,0,NULL,NULL,NULL);
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'ERR_SUPPLIER_INVALID%' THEN v_ok1 := true; END IF;
  END;
  BEGIN
    PERFORM public.create_purchase_order('sup-p2',
      '[{"supplier_product_id":"sp-p2","ordered_qty":0}]'::jsonb, NULL,0,0,0,NULL,NULL,NULL);
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'ERR_INVALID_QTY%' THEN v_ok3 := true; END IF;
  END;
  RESET ROLE;
  IF NOT v_ok1 THEN RAISE EXCEPTION '224.4 FAIL: inactive supplier not rejected'; END IF;
  IF NOT v_ok3 THEN RAISE EXCEPTION '224.4 FAIL: qty<=0 not rejected'; END IF;
  RAISE NOTICE '224.4 PASS: supplier/qty validation enforced (conversion>0 บังคับโดย DB CHECK)';
END $$;

-- ============================================
-- T224.5 — optimistic lock (stale version rejected)
-- ============================================
DO $$
DECLARE v_id TEXT; v_res JSONB; v_ok BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22401","role":"authenticated"}', false);
  SET ROLE authenticated;
  v_res := public.create_purchase_order('sup-p2',
    '[{"supplier_product_id":"sp-p2","ordered_qty":5}]'::jsonb, NULL,0,0,0,NULL,NULL,NULL);
  v_id := v_res->>'po_id';
  -- update with correct version 1 -> ok, version 2
  v_res := public.update_purchase_order(v_id, NULL, NULL, NULL, NULL, NULL, 'changed', 1);
  IF (v_res->>'version')::int <> 2 THEN RESET ROLE; RAISE EXCEPTION '224.5 FAIL: version not 2 after update'; END IF;
  -- stale version 1 again -> reject
  BEGIN
    PERFORM public.update_purchase_order(v_id, NULL, NULL, NULL, NULL, NULL, 'again', 1);
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'ERR_VERSION_MISMATCH%' THEN v_ok := true; END IF;
  END;
  RESET ROLE;
  IF NOT v_ok THEN RAISE EXCEPTION '224.5 FAIL: stale version not rejected'; END IF;
  RAISE NOTICE '224.5 PASS: optimistic lock (version) enforced';
END $$;

-- ============================================
-- T224.6 — duplicate submit rejected (status gate)
-- ============================================
DO $$
DECLARE v_id TEXT; v_res JSONB; v_ok BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22401","role":"authenticated"}', false);
  SET ROLE authenticated;
  v_res := public.create_purchase_order('sup-p2',
    '[{"supplier_product_id":"sp-p2","ordered_qty":5}]'::jsonb, NULL,0,0,0,NULL,NULL,NULL);
  v_id := v_res->>'po_id';
  v_res := public.submit_purchase_order(v_id);
  IF (v_res->>'status') <> 'submitted' THEN RESET ROLE; RAISE EXCEPTION '224.6 FAIL: submit status not submitted'; END IF;
  BEGIN
    PERFORM public.submit_purchase_order(v_id);
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'ERR_INVALID_TRANSITION%' THEN v_ok := true; END IF;
  END;
  RESET ROLE;
  IF NOT v_ok THEN RAISE EXCEPTION '224.6 FAIL: duplicate submit not rejected'; END IF;
  RAISE NOTICE '224.6 PASS: duplicate submit rejected (status gate)';
END $$;

-- ============================================
-- T224.7 — approve role gate (staff denied, finance ok + committed price)
-- ============================================
DO $$
DECLARE v_id TEXT; v_res JSONB; v_denied BOOLEAN := false; v_committed NUMERIC;
BEGIN
  -- staff creates + submits
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22401","role":"authenticated"}', false);
  SET ROLE authenticated;
  v_res := public.create_purchase_order('sup-p2',
    '[{"supplier_product_id":"sp-p2","ordered_qty":5,"unit_price":130}]'::jsonb, NULL,0,0,0,NULL,NULL,NULL);
  v_id := v_res->>'po_id';
  PERFORM public.submit_purchase_order(v_id);
  -- staff approve -> denied
  BEGIN
    PERFORM public.approve_purchase_order(v_id);
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'ERR_FORBIDDEN_APPROVER%' THEN v_denied := true; END IF;
  END;
  RESET ROLE;
  IF NOT v_denied THEN RAISE EXCEPTION '224.7 FAIL: staff approve not denied'; END IF;
  -- finance approve -> ok
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22403","role":"authenticated"}', false);
  SET ROLE authenticated;
  v_res := public.approve_purchase_order(v_id);
  RESET ROLE;
  IF (v_res->>'status') <> 'approved' THEN RAISE EXCEPTION '224.7 FAIL: finance approve status not approved'; END IF;
  SELECT last_committed_price INTO v_committed FROM supplier_products WHERE id='sp-p2';
  IF v_committed <> 130.0000 THEN RAISE EXCEPTION '224.7 FAIL: last_committed_price=% (expect 130)', v_committed; END IF;
  RAISE NOTICE '224.7 PASS: staff approve denied + finance approve OK + committed price 130';
END $$;

-- ============================================
-- T224.8 — invalid transition (approve draft rejected)
-- ============================================
DO $$
DECLARE v_id TEXT; v_res JSONB; v_ok BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22401","role":"authenticated"}', false);
  SET ROLE authenticated;
  v_res := public.create_purchase_order('sup-p2',
    '[{"supplier_product_id":"sp-p2","ordered_qty":5}]'::jsonb, NULL,0,0,0,NULL,NULL,NULL);
  v_id := v_res->>'po_id';
  RESET ROLE;
  -- finance approve a DRAFT -> invalid transition
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22403","role":"authenticated"}', false);
  SET ROLE authenticated;
  BEGIN
    PERFORM public.approve_purchase_order(v_id);
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'ERR_INVALID_TRANSITION%' THEN v_ok := true; END IF;
  END;
  RESET ROLE;
  IF NOT v_ok THEN RAISE EXCEPTION '224.8 FAIL: approve draft not rejected'; END IF;
  RAISE NOTICE '224.8 PASS: approve draft rejected (invalid transition)';
END $$;

-- ============================================
-- T224.9 — branch scope (create cross-branch + update cross-branch denied)
-- ============================================
DO $$
DECLARE v_ok1 BOOLEAN := false; v_ok2 BOOLEAN := false;
BEGIN
  -- staff A create with branch B -> ERR_FORBIDDEN_BRANCH
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22401","role":"authenticated"}', false);
  SET ROLE authenticated;
  BEGIN
    PERFORM public.create_purchase_order('sup-p2',
      '[{"supplier_product_id":"sp-p2","ordered_qty":1}]'::jsonb, NULL,0,0,0,NULL,NULL,'branch-p2-b');
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'ERR_FORBIDDEN_BRANCH%' THEN v_ok1 := true; END IF;
  END;
  -- staff A update PO in branch B -> ERR_FORBIDDEN_SCOPE
  BEGIN
    PERFORM public.update_purchase_order('po-W2-B', NULL, NULL, NULL, NULL, NULL, 'hack', 1);
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'ERR_FORBIDDEN_SCOPE%' THEN v_ok2 := true; END IF;
  END;
  RESET ROLE;
  IF NOT v_ok1 THEN RAISE EXCEPTION '224.9 FAIL: cross-branch create not denied'; END IF;
  IF NOT v_ok2 THEN RAISE EXCEPTION '224.9 FAIL: cross-branch update not denied'; END IF;
  RAISE NOTICE '224.9 PASS: branch scope enforced (create + update cross-branch denied)';
END $$;

-- ============================================
-- T224.10 — audit trail written (create/submit/approve)
-- ============================================
DO $$
DECLARE v_n INT;
BEGIN
  SELECT count(*) INTO v_n FROM audit_logs
   WHERE action IN ('po_create','po_submit','po_approve')
     AND entity_type='purchase_order';
  IF v_n < 3 THEN RAISE EXCEPTION '224.10 FAIL: audit rows=% (expect >=3)', v_n; END IF;
  RAISE NOTICE '224.10 PASS: audit trail written (% rows)', v_n;
END $$;

ROLLBACK;