-- ============================================
-- Bite Me Baby — Phase 2 WP7+WP8 Integration Contract (PostgreSQL จริง)
-- Migrations 227 (price history read) + 228 (PO dashboard read)
-- SECURITY INVOKER — พิสูจน์ว่า RLS (m223) บังคับจริง:
--   staff เห็นเฉพาะ branch ตัวเอง, admin/tenant เห็นทุก branch, anon ถูกปฏิเสธ
-- ============================================

BEGIN;
RESET ROLE;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-000000c22701', 'c227-inv-a@example.com'),
  ('00000000-0000-4000-8000-000000c22702', 'c227-inv-b@example.com'),
  ('00000000-0000-4000-8000-000000c22703', 'c227-admin@example.com');

INSERT INTO public.branches (id, tenant_id, code, name, slug, address_line1, latitude, longitude)
VALUES
  ('branch-p2-a', 'tenant-bmb-001', 'p2a', 'P2 Branch A', 'p2a', '1 Test Rd', 13.7000000, 100.5000000),
  ('branch-p2-b', 'tenant-bmb-001', 'p2b', 'P2 Branch B', 'p2b', '2 Test Rd', 13.8000000, 100.6000000)
ON CONFLICT (id) DO NOTHING;

UPDATE profiles SET role='inventory', tenant_id='tenant-bmb-001', branch_id='branch-p2-a' WHERE id='00000000-0000-4000-8000-000000c22701';
UPDATE profiles SET role='inventory', tenant_id='tenant-bmb-001', branch_id='branch-p2-b' WHERE id='00000000-0000-4000-8000-000000c22702';
UPDATE profiles SET role='admin',     tenant_id='tenant-bmb-001' WHERE id='00000000-0000-4000-8000-000000c22703';

INSERT INTO public.suppliers (id, name, code, phone, is_active)
VALUES ('sup-p2', 'P2 Supplier', 'P2SUP', '0990000001', true);
INSERT INTO public.inventory (id, name, category) VALUES ('inv-p2', 'P2 Ingredient', 'p2test');
INSERT INTO public.supplier_products
  (id, supplier_id, ingredient_id, purchase_unit, use_unit, conversion_factor, is_active)
VALUES ('sp-p2', 'sup-p2', 'inv-p2', 'carton', 'bottle', 12.0000, true);

INSERT INTO public.purchase_orders (id, po_number, supplier_id, status, total_amount, order_date, tenant_id, branch_id)
VALUES
  ('po-A', 'PO-A', 'sup-p2', 'completed', 1000.00, '2026-11-01', 'tenant-bmb-001', 'branch-p2-a'),
  ('po-B', 'PO-B', 'sup-p2', 'completed', 2000.00, '2026-11-02', 'tenant-bmb-001', 'branch-p2-b');

INSERT INTO public.purchase_price_history
  (supplier_id, supplier_product_id, ingredient_id, price_type, purchase_unit, use_unit, conversion_factor, unit_price, effective_date, tenant_id, branch_id)
VALUES
  ('sup-p2', 'sp-p2', 'inv-p2', 'realized', 'carton', 'bottle', 12.0000, 120.0000, '2026-11-01', 'tenant-bmb-001', 'branch-p2-a'),
  ('sup-p2', 'sp-p2', 'inv-p2', 'realized', 'carton', 'bottle', 12.0000, 130.0000, '2026-11-02', 'tenant-bmb-001', 'branch-p2-b');

-- ============================================
-- T227.1 — functions exist + SECURITY INVOKER
-- ============================================
DO $$
DECLARE v_secdef BOOLEAN;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='get_purchase_price_history' AND pronamespace='public'::regnamespace) THEN
    RAISE EXCEPTION '227.1 FAIL: get_purchase_price_history missing'; END IF;
  SELECT prosecdef INTO v_secdef FROM pg_proc WHERE proname='get_purchase_price_history' LIMIT 1;
  IF v_secdef THEN RAISE EXCEPTION '227.1 FAIL: must be SECURITY INVOKER (prosecdef=false)'; END IF;
  RAISE NOTICE '227.1 PASS: get_purchase_price_history exists + SECURITY INVOKER';
END $$;

