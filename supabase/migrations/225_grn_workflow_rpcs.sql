-- ============================================
-- Phase 2 WP4: Goods Receipt (GRN) Workflow RPC
-- Migration 225
-- Scope (Owner Master Directive 2026-11-26 — WP4):
--   GRN Draft (partial / multi-receipt) + approve · PO outstanding check
--   (over-receive ห้าม) · accepted/rejected split · actual price + unit
--   conversion snapshot · lot/batch/expiry · audit · role gate (inventory/admin)
-- Dependencies: 220 (goods_receipts/_lines, grn_number_seq), 219 (PO/PO lines),
--               223 (has_org_row_scope), 146 (roles), 018 (audit), 217 (supplier_products)
-- Source: supabase/staged_workflows/wp4_grn_workflow_rpc.sql (promoted per Owner)
--
-- WP4 REMEDIATION (relative to staged reference):
--   DEFECT-WP4-1: staged เรียก has_staff_branch_scope helper ที่ไม่มีอยู่จริง —
--     ลบออก (has_org_row_scope บังคับ tenant+branch ครบแล้ว)
--   DEFECT-WP4-2: ใช้ Asia/Bangkok date แทน UTC date (กัน m190 BKK gate)
--   DEFECT-WP4-3: create_grn_draft gate = is_staff OR is_inventory (ผู้รับของ
--     คือ inventory; staged ที่ใช้ is_staff เดี่ยว กัน inventory ไม่ให้สร้าง GRN)
--   เพิ่ม audit trail (create/approve) + REVOKE/GRANT
-- กฎ Owner C: SECURITY DEFINER ตรวจ role + has_org_row_scope ภายในตัวเอง
-- ============================================

BEGIN;

-- ============================================
-- GRN number generator (sequence grn_number_seq จาก m220)
-- format: GRN-YYYYMMDD-{seq:04d} · BKK date
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_grn_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq INT;
  v_today DATE := (now() AT TIME ZONE 'Asia/Bangkok')::date;
