-- ============================================
-- Bite Me Baby — Phase 2 WP1 Integration Contract (PostgreSQL จริง)
-- Migrations 219-223 · รันบน fresh DB หลัง apply 001→latest (replay harness)
-- ตาม pattern ที่พิสูจน์แล้ว (contracts_147 / contracts_phase1_214_218):
--   BEGIN ... ROLLBACK เดียว · set_config jwt + SET ROLE authenticated
--   RAISE EXCEPTION = FAIL / RAISE NOTICE '<id> PASS' = ผ่าน
-- ขอบเขต: SCHEMA-level (Workflow RPC อยู่ใน staged_workflows — ทดสอบใน WP
-- เจ้าของ ตามคำสั่ง Owner 2026-11-26 §D/§E)
-- ============================================

BEGIN;
RESET ROLE;

-- ============================================
-- FIXTURES (superuser — RLS bypass สำหรับจัดฉากเท่านั้น)
-- ============================================
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-000000c21901', 'c219-inv-a@example.com'),
  ('00000000-0000-4000-8000-000000c21902', 'c219-inv-b@example.com'),
  ('00000000-0000-4000-8000-000000c21903', 'c219-fin@example.com'),
  ('00000000-0000-4000-8000-000000c21904', 'c219-admin@example.com'),
  ('00000000-0000-4000-8000-000000c21905', 'c219-platform@example.com');

-- branches ต้องมีก่อน UPDATE profiles.branch_id (FK profiles_branch_id_fkey)
INSERT INTO public.branches (id, tenant_id, code, name, slug, address_line1, latitude, longitude)
VALUES
  ('branch-p2-a', 'tenant-bmb-001', 'p2a', 'P2 Branch A', 'p2a', '1 Test Rd', 13.7000000, 100.5000000),
  ('branch-p2-b', 'tenant-bmb-001', 'p2b', 'P2 Branch B', 'p2b', '2 Test Rd', 13.8000000, 100.6000000)
ON CONFLICT (id) DO NOTHING;

-- handle_new_user (m006) สร้าง profile role='customer' แล้ว — ยก role ตาม pattern 147
UPDATE profiles SET role='inventory', tenant_id='tenant-bmb-001', branch_id='branch-p2-a' WHERE id='00000000-0000-4000-8000-000000c21901';
UPDATE profiles SET role='inventory', tenant_id='tenant-bmb-001', branch_id='branch-p2-b' WHERE id='00000000-0000-4000-8000-000000c21902';
UPDATE profiles SET role='finance',   tenant_id='tenant-bmb-001' WHERE id='00000000-0000-4000-8000-000000c21903';
UPDATE profiles SET role='admin',     tenant_id='tenant-bmb-001' WHERE id='00000000-0000-4000-8000-000000c21904';
UPDATE profiles SET role='admin',     tenant_id='tenant-bmb-001', is_platform=true WHERE id='00000000-0000-4000-8000-000000c21905';

INSERT INTO public.suppliers (id, name, code, phone, is_active)
VALUES ('sup-p2', 'P2 Supplier', 'P2SUP', '0990000001', true);

INSERT INTO public.inventory (id, name, category)
VALUES ('inv-p2', 'P2 Ingredient', 'p2test');

INSERT INTO public.supplier_products
  (id, supplier_id, ingredient_id, purchase_unit, use_unit, conversion_factor, is_active)
VALUES ('sp-p2', 'sup-p2', 'inv-p2', 'carton', 'bottle', 12.0000, true);

-- PO คนละ branch (status 'ordered' เพื่อทดสอบ inventory/finance/receiver read)
INSERT INTO public.purchase_orders (id, po_number, supplier_id, status, requested_by, tenant_id, branch_id)
VALUES
  ('po-P2-A', 'PO-P2FIX-A', 'sup-p2', 'ordered', '00000000-0000-4000-8000-000000c21904', 'tenant-bmb-001', 'branch-p2-a'),
  ('po-P2-B', 'PO-P2FIX-B', 'sup-p2', 'ordered', '00000000-0000-4000-8000-000000c21904', 'tenant-bmb-001', 'branch-p2-b');