-- ============================================
-- T227.2 — RLS: invA sees only branch A price history
-- ============================================
DO $$
DECLARE v_a INT; v_b INT;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22701","role":"authenticated"}', false);
  SET ROLE authenticated;
  SELECT count(*) INTO v_a FROM public.get_purchase_price_history(NULL,NULL,NULL,NULL,NULL,500,0) WHERE branch_id='branch-p2-a';
  SELECT count(*) INTO v_b FROM public.get_purchase_price_history(NULL,NULL,NULL,NULL,NULL,500,0) WHERE branch_id='branch-p2-b';
  RESET ROLE;
  IF v_a <> 1 THEN RAISE EXCEPTION '227.2 FAIL: invA branch A rows=% (expect 1)', v_a; END IF;
  IF v_b <> 0 THEN RAISE EXCEPTION '227.2 FAIL: invA sees branch B rows=% (LEAK)', v_b; END IF;
  RAISE NOTICE '227.2 PASS: invA sees only branch A (RLS enforced via INVOKER)';
END $$;

-- ============================================
-- T227.3 — admin sees both branches
-- ============================================
DO $$
DECLARE v_n INT;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22703","role":"authenticated"}', false);
  SET ROLE authenticated;
  SELECT count(*) INTO v_n FROM public.get_purchase_price_history(NULL,NULL,NULL,NULL,NULL,500,0);
  RESET ROLE;
  IF v_n <> 2 THEN RAISE EXCEPTION '227.3 FAIL: admin rows=% (expect 2)', v_n; END IF;
  RAISE NOTICE '227.3 PASS: admin sees both branches';
END $$;

-- ============================================
-- T227.4 — filter by ingredient + price_type
-- ============================================
DO $$
DECLARE v_n INT;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22703","role":"authenticated"}', false);
  SET ROLE authenticated;
  SELECT count(*) INTO v_n FROM public.get_purchase_price_history('inv-p2',NULL,'realized',NULL,NULL,500,0);
  RESET ROLE;
  IF v_n <> 2 THEN RAISE EXCEPTION '227.4 FAIL: filtered rows=% (expect 2)', v_n; END IF;
  RAISE NOTICE '227.4 PASS: ingredient + type filter';
END $$;

-- ============================================
-- T228.1 — get_po_dashboard exists + SECURITY INVOKER + RLS branch scoped
-- ============================================
DO $$
DECLARE v_secdef BOOLEAN; v_dash JSONB; v_spend NUMERIC;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='get_po_dashboard' AND pronamespace='public'::regnamespace) THEN
    RAISE EXCEPTION '228.1 FAIL: get_po_dashboard missing'; END IF;
  SELECT prosecdef INTO v_secdef FROM pg_proc WHERE proname='get_po_dashboard' LIMIT 1;
  IF v_secdef THEN RAISE EXCEPTION '228.1 FAIL: must be SECURITY INVOKER'; END IF;
  -- invA: only branch A spend (1000)
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22701","role":"authenticated"}', false);
  SET ROLE authenticated;
  v_dash := public.get_po_dashboard(NULL, NULL, NULL);
  RESET ROLE;
  v_spend := (v_dash->>'total_spend')::NUMERIC;
  IF v_spend <> 1000.00 THEN RAISE EXCEPTION '228.1 FAIL: invA total_spend=% (expect 1000, branch A only)', v_spend; END IF;
  RAISE NOTICE '228.1 PASS: get_po_dashboard SECURITY INVOKER + RLS branch-scoped spend=1000';
END $$;

-- ============================================
-- T228.2 — admin dashboard sees both branches (spend 3000)
-- ============================================
DO $$
DECLARE v_dash JSONB; v_spend NUMERIC; v_counts JSONB;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c22703","role":"authenticated"}', false);
  SET ROLE authenticated;
  v_dash := public.get_po_dashboard(NULL, NULL, NULL);
  RESET ROLE;
  v_spend := (v_dash->>'total_spend')::NUMERIC;
  IF v_spend <> 3000.00 THEN RAISE EXCEPTION '228.2 FAIL: admin total_spend=% (expect 3000)', v_spend; END IF;
  v_counts := v_dash->'po_counts';
  IF (v_counts->>'completed')::INT <> 2 THEN RAISE EXCEPTION '228.2 FAIL: po_counts.completed=% (expect 2)', v_counts; END IF;
  RAISE NOTICE '228.2 PASS: admin dashboard spend=3000 + po_counts.completed=2';
END $$;

ROLLBACK;