BEGIN
  v_seq := nextval('grn_number_seq');
  RETURN 'GRN-' || to_char(v_today, 'YYYYMMDD') || '-' || lpad(v_seq::TEXT, 4, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_grn_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_grn_number() TO authenticated;

-- ============================================
-- create_grn_draft — partial / multi-receipt (over-receive ห้าม)
-- tenant/branch สืบทอดจาก PO header (ไม่รับจากผู้เรียก)
-- ============================================
CREATE OR REPLACE FUNCTION public.create_grn_draft(
  p_po_id TEXT,
  p_lines JSONB,
  p_receipt_date DATE DEFAULT NULL,
  p_received_by UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_po purchase_orders%ROWTYPE;
  v_grn_id TEXT;
  v_grn_number TEXT;
  v_line JSONB;
  v_grl_id TEXT;
  v_pol purchase_order_lines%ROWTYPE;
  v_sp supplier_products%ROWTYPE;
  v_received_qty NUMERIC;
  v_accepted_qty NUMERIC;
  v_rejected_qty NUMERIC;
  v_committed NUMERIC;
  v_today DATE := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_line_count INT := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  -- ผู้รับของ = inventory (หรือ staff/admin ที่เป็นผู้รับก็ได้)
  IF NOT public.is_staff() AND NOT public.is_inventory() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

  SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_PO_NOT_FOUND: %', p_po_id; END IF;

  -- org/branch scope: GRN สืบทอดขอบเขตจาก PO
  IF NOT public.has_org_row_scope(v_po.tenant_id, v_po.branch_id) THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN_SCOPE';
  END IF;

  IF v_po.status NOT IN ('approved', 'ordered', 'partially_received') THEN
    RAISE EXCEPTION 'ERR_PO_NOT_RECEIVABLE: PO not in receivable status: %', v_po.status;
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'ERR_NO_LINES: GRN must have at least one line';
  END IF;

  v_grn_id := 'grn-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')
               || '-' || substr(md5(random()::text), 1, 6);
  v_grn_number := public.generate_grn_number();

  INSERT INTO goods_receipts (
    id, grn_number, po_id, supplier_id, status, receipt_date,
    received_by, notes, tenant_id, branch_id
  ) VALUES (
    v_grn_id, v_grn_number, p_po_id, v_po.supplier_id, 'draft', COALESCE(p_receipt_date, v_today),
    COALESCE(p_received_by, v_uid), p_notes, v_po.tenant_id, v_po.branch_id
  );

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_grl_id := 'grl-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')
                 || '-' || substr(md5(random()::text), 1, 6);

    v_received_qty := COALESCE((v_line->>'received_qty')::NUMERIC, 0);
    v_accepted_qty := COALESCE((v_line->>'accepted_qty')::NUMERIC, v_received_qty);
    v_rejected_qty := COALESCE((v_line->>'rejected_qty')::NUMERIC, 0);

    IF v_received_qty <= 0 THEN
      RAISE EXCEPTION 'ERR_INVALID_QTY: received_qty must be > 0';
    END IF;
    -- ตรวจล่วงหน้าให้ตรง CHECK grl_acceptance_balance
    IF v_accepted_qty + v_rejected_qty <> v_received_qty THEN
      RAISE EXCEPTION 'ERR_ACCEPTANCE_BALANCE: accepted_qty + rejected_qty must equal received_qty';
    END IF;

    SELECT * INTO v_pol FROM purchase_order_lines WHERE id = (v_line->>'po_line_id')::TEXT;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ERR_PO_LINE_NOT_FOUND: %', v_line->>'po_line_id';
    END IF;
    IF v_pol.po_id <> p_po_id THEN
      RAISE EXCEPTION 'ERR_PO_LINE_MISMATCH: PO line does not belong to this PO';
    END IF;

    SELECT * INTO v_sp FROM supplier_products WHERE id = v_pol.supplier_product_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ERR_SUPPLIER_PRODUCT_NOT_FOUND: PO line %', v_pol.id;
    END IF;
    IF v_sp.conversion_factor <> v_pol.conversion_factor THEN
      RAISE EXCEPTION 'ERR_CONVERSION_MISMATCH: supplier product vs PO line';
    END IF;

    -- Partial receiving: cumulative (posted + committed in other non-cancelled
    -- GRNs) + this ห้ามเกิน ordered — กัน over-receive หลายใบก่อนถูก post
    SELECT COALESCE(SUM(received_qty), 0) INTO v_committed
      FROM goods_receipt_lines grl
      JOIN goods_receipts gr ON gr.id = grl.grn_id
     WHERE grl.po_line_id = v_pol.id
       AND gr.status IN ('draft', 'submitted', 'approved', 'posted');
    IF v_committed + v_received_qty > v_pol.ordered_qty THEN
      RAISE EXCEPTION 'ERR_OVER_RECEIVE: ordered %, already committed/received %, attempting %',
        v_pol.ordered_qty, v_committed, v_received_qty;
    END IF;

    INSERT INTO goods_receipt_lines (
      id, grn_id, po_line_id, supplier_product_id, ingredient_id,
      received_qty, accepted_qty, rejected_qty,
      purchase_unit, use_unit, conversion_factor, actual_unit_price,
      line_discount, shipping_allocated, tax_treatment, tax_amount,
      lot_number, expiry_date, notes
    ) VALUES (
      v_grl_id, v_grn_id, v_pol.id, v_sp.id, v_pol.ingredient_id,
      v_received_qty, v_accepted_qty, v_rejected_qty,
      v_pol.purchase_unit, v_pol.use_unit, v_pol.conversion_factor,
      COALESCE((v_line->>'actual_unit_price')::NUMERIC, v_pol.unit_price),
      COALESCE((v_line->>'line_discount')::NUMERIC, 0),
      COALESCE((v_line->>'shipping_allocated')::NUMERIC, 0),
      COALESCE(v_line->>'tax_treatment', 'exempt'),
      COALESCE((v_line->>'tax_amount')::NUMERIC, 0),
      v_line->>'lot_number',
      (v_line->>'expiry_date')::DATE,
      v_line->>'notes'
    );
    v_line_count := v_line_count + 1;
  END LOOP;

  PERFORM public.append_audit_log(
    p_action := 'grn_create', p_entity_type := 'goods_receipt', p_entity_id := v_grn_id,
    p_description := 'created ' || v_grn_number,
    p_metadata := jsonb_build_object('grn_number', v_grn_number, 'po_id', p_po_id, 'lines', v_line_count));

  RETURN jsonb_build_object('ok', true, 'grn_id', v_grn_id, 'grn_number', v_grn_number, 'status', 'draft');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_grn_draft(TEXT, JSONB, DATE, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_grn_draft(TEXT, JSONB, DATE, UUID, TEXT) TO authenticated;

-- ============================================
-- approve_grn (inventory/admin เท่านั้น + status gate + org scope)
-- ============================================
CREATE OR REPLACE FUNCTION public.approve_grn(p_grn_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gr goods_receipts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_inventory() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN_APPROVER: Only inventory or admin can approve GRN';
  END IF;

  SELECT * INTO v_gr FROM goods_receipts WHERE id = p_grn_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_GRN_NOT_FOUND: %', p_grn_id; END IF;
  IF NOT public.has_org_row_scope(v_gr.tenant_id, v_gr.branch_id) THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN_SCOPE';
  END IF;

  IF v_gr.status <> 'draft' THEN
    RAISE EXCEPTION 'ERR_INVALID_TRANSITION: Only draft GRN can be approved, current status: %', v_gr.status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM goods_receipt_lines WHERE grn_id = p_grn_id) THEN
    RAISE EXCEPTION 'ERR_NO_LINES: GRN must have at least one line';
  END IF;

  UPDATE goods_receipts SET
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_grn_id;

  PERFORM public.append_audit_log(
    p_action := 'grn_approve', p_entity_type := 'goods_receipt', p_entity_id := p_grn_id,
    p_description := 'approved ' || v_gr.grn_number,
    p_metadata := jsonb_build_object('grn_number', v_gr.grn_number, 'po_id', v_gr.po_id));

  RETURN jsonb_build_object('ok', true, 'grn_id', p_grn_id, 'status', 'approved');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_grn(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_grn(TEXT) TO authenticated;

COMMIT;