INSERT INTO public.purchase_order_lines
  (id, po_id, supplier_product_id, ingredient_id, ordered_qty, purchase_unit, use_unit, conversion_factor, unit_price)
VALUES
  ('pol-P2-A', 'po-P2-A', 'sp-p2', 'inv-p2', 10.0000, 'carton', 'bottle', 12.0000, 120.0000),
  ('pol-P2-B', 'po-P2-B', 'sp-p2', 'inv-p2', 10.0000, 'carton', 'bottle', 12.0000, 120.0000);

-- GRN fixture (branch A, approved) + บรรทัดสมดุล accepted+rejected=received
INSERT INTO public.goods_receipts (id, grn_number, po_id, supplier_id, status, tenant_id, branch_id)
VALUES ('grn-P2-A', 'GRN-P2FIX-A', 'po-P2-A', 'sup-p2', 'approved', 'tenant-bmb-001', 'branch-p2-a');
INSERT INTO public.goods_receipt_lines
  (id, grn_id, po_line_id, supplier_product_id, ingredient_id, received_qty, accepted_qty, rejected_qty,
   purchase_unit, use_unit, conversion_factor, actual_unit_price)
VALUES ('grl-P2-A', 'grn-P2-A', 'pol-P2-A', 'sp-p2', 'inv-p2', 5.0000, 4.0000, 1.0000,
        'carton', 'bottle', 12.0000, 125.0000);

-- GRN ต้นฉบับ posted (สำหรับทดสอบ reversal linkage)
INSERT INTO public.goods_receipts (id, grn_number, po_id, supplier_id, status, tenant_id, branch_id)
VALUES ('grn-P2-R0', 'GRN-P2FIX-R0', 'po-P2-A', 'sup-p2', 'posted', 'tenant-bmb-001', 'branch-p2-a');
INSERT INTO public.goods_receipt_lines
  (id, grn_id, po_line_id, supplier_product_id, ingredient_id, received_qty, accepted_qty, rejected_qty,
   purchase_unit, use_unit, conversion_factor, actual_unit_price)
VALUES ('grl-P2-R0', 'grn-P2-R0', 'pol-P2-A', 'sp-p2', 'inv-p2', 2.0000, 2.0000, 0.0000,
        'carton', 'bottle', 12.0000, 120.0000);

-- Price history คนละ branch (fixture ระดับ superuser — ปกติ WP6 เป็นคนเขียน)
INSERT INTO public.purchase_price_history
  (supplier_id, supplier_product_id, ingredient_id, po_id, grn_id, grn_line_id,
   price_type, purchase_unit, use_unit, conversion_factor, unit_price, tenant_id, branch_id)
VALUES
  ('sup-p2', 'sp-p2', 'inv-p2', 'po-P2-A', 'grn-P2-A', 'grl-P2-A',
   'realized', 'carton', 'bottle', 12.0000, 125.0000, 'tenant-bmb-001', 'branch-p2-a'),
  ('sup-p2', 'sp-p2', 'inv-p2', 'po-P2-B', NULL, NULL,
   'realized', 'carton', 'bottle', 12.0000, 130.0000, 'tenant-bmb-001', 'branch-p2-b');

-- ============================================
-- T219 — purchase_orders schema + constraints
-- ============================================
DO $$
DECLARE v_n INT;
BEGIN
  SELECT count(*) INTO v_n FROM information_schema.columns
   WHERE table_schema='public' AND table_name='purchase_orders'
     AND column_name IN ('id','po_number','supplier_id','status','tenant_id','branch_id','version');
  IF v_n <> 7 THEN RAISE EXCEPTION '219.1 FAIL: purchase_orders columns missing (%)', v_n; END IF;
  SELECT count(*) INTO v_n FROM information_schema.columns
   WHERE table_schema='public' AND table_name='purchase_order_lines'
     AND column_name IN ('id','po_id','supplier_product_id','ingredient_id','ordered_qty','received_qty');
  IF v_n <> 6 THEN RAISE EXCEPTION '219.1 FAIL: purchase_order_lines columns missing (%)', v_n; END IF;
  RAISE NOTICE '219.1 PASS: PO schema columns OK';
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname='public' AND sequencename='po_number_seq') THEN
    RAISE EXCEPTION '219.2 FAIL: po_number_seq missing';
  END IF;
  RAISE NOTICE '219.2 PASS: po_number_seq OK';
