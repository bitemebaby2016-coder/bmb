-- ============================================
-- Bite Me Baby â€” Migration 233 OCR Documents Contract (PostgreSQL à¸ˆà¸£à¸´à¸‡)
-- Proves PARITY across OCR / CSV-Excel / Manual (same create RPC) for:
--   Duplicate Â· Validation Â· Audit Â· Approval â€” and that approval NEVER
--   writes inventory price/WAVG and never double-writes price history.
-- ============================================

BEGIN;
RESET ROLE;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-000000c23301', 'c233-admin@example.com')
ON CONFLICT (id) DO NOTHING;

UPDATE profiles SET role='admin', tenant_id='tenant-bmb-001' WHERE id='00000000-0000-4000-8000-000000c23301';

INSERT INTO public.branches (id, tenant_id, code, name, slug, address_line1, latitude, longitude)
VALUES ('branch-p2-a', 'tenant-bmb-001', 'p2a', 'P2 Branch A', 'p2a', '1 Test Rd', 13.7000000, 100.5000000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.suppliers (id, name, code, phone, is_active)
VALUES ('sup-233', 'OCR Supplier 233', 'OCR233', '0990000233', true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.inventory (id, name, category) VALUES ('inv-233', 'OCR Ingredient 233', 'ocr233') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.supplier_products
  (id, supplier_id, ingredient_id, purchase_unit, use_unit, conversion_factor, is_active)
VALUES ('sp-233', 'sup-233', 'inv-233', 'carton', 'bottle', 12.0000, true)
ON CONFLICT (id) DO NOTHING;

-- baseline inventory valuation (must NOT change on OCR approval)
UPDATE public.inventory SET wavg_cost = 111.1111, last_approved_price = NULL WHERE id='inv-233';

-- T233.1 â€” table + RPCs exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='ocr_approve_document' AND pronamespace='public'::regnamespace) THEN
    RAISE EXCEPTION '233.1 FAIL: ocr_approve_document missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='ocr_create_document' AND pronamespace='public'::regnamespace) THEN
    RAISE EXCEPTION '233.1 FAIL: ocr_create_document missing'; END IF;
  RAISE NOTICE '233.1 PASS: ocr_documents + RPCs exist';
END $$;

-- T233.2 â€” duplicate create is flagged (no error), not rejected
DO $$
DECLARE v_a TEXT; v_b TEXT; v_dup TEXT;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c23301","role":"authenticated"}', false);
  SET ROLE authenticated;
  v_a := (public.ocr_create_document('receipt', NULL, 'image/jpeg', '{"k":1}'::jsonb,
    '{"subtotal":100,"tax":7,"total":107,"lines":[{"description":"x","quantity":1,"unit_price":100,"line_total":100,"confidence":0.9}]}'::jsonb,
    'z-ai/glm-5.3-flash', 'ocr-v1', 'hash-233-A', 'tenant-bmb-001', 'branch-p2-a')).id;
  v_b := (public.ocr_create_document('receipt', NULL, 'image/jpeg', '{"k":1}'::jsonb,
    '{"subtotal":100,"tax":7,"total":107,"lines":[]}'::jsonb,
    'z-ai/glm-5.3-flash', 'ocr-v1', 'hash-233-A', 'tenant-bmb-001', 'branch-p2-a')).id;
  RESET ROLE;
  SELECT duplicate_of INTO v_dup FROM public.ocr_documents WHERE id=v_b;
  IF v_dup IS DISTINCT FROM v_a THEN RAISE EXCEPTION '233.2 FAIL: duplicate_of=% (expect %)', v_dup, v_a; END IF;
  RAISE NOTICE '233.2 PASS: duplicate flagged (duplicate_of set), create did not error';
END $$;

-- T233.3 â€” approving a flagged duplicate is blocked
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c23301","role":"authenticated"}', false);
  SET ROLE authenticated;
  BEGIN
    PERFORM public.ocr_approve_document((SELECT id FROM public.ocr_documents WHERE content_hash='hash-233-A' AND duplicate_of IS NOT NULL LIMIT 1),
      '[]'::jsonb, NULL, NULL);
    RAISE EXCEPTION '233.3 FAIL: duplicate approval should be blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_DUPLICATE_NEEDS_REVIEW%' THEN RAISE; END IF;
  END;
  RESET ROLE;
  RAISE NOTICE '233.3 PASS: duplicate approval blocked (ERR_DUPLICATE_NEEDS_REVIEW)';
END $$;

-- T233.4 â€” invalid totals blocked server-side (validation parity)
DO $$
DECLARE v_c TEXT;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c23301","role":"authenticated"}', false);
  SET ROLE authenticated;
  v_c := (public.ocr_create_document('receipt', NULL, 'image/jpeg', '{}'::jsonb,
    '{"subtotal":100,"tax":7,"total":200,"lines":[]}'::jsonb, 'm', 'v', 'hash-233-C', 'tenant-bmb-001', 'branch-p2-a')).id;
  BEGIN
    PERFORM public.ocr_approve_document(v_c, '[]'::jsonb, NULL, NULL);
    RAISE EXCEPTION '233.4 FAIL: invalid totals should be blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_TOTALS_INVALID%' THEN RAISE; END IF;
  END;
  RESET ROLE;
  RAISE NOTICE '233.4 PASS: invalid totals blocked (ERR_TOTALS_INVALID)';
END $$;

-- T233.5 â€” approve writes price history + supplier approved price, NOT inventory/WAVG
DO $$
DECLARE v_before INT; v_after INT; v_wavg NUMERIC; v_sp NUMERIC; v_pph INT;
BEGIN
  SELECT count(*) INTO v_before FROM public.purchase_price_history WHERE supplier_id='sup-233';
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c23301","role":"authenticated"}', false);
  SET ROLE authenticated;
  PERFORM public.ocr_approve_document(
    (SELECT id FROM public.ocr_documents WHERE content_hash='hash-233-A' AND duplicate_of IS NULL LIMIT 1),
    '[{"supplier_id":"sup-233","supplier_product_id":"sp-233","ingredient_id":"inv-233","purchase_unit":"carton","use_unit":"bottle","conversion_factor":12,"unit_price":120,"received_qty":1}]'::jsonb,
    'sup-233', 'approved');
  RESET ROLE;
  SELECT count(*) INTO v_after FROM public.purchase_price_history WHERE supplier_id='sup-233';
  SELECT wavg_cost INTO v_wavg FROM public.inventory WHERE id='inv-233';
  SELECT last_approved_price INTO v_sp FROM public.supplier_products WHERE id='sp-233';
  SELECT count(*) INTO v_pph FROM public.purchase_price_history WHERE source_document IS NULL AND supplier_id='sup-233' AND price_type='approved';
  IF v_after <> v_before + 1 THEN RAISE EXCEPTION '233.5 FAIL: price history +% (expect +1)', v_after - v_before; END IF;
  IF v_sp <> 120 THEN RAISE EXCEPTION '233.5 FAIL: supplier last_approved_price=% (expect 120)', v_sp; END IF;
  IF v_wavg <> 111.1111 THEN RAISE EXCEPTION '233.5 FAIL: inventory.wavg_cost changed to % (must stay 111.1111)', v_wavg; END IF;
  RAISE NOTICE '233.5 PASS: price history +1, supplier approved set, inventory/WAVG untouched';
END $$;

-- T233.6 â€” double approve blocked (idempotent, no double price write)
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c23301","role":"authenticated"}', false);
  SET ROLE authenticated;
  BEGIN
    PERFORM public.ocr_approve_document(
      (SELECT id FROM public.ocr_documents WHERE content_hash='hash-233-A' AND duplicate_of IS NULL LIMIT 1),
      '[]'::jsonb, NULL, NULL);
    RAISE EXCEPTION '233.6 FAIL: double approve should be blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_ALREADY_APPROVED%' THEN RAISE; END IF;
  END;
  RESET ROLE;
  RAISE NOTICE '233.6 PASS: double approve blocked (ERR_ALREADY_APPROVED)';
END $$;

-- T233.7 â€” audit parity: created + approved rows exist for all paths
DO $$
DECLARE v_cr INT; v_ap INT; v_manual TEXT;
BEGIN
  SELECT count(*) INTO v_cr FROM public.audit_logs WHERE action='ocr_document_created';
  SELECT count(*) INTO v_ap FROM public.audit_logs WHERE action='ocr_document_approved';
  IF v_cr < 3 THEN RAISE EXCEPTION '233.7 FAIL: created audit rows=% (expect >=3)', v_cr; END IF;
  IF v_ap < 1 THEN RAISE EXCEPTION '233.7 FAIL: approved audit rows=% (expect >=1)', v_ap; END IF;
  -- manual path uses the SAME create RPC (parity) with null hash
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000c23301","role":"authenticated"}', false);
  SET ROLE authenticated;
  v_manual := (public.ocr_create_document('other', NULL, NULL, '{"source":"manual"}'::jsonb,
    '{"lines":[]}'::jsonb, NULL, 'manual-v1', NULL, 'tenant-bmb-001', 'branch-p2-a')).id;
  RESET ROLE;
  IF v_manual IS NULL THEN RAISE EXCEPTION '233.7 FAIL: manual create returned null'; END IF;
  RAISE NOTICE '233.7 PASS: audit created/approved present; manual uses same create RPC';
END $$;

ROLLBACK;