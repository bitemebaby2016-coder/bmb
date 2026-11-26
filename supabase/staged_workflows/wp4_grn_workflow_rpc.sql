-- ============================================================
-- STAGED REFERENCE — WP4: GRN Workflow RPC (ห้าม apply ใน WP1)
-- ที่มา: migration 225 เดิม (ย้ายตามคำสั่ง Owner 2026-11-26 §D)
-- แก้ตาม remediation:
--   - org/branch scope ใน function (tenant/branch ของ GRN สืบทอดจาก PO)
--   - DEFECT-2 สอดคล้อง: GRN ปกติเท่านั้น (reversal ไม่อยู่ในไฟล์นี้)
--   - ไม่มีการอ้าง package_size
-- เป้าหมาย apply: WP4 (พร้อม integration test ของ WP4)
-- ============================================================

-- ============================================
-- GRN number generator (ใช้ sequence grn_number_seq จาก migration 220)
-- ============================================
CREATE OR REPLACE FUNCTION generate_grn_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq INT;
BEGIN
  v_seq := nextval('grn_number_seq');
  RETURN 'GRN-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || lpad(v_seq::TEXT, 4, '0');
END;
$$;

-- ============================================
-- create_grn_draft — รับของบางส่วน/หลายครั้ง ได้ (over-receive ห้าม)
-- tenant/branch ของ GRN = ของ PO (สืบทอด ไม่รับจากผู้เรียก)
-- ============================================
CREATE OR REPLACE FUNCTION create_grn_draft(
  p_po_id TEXT,
  p_lines JSONB,
  p_receipt_date DATE DEFAULT CURRENT_DATE,
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

  SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PO not found: %', p_po_id; END IF;

  -- org/branch scope: GRN สืบทอดขอบเขตจาก PO
  IF NOT public.has_org_row_scope(v_po.tenant_id, v_po.branch_id)
     OR NOT public.has_staff_branch_scope(v_po.branch_id) THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN_SCOPE';
  END IF;

  IF v_po.status NOT IN ('approved', 'ordered', 'partially_received') THEN
    RAISE EXCEPTION 'PO not in receivable status: %', v_po.status;
  END IF;

  v_grn_id := 'grn-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')
               || '-' || substr(md5(random()::text), 1, 6);
  v_grn_number := generate_grn_number();

  INSERT INTO goods_receipts (
    id, grn_number, po_id, supplier_id, status, receipt_date,
    received_by, notes, tenant_id, branch_id
  ) VALUES (
    v_grn_id, v_grn_number, p_po_id, v_po.supplier_id, 'draft', p_receipt_date,
    COALESCE(p_received_by, v_uid), p_notes, v_po.tenant_id, v_po.branch_id
  );

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_grl_id := 'grl-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')
                 || '-' || substr(md5(random()::text), 1, 6);

    v_received_qty := COALESCE((v_line->>'received_qty')::NUMERIC, 0);
    v_accepted_qty := COALESCE((v_line->>'accepted_qty')::NUMERIC, v_received_qty);
    v_rejected_qty := COALESCE((v_line->>'rejected_qty')::NUMERIC, 0);

    -- ตรวจล่วงหน้าให้ตรง CHECK grl_acceptance_balance (มาตรฐานเดียวกัน)
    IF v_accepted_qty + v_rejected_qty != v_received_qty THEN
      RAISE EXCEPTION 'accepted_qty + rejected_qty must equal received_qty';
    END IF;

    SELECT * INTO v_pol FROM purchase_order_lines WHERE id = (v_line->>'po_line_id')::TEXT;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PO line not found: %', v_line->>'po_line_id';
    END IF;
    IF v_pol.po_id != p_po_id THEN
      RAISE EXCEPTION 'PO line does not belong to this PO';
    END IF;

    SELECT * INTO v_sp FROM supplier_products WHERE id = v_pol.supplier_product_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Supplier product not found for PO line: %', v_pol.id;
    END IF;
    IF v_sp.conversion_factor != v_pol.conversion_factor THEN
      RAISE EXCEPTION 'Conversion factor mismatch between supplier product and PO line';
    END IF;

    -- Partial receiving: ปัจจุบัน + ครั้งนี้ ห้ามเกิน ordered
    IF v_pol.received_qty + v_received_qty > v_pol.ordered_qty THEN
      RAISE EXCEPTION 'Over-receive not allowed. Ordered: %, Already received: %, Attempting: %',
        v_pol.ordered_qty, v_pol.received_qty, v_received_qty;
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
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'grn_id', v_grn_id, 'grn_number', v_grn_number, 'status', 'draft');
END;
$$;

-- ============================================
-- approve_grn (inventory/admin เท่านั้น + scope)
-- ============================================
CREATE OR REPLACE FUNCTION approve_grn(p_grn_id TEXT)
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
    RAISE EXCEPTION 'Only inventory or admin can approve GRN';
  END IF;

  SELECT * INTO v_gr FROM goods_receipts WHERE id = p_grn_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GRN not found: %', p_grn_id; END IF;
  IF NOT public.has_org_row_scope(v_gr.tenant_id, v_gr.branch_id)
     OR NOT public.has_staff_branch_scope(v_gr.branch_id) THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN_SCOPE';
  END IF;

  IF v_gr.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft GRN can be approved, current status: %', v_gr.status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM goods_receipt_lines WHERE grn_id = p_grn_id) THEN
    RAISE EXCEPTION 'GRN must have at least one line';
  END IF;

  UPDATE goods_receipts SET
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_grn_id;

  RETURN jsonb_build_object('ok', true, 'grn_id', p_grn_id, 'status', 'approved');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_grn_number() TO authenticated;
GRANT EXECUTE ON FUNCTION create_grn_draft(TEXT, JSONB, DATE, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_grn(TEXT) TO authenticated;