END $$;

DO $$
DECLARE v_ok BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO public.purchase_orders (id, po_number, supplier_id, status)
    VALUES ('po-P2-BADFK', 'PO-P2-BADFK', 'sup-NOPE', 'draft');
  EXCEPTION WHEN foreign_key_violation THEN v_ok := true;
             WHEN OTHERS THEN RAISE EXCEPTION '219.3 FAIL: wrong error (%)', SQLERRM;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION '219.3 FAIL: FK suppliers(id) not enforced'; END IF;
  RAISE NOTICE '219.3 PASS: FK supplier enforced';
END $$;

DO $$
DECLARE v_ok BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO public.purchase_order_lines
      (id, po_id, supplier_product_id, ingredient_id, ordered_qty, purchase_unit, use_unit, conversion_factor, unit_price)
    VALUES ('pol-P2-ZERO', 'po-P2-A', 'sp-p2', 'inv-p2', 0.0000, 'carton', 'bottle', 12.0000, 100.0000);
  EXCEPTION WHEN check_violation THEN v_ok := true;
             WHEN OTHERS THEN RAISE EXCEPTION '219.4 FAIL: wrong error (%)', SQLERRM;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION '219.4 FAIL: CHECK ordered_qty > 0 not enforced'; END IF;
  RAISE NOTICE '219.4 PASS: CHECK ordered_qty > 0 enforced';
END $$;

DO $$
DECLARE v_before INT; v_after INT;
BEGIN
  INSERT INTO public.purchase_orders (id, po_number, supplier_id, status)
  VALUES ('po-P2-CASC', 'PO-P2-CASC', 'sup-p2', 'draft');
  INSERT INTO public.purchase_order_lines
    (id, po_id, supplier_product_id, ingredient_id, ordered_qty, purchase_unit, use_unit, conversion_factor, unit_price)
  VALUES ('pol-P2-CASC', 'po-P2-CASC', 'sp-p2', 'inv-p2', 1.0000, 'carton', 'bottle', 12.0000, 100.0000);
  SELECT count(*) INTO v_before FROM purchase_order_lines WHERE po_id='po-P2-CASC';
  DELETE FROM public.purchase_orders WHERE id='po-P2-CASC';
  SELECT count(*) INTO v_after FROM purchase_order_lines WHERE po_id='po-P2-CASC';
  IF v_before <> 1 OR v_after <> 0 THEN
    RAISE EXCEPTION '219.5 FAIL: CASCADE broken (before=% after=%)', v_before, v_after;
  END IF;
  RAISE NOTICE '219.5 PASS: ON DELETE CASCADE enforced';
END $$;

-- ============================================
-- T220 — goods_receipts schema (DEFECT-1/2/3)
-- ============================================
DO $$
DECLARE v_n INT;
BEGIN
  SELECT count(*) INTO v_n FROM information_schema.columns
   WHERE table_schema='public' AND table_name='goods_receipts'
     AND column_name IN ('id','grn_number','po_id','status','reversal_of',
                         'idempotency_key','idempotency_payload_hash','tenant_id','branch_id');
  IF v_n <> 9 THEN RAISE EXCEPTION '220.1 FAIL: goods_receipts columns missing (%)', v_n; END IF;
  RAISE NOTICE '220.1 PASS: GRN header columns OK (idempotency + reversal linkage)';
END $$;

DO $$
DECLARE v_n INT;
BEGIN
  SELECT count(*) INTO v_n FROM information_schema.columns
   WHERE table_schema='public' AND table_name='goods_receipt_lines' AND column_name='price_variance';
  IF v_n <> 0 THEN RAISE EXCEPTION '220.2 FAIL: price_variance generated column still exists (DEFECT-1)'; END IF;
  RAISE NOTICE '220.2 PASS: DEFECT-1 fixed — price_variance removed (variance = read-layer, WP7)';
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname='public' AND sequencename='grn_number_seq') THEN
    RAISE EXCEPTION '220.3 FAIL: grn_number_seq missing';
  END IF;
  RAISE NOTICE '220.3 PASS: grn_number_seq OK';
END $$;

DO $$
DECLARE v_ok BOOLEAN := false;
BEGIN
  BEGIN
    -- accepted(3) + rejected(1) != received(5) → CHECK grl_acceptance_balance
    INSERT INTO public.goods_receipt_lines
      (id, grn_id, po_line_id, supplier_product_id, ingredient_id, received_qty, accepted_qty, rejected_qty,
       purchase_unit, use_unit, conversion_factor, actual_unit_price)
    VALUES ('grl-P2-BAL', 'grn-P2-A', 'pol-P2-A', 'sp-p2', 'inv-p2', 5.0000, 3.0000, 1.0000,
            'carton', 'bottle', 12.0000, 100.0000);
  EXCEPTION WHEN check_violation THEN v_ok := true;
             WHEN OTHERS THEN RAISE EXCEPTION '220.4 FAIL: wrong error (%)', SQLERRM;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION '220.4 FAIL: acceptance balance CHECK not enforced'; END IF;
  RAISE NOTICE '220.4 PASS: accepted+rejected=received enforced (รับบางส่วน/ปฏิเสธ)';
END $$;

DO $$
DECLARE v_ok BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO public.goods_receipt_lines
      (id, grn_id, po_line_id, supplier_product_id, ingredient_id, received_qty, accepted_qty, rejected_qty,
       purchase_unit, use_unit, conversion_factor, actual_unit_price)
    VALUES ('grl-P2-NEG', 'grn-P2-A', 'pol-P2-A', 'sp-p2', 'inv-p2', -1.0000, -1.0000, 0.0000,
            'carton', 'bottle', 12.0000, 100.0000);
  EXCEPTION WHEN check_violation THEN v_ok := true;
             WHEN OTHERS THEN RAISE EXCEPTION '220.5 FAIL: wrong error (%)', SQLERRM;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION '220.5 FAIL: CHECK received_qty > 0 not enforced'; END IF;
  RAISE NOTICE '220.5 PASS: negative received_qty rejected (DEFECT-2 — ห้ามปริมาณติดลบ)';
END $$;

DO $$
DECLARE v_ok BOOLEAN := false;
BEGIN
  INSERT INTO public.goods_receipts (id, grn_number, po_id, supplier_id, status, tenant_id, branch_id, idempotency_key)
  VALUES ('grn-P2-K1', 'GRN-P2-K1', 'po-P2-A', 'sup-p2', 'approved', 'tenant-bmb-001', 'branch-p2-a', 'idem-p2-key-1');
  BEGIN
    INSERT INTO public.goods_receipts (id, grn_number, po_id, supplier_id, status, tenant_id, branch_id, idempotency_key)
    VALUES ('grn-P2-K2', 'GRN-P2-K2', 'po-P2-A', 'sup-p2', 'approved', 'tenant-bmb-001', 'branch-p2-a', 'idem-p2-key-1');
  EXCEPTION WHEN unique_violation THEN v_ok := true;
             WHEN OTHERS THEN RAISE EXCEPTION '220.6 FAIL: wrong error (%)', SQLERRM;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION '220.6 FAIL: idempotency key unique index missing (DEFECT-3)'; END IF;
  RAISE NOTICE '220.6 PASS: idempotency_key unique enforced (retry ซ้ำระดับ DB ถูกกัน)';
END $$;

DO $$
DECLARE v_ok BOOLEAN := false; v_ok2 BOOLEAN := false;
BEGIN
  -- reversal ครั้งที่ 1 ผ่าน
  INSERT INTO public.goods_receipts (id, grn_number, po_id, supplier_id, status, reversal_of, tenant_id, branch_id)
  VALUES ('grn-P2-REV1', 'REV-GRN-P2FIX-R0', 'po-P2-A', 'sup-p2', 'posted', 'grn-P2-R0', 'tenant-bmb-001', 'branch-p2-a');
  -- ครั้งที่ 2 (ต้นฉบับเดิม) ต้องโดน unique ตีกลับ
  BEGIN
    INSERT INTO public.goods_receipts (id, grn_number, po_id, supplier_id, status, reversal_of, tenant_id, branch_id)
    VALUES ('grn-P2-REV2', 'REV2-GRN-P2FIX-R0', 'po-P2-A', 'sup-p2', 'posted', 'grn-P2-R0', 'tenant-bmb-001', 'branch-p2-a');
  EXCEPTION WHEN unique_violation THEN v_ok := true;
             WHEN OTHERS THEN RAISE EXCEPTION '220.7 FAIL: wrong error (%)', SQLERRM;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION '220.7 FAIL: uq_grn_reversal_once missing — reversal ทำซ้ำได้ (DEFECT-2)'; END IF;
  -- linkage CHECK: ชี้ตัวเองห้าม
  BEGIN
    INSERT INTO public.goods_receipts (id, grn_number, po_id, supplier_id, status, reversal_of, tenant_id, branch_id)
    VALUES ('grn-P2-SELF', 'GRN-P2-SELF', 'po-P2-A', 'sup-p2', 'posted', 'grn-P2-SELF', 'tenant-bmb-001', 'branch-p2-a');
  EXCEPTION WHEN check_violation THEN v_ok2 := true;
             WHEN OTHERS THEN RAISE EXCEPTION '220.8 FAIL: wrong error (%)', SQLERRM;
  END;
  IF NOT v_ok2 THEN RAISE EXCEPTION '220.8 FAIL: grn_reversal_linkage CHECK missing'; END IF;
  RAISE NOTICE '220.7 PASS: reversal ทำซ้ำไม่ได้ (unique reversal_of)';
  RAISE NOTICE '220.8 PASS: reversal_of ห้ามชี้ตัวเอง';
END $$;

DO $$
DECLARE v_ok BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO public.goods_receipts (id, grn_number, po_id, supplier_id, status, reversal_of, idempotency_key, tenant_id, branch_id)
    VALUES ('grn-P2-IDM', 'GRN-P2-IDM', 'po-P2-A', 'sup-p2', 'posted', 'grn-P2-R0', 'idem-p2-key-2', 'tenant-bmb-001', 'branch-p2-a');
  EXCEPTION WHEN check_violation THEN v_ok := true;
             WHEN OTHERS THEN RAISE EXCEPTION '220.9 FAIL: wrong error (%)', SQLERRM;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION '220.9 FAIL: reversal ต้องไม่มี idempotency_key (grn_reversal_no_idem)'; END IF;
  RAISE NOTICE '220.9 PASS: reversal row ไม่ผูก idempotency key';
END $$;

-- ============================================
-- T221 — purchase_price_history (DEFECT-4/5 + append-only)
-- ============================================
DO $$
DECLARE v_n INT;
BEGIN
  SELECT count(*) INTO v_n FROM information_schema.columns
   WHERE table_schema='public' AND table_name='purchase_price_history' AND column_name='package_size';
  IF v_n <> 0 THEN RAISE EXCEPTION '221.1 FAIL: package_size still exists (DEFECT-5)'; END IF;
  RAISE NOTICE '221.1 PASS: DEFECT-5 fixed — package_size removed';
END $$;

DO $$
DECLARE v_n INT;
BEGIN
  SELECT count(*) INTO v_n FROM information_schema.columns
   WHERE table_schema='public' AND table_name='purchase_price_history'
     AND column_name IN ('landed_cost','tenant_id','branch_id','grn_line_id','price_per_use_unit');
  IF v_n <> 5 THEN RAISE EXCEPTION '221.2 FAIL: pph columns missing (%)', v_n; END IF;
  RAISE NOTICE '221.2 PASS: landed_cost (DEFECT-4 storage) + tenant/branch isolation columns OK';
END $$;

DO $$
DECLARE v_ok BOOLEAN := false;
BEGIN
  -- staff INSERT ไม่ได้ตาม design (เขียนโดย WP6 SECURITY DEFINER เท่านั้น)
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c21903","role":"authenticated"}', false);
  SET ROLE authenticated;
  BEGIN
    INSERT INTO public.purchase_price_history
      (supplier_id, supplier_product_id, ingredient_id, price_type, purchase_unit, use_unit,
       conversion_factor, unit_price, tenant_id, branch_id)
    VALUES ('sup-p2', 'sp-p2', 'inv-p2', 'quoted', 'carton', 'bottle', 12.0000, 99.0000,
            'tenant-bmb-001', 'branch-p2-a');
    RESET ROLE;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    IF SQLERRM LIKE '%row-level security%' OR SQLERRM LIKE '%violates%' THEN
      v_ok := true;
    ELSE
      RAISE EXCEPTION '221.3 FAIL: wrong error (%)', SQLERRM;
    END IF;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION '221.3 FAIL: staff INSERT ต้องถูก RLS ปฏิเสธ (append-only เขียนโดย WP6)'; END IF;
  RAISE NOTICE '221.3 PASS: staff INSERT ถูกปฏิเสธ (เขียนได้เฉพาะ WP6 service path)';
END $$;

DO $$
DECLARE v_ok BOOLEAN := false; v_ok2 BOOLEAN := false;
BEGIN
  -- รันเป็น superuser (bypass RLS) เพื่อยิง append-only trigger โดยตรง —
  -- ถ้ารันเป็น staff RLS จะกรอง row จน UPDATE ไม่โดนแถว (ไม่ได้ทดสอบ trigger)
  BEGIN
    UPDATE public.purchase_price_history SET unit_price = 1.0000 WHERE id = 1;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%append-only%' THEN v_ok := true; ELSE
      RAISE EXCEPTION '221.4 FAIL: wrong error (%)', SQLERRM; END IF;
  END;
  BEGIN
    DELETE FROM public.purchase_price_history WHERE id = 1;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%append-only%' THEN v_ok2 := true; ELSE
      RAISE EXCEPTION '221.5 FAIL: wrong error (%)', SQLERRM; END IF;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION '221.4 FAIL: UPDATE ไม่ถูกบล็อก (append-only)'; END IF;
  IF NOT v_ok2 THEN RAISE EXCEPTION '221.5 FAIL: DELETE ไม่ถูกบล็อก (append-only)'; END IF;
  RAISE NOTICE '221.4 PASS: UPDATE ถูกบล็อก (append-only)';
  RAISE NOTICE '221.5 PASS: DELETE ถูกบล็อก (append-only)';
END $$;

DO $$
DECLARE v_gen NUMERIC;
BEGIN
  -- INSERT ผ่าน admin JWT จริง (พิสูจน์ pph_admin policy + generated column)
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c21904","role":"authenticated"}', false);
  SET ROLE authenticated;
  INSERT INTO public.purchase_price_history
    (supplier_id, supplier_product_id, ingredient_id, price_type, purchase_unit, use_unit,
     conversion_factor, unit_price, tenant_id, branch_id)
  VALUES ('sup-p2', 'sp-p2', 'inv-p2', 'quoted', 'carton', 'bottle', 4.0000, 200.0000,
          'tenant-bmb-001', NULL);
  RESET ROLE;
  SELECT price_per_use_unit INTO v_gen FROM public.purchase_price_history
   WHERE unit_price=200.0000 AND conversion_factor=4.0000 ORDER BY id DESC LIMIT 1;
  IF v_gen IS NULL OR v_gen <> 50.0000 THEN
    RAISE EXCEPTION '221.6 FAIL: price_per_use_unit generated = % (expect 50)', v_gen;
  END IF;
  RAISE NOTICE '221.6 PASS: admin INSERT ผ่าน policy + price_per_use_unit = 200/4=50';
END $$;

-- ============================================
-- T222 — inventory_transactions extension
-- ============================================
DO $$
DECLARE v_n INT;
BEGIN
  SELECT count(*) INTO v_n FROM information_schema.columns
   WHERE table_schema='public' AND table_name='inventory_transactions'
     AND column_name IN ('po_id','grn_id','grn_line_id','unit_cost','conversion_snapshot');
  IF v_n <> 5 THEN RAISE EXCEPTION '222.1 FAIL: extension columns missing (%)', v_n; END IF;
  RAISE NOTICE '222.1 PASS: itx extension columns OK';
END $$;

DO $$
DECLARE v_ok BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO public.inventory_transactions (id, inventory_id, type, quantity, grn_id)
    VALUES ('itx-P2-BADFK', 'inv-p2', 'in', 1.0000, 'grn-NOPE');
  EXCEPTION WHEN foreign_key_violation THEN v_ok := true;
             WHEN OTHERS THEN RAISE EXCEPTION '222.2 FAIL: wrong error (%)', SQLERRM;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION '222.2 FAIL: FK itx.grn_id not enforced'; END IF;
  RAISE NOTICE '222.2 PASS: itx.grn_id FK enforced';
END $$;

-- ============================================
-- T223 — RLS Organization + Branch isolation (ผู้ใช้/role จริง)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='has_org_row_scope' AND pronamespace='public'::regnamespace) THEN
    RAISE EXCEPTION '223.1 FAIL: has_org_row_scope missing';
  END IF;
  RAISE NOTICE '223.1 PASS: has_org_row_scope helper OK';
END $$;

DO $$
DECLARE v_a INT; v_b INT;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c21901","role":"authenticated"}', false);
  SET ROLE authenticated;
  SELECT count(*) INTO v_a FROM public.purchase_orders WHERE id='po-P2-A';
  SELECT count(*) INTO v_b FROM public.purchase_orders WHERE id='po-P2-B';
  RESET ROLE;
  IF v_a <> 1 THEN RAISE EXCEPTION '223.2 FAIL: invA ต้องเห็น po-P2-A (got %)', v_a; END IF;
  IF v_b <> 0 THEN RAISE EXCEPTION '223.2 FAIL: invA (branch A) เห็น po-P2-B (branch B) — cross-branch read LEAK (%)', v_b; END IF;
  RAISE NOTICE '223.2 PASS: invA เห็นเฉพาะ branch A (cross-branch read denied)';
END $$;

DO $$
DECLARE v_n INT;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c21901","role":"authenticated"}', false);
  SET ROLE authenticated;
  UPDATE public.purchase_orders SET notes='hack' WHERE id='po-P2-B';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RESET ROLE;
  IF v_n <> 0 THEN RAISE EXCEPTION '223.3 FAIL: invA เขียน po-P2-B สำเร็จ % แถว — cross-branch WRITE LEAK', v_n; END IF;
  RAISE NOTICE '223.3 PASS: invA เขียน branch B ถูกปฏิเสธ (0 rows)';
END $$;

DO $$
DECLARE v_ok BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c21901","role":"authenticated"}', false);
  SET ROLE authenticated;
  BEGIN
    INSERT INTO public.purchase_orders (id, po_number, supplier_id, status, requested_by, tenant_id, branch_id)
    VALUES ('po-P2-LEAK', 'PO-P2-LEAK', 'sup-p2', 'draft',
            '00000000-0000-4000-8000-000000c21901', 'tenant-bmb-001', 'branch-p2-b');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%row-level security%' THEN v_ok := true;
    ELSE RAISE EXCEPTION '223.4 FAIL: wrong error (%)', SQLERRM; END IF;
  END;
  RESET ROLE;
  IF NOT v_ok THEN RAISE EXCEPTION '223.4 FAIL: invA สร้าง PO ต่าง branch สำเร็จ — WITH CHECK LEAK'; END IF;
  RAISE NOTICE '223.4 PASS: invA สร้าง PO ใน branch B ถูกปฏิเสธ (WITH CHECK)';
END $$;

DO $$
DECLARE v_ok BOOLEAN := false; v_lines INT;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c21901","role":"authenticated"}', false);
  SET ROLE authenticated;
  BEGIN
    INSERT INTO public.purchase_orders (id, po_number, supplier_id, status, requested_by, tenant_id, branch_id)
    VALUES ('po-P2-OWN', 'PO-P2-OWN', 'sup-p2', 'draft',
            '00000000-0000-4000-8000-000000c21901', 'tenant-bmb-001', 'branch-p2-a');
    v_ok := true;
    INSERT INTO public.purchase_order_lines
      (id, po_id, supplier_product_id, ingredient_id, ordered_qty, purchase_unit, use_unit, conversion_factor, unit_price)
    VALUES ('pol-P2-OWN', 'po-P2-OWN', 'sp-p2', 'inv-p2', 1.0000, 'carton', 'bottle', 12.0000, 100.0000);
    SELECT count(*) INTO v_lines FROM public.purchase_order_lines WHERE id='pol-P2-OWN';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '223.5 FAIL: invA ต้องทำงานใน branch ตัวเองได้ (%)', SQLERRM;
  END;
  RESET ROLE;
  IF NOT v_ok OR v_lines <> 1 THEN RAISE EXCEPTION '223.5 FAIL: own-branch draft/line (lines=%)', v_lines; END IF;
  RAISE NOTICE '223.5 PASS: invA สร้าง PO draft + line ใน branch ตัวเองได้';
END $$;

DO $$
DECLARE v_a INT; v_b INT;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c21902","role":"authenticated"}', false);
  SET ROLE authenticated;
  SELECT count(*) INTO v_a FROM public.purchase_orders WHERE id='po-P2-A';
  SELECT count(*) INTO v_b FROM public.purchase_orders WHERE id='po-P2-B';
  RESET ROLE;
  IF v_a <> 0 THEN RAISE EXCEPTION '223.6 FAIL: invB (branch B) เห็น po-P2-A — LEAK'; END IF;
  IF v_b <> 1 THEN RAISE EXCEPTION '223.6 FAIL: invB ต้องเห็น po-P2-B (got %)', v_b; END IF;
  RAISE NOTICE '223.6 PASS: invB เห็นเฉพาะ branch B (ทั้งสองทิศถูกปฏิเสธ)';
END $$;

DO $$
DECLARE v_n INT;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c21903","role":"authenticated"}', false);
  SET ROLE authenticated;
  SELECT count(*) INTO v_n FROM public.purchase_orders WHERE id IN ('po-P2-A','po-P2-B') AND status='ordered';
  RESET ROLE;
  IF v_n <> 2 THEN RAISE EXCEPTION '223.7 FAIL: finance (ไม่มี branch assignment) ต้องเห็นทั้งสอง branch (got %)', v_n; END IF;
  RAISE NOTICE '223.7 PASS: finance ระดับ tenant เห็นทุก branch ตาม model เดิม';
END $$;

DO $$
DECLARE v_n INT;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c21904","role":"authenticated"}', false);
  SET ROLE authenticated;
  UPDATE public.purchase_orders SET notes='admin-cross-branch-ok' WHERE id='po-P2-B';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RESET ROLE;
  IF v_n <> 1 THEN RAISE EXCEPTION '223.8 FAIL: admin ต้องข้าม branch ได้ตาม Permission Model เดิม (rows=%)', v_n; END IF;
  RAISE NOTICE '223.8 PASS: admin cross-branch write ตาม Permission Model เดิม (m088)';
END $$;

DO $$
DECLARE v_n INT;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c21905","role":"authenticated"}', false);
  SET ROLE authenticated;
  SELECT count(*) INTO v_n FROM public.purchase_orders WHERE id IN ('po-P2-A','po-P2-B');
  RESET ROLE;
  IF v_n <> 2 THEN RAISE EXCEPTION '223.9 FAIL: platform bypass พัง (got %)', v_n; END IF;
  RAISE NOTICE '223.9 PASS: is_platform bypass ตาม m071/m088';
END $$;

DO $$
DECLARE v_a INT; v_b INT;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c21901","role":"authenticated"}', false);
  SET ROLE authenticated;
  SELECT count(*) INTO v_a FROM public.purchase_price_history WHERE branch_id='branch-p2-a';
  SELECT count(*) INTO v_b FROM public.purchase_price_history WHERE branch_id='branch-p2-b';
  RESET ROLE;
  IF v_a <> 1 THEN RAISE EXCEPTION '223.10 FAIL: invA ต้องเห็น pph branch A (got %)', v_a; END IF;
  IF v_b <> 0 THEN RAISE EXCEPTION '223.10 FAIL: invA เห็น price history branch B — cross-branch LEAK (%)', v_b; END IF;
  RAISE NOTICE '223.10 PASS: price history cross-branch read denied';
END $$;

DO $$
DECLARE v_n INT;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c21902","role":"authenticated"}', false);
  SET ROLE authenticated;
  SELECT count(*) INTO v_n FROM public.goods_receipts WHERE id='grn-P2-A';
  RESET ROLE;
  IF v_n <> 0 THEN RAISE EXCEPTION '223.11 FAIL: invB (branch B) เห็น GRN ของ branch A — LEAK'; END IF;
  RAISE NOTICE '223.11 PASS: GRN cross-branch read denied';
END $$;

ROLLBACK;
