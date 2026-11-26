-- ============================================================
-- STAGED REFERENCE — WP2: PO Workflow RPC (ห้าม apply ใน WP1)
-- ที่มา: migration 225 เดิม (ย้ายตามคำสั่ง Owner 2026-11-26 §D)
-- แก้ตาม remediation: org/branch scope ใน function + ไม่มี package_size
-- เป้าหมาย apply: WP2 (พร้อม integration test ของ WP2)
-- ============================================================
--
-- กฎบังคับ (Owner C): ทุก function SECURITY DEFINER ต้องตรวจ
--   1) role ด้วย predicate จาก m146 (is_staff/is_admin/...)
--   2) public.has_org_row_scope(p_tenant_id, p_branch_id) — ทุกครั้ง
--   3) staff ที่ถูก assign branch: บังคับ branch_id = branch ของตัวเอง
--      (ห้ามสร้างเอกสารต่าง branch) — ใช้ has_staff_branch_scope()
-- ============================================================

-- ============================================
-- PO number generator (ใช้ sequence po_number_seq จาก migration 219)
-- ============================================
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq INT;
BEGIN
  v_seq := nextval('po_number_seq');
  RETURN 'PO-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || lpad(v_seq::TEXT, 4, '0');
END;
$$;

-- ============================================
-- create_purchase_order
-- org scope: tenant/branch มาจาก caller (ถ้า staff ถูก assign branch
-- = บังคับใช้ branch ตัวเอง ไม่ยอมรับ branch อื่น)
-- ============================================
CREATE OR REPLACE FUNCTION create_purchase_order(
  p_supplier_id TEXT,
  p_lines JSONB,
  p_expected_date DATE DEFAULT NULL,
  p_shipping_amount NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_tax_amount NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL,
  p_tenant_id TEXT DEFAULT NULL,
  p_branch_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_po_id TEXT;
  v_po_number TEXT;
  v_line JSONB;
  v_line_id TEXT;
  v_sp supplier_products%ROWTYPE;
  v_subtotal NUMERIC := 0;
  v_total_amount NUMERIC;
  v_tenant TEXT;
  v_branch TEXT;
BEGIN
  -- org/role gates (SECURITY DEFINER — RLS ไม่บังคับที่นี่)
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

  SELECT COALESCE(tenant_id, 'tenant-bmb-001'), branch_id INTO v_tenant, v_branch
    FROM public.profiles WHERE id = v_uid;
  IF p_tenant_id IS NOT NULL AND p_tenant_id <> v_tenant THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN_TENANT';
  END IF;
  -- staff ที่ถูก assign branch: ห้ามสร้างเอกสารต่าง branch
  IF v_branch IS NOT NULL AND p_branch_id IS NOT NULL AND p_branch_id <> v_branch THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN_BRANCH';
  END IF;
  IF v_branch IS NOT NULL AND p_branch_id IS NULL THEN
    v_branch := v_branch;  -- ใช้ branch ของ caller
  END IF;

  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE id = p_supplier_id AND is_active) THEN
    RAISE EXCEPTION 'Supplier not found or inactive: %', p_supplier_id;
  END IF;

  v_po_id := 'po-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')
              || '-' || substr(md5(random()::text), 1, 6);
  v_po_number := generate_po_number();

  INSERT INTO purchase_orders (
    id, po_number, supplier_id, status, order_date, expected_date,
    requested_by, shipping_amount, discount_amount, tax_amount,
    total_amount, notes, tenant_id, branch_id, version
  ) VALUES (
    v_po_id, v_po_number, p_supplier_id, 'draft', CURRENT_DATE, p_expected_date,
    v_uid, p_shipping_amount, p_discount_amount, p_tax_amount,
    0, p_notes, v_tenant, COALESCE(p_branch_id, v_branch), 1
  );

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_id := 'pol-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')
                  || '-' || substr(md5(random()::text), 1, 6);

    SELECT * INTO v_sp FROM supplier_products WHERE id = (v_line->>'supplier_product_id')::TEXT;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Supplier product not found: %', v_line->>'supplier_product_id';
    END IF;
    IF v_sp.conversion_factor IS NULL OR v_sp.conversion_factor <= 0 THEN
      RAISE EXCEPTION 'Invalid conversion factor for supplier product: %', v_sp.id;
    END IF;

    INSERT INTO purchase_order_lines (
      id, po_id, supplier_product_id, ingredient_id,
      ordered_qty, purchase_unit, use_unit, conversion_factor,
      unit_price, line_discount, line_total, notes
    ) VALUES (
      v_line_id, v_po_id, v_sp.id, v_sp.ingredient_id,
      (v_line->>'ordered_qty')::NUMERIC, v_sp.purchase_unit, v_sp.use_unit, v_sp.conversion_factor,
      COALESCE((v_line->>'unit_price')::NUMERIC, v_sp.last_approved_price),
      COALESCE((v_line->>'line_discount')::NUMERIC, 0),
      0,
      v_line->>'notes'
    );

    UPDATE purchase_order_lines SET
      line_total = (ordered_qty * unit_price) - line_discount
    WHERE id = v_line_id;

    v_subtotal := v_subtotal + ((v_line->>'ordered_qty')::NUMERIC
                  * COALESCE((v_line->>'unit_price')::NUMERIC, v_sp.last_approved_price))
                  - COALESCE((v_line->>'line_discount')::NUMERIC, 0);
  END LOOP;

  v_total_amount := v_subtotal - p_discount_amount + p_shipping_amount + p_tax_amount;
  UPDATE purchase_orders SET
    subtotal = v_subtotal,
    total_amount = v_total_amount
  WHERE id = v_po_id;

  RETURN jsonb_build_object('ok', true, 'po_id', v_po_id, 'po_number', v_po_number, 'status', 'draft');
END;
$$;

-- ============================================
-- update_purchase_order (optimistic lock + status gate + org scope)
-- ============================================
CREATE OR REPLACE FUNCTION update_purchase_order(
  p_po_id TEXT,
  p_lines JSONB DEFAULT NULL,
  p_expected_date DATE DEFAULT NULL,
  p_shipping_amount NUMERIC DEFAULT NULL,
  p_discount_amount NUMERIC DEFAULT NULL,
  p_tax_amount NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_version INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po purchase_orders%ROWTYPE;
  v_uid UUID := auth.uid();
  v_line JSONB;
  v_line_id TEXT;
  v_sp supplier_products%ROWTYPE;
  v_subtotal NUMERIC := 0;
  v_total_amount NUMERIC;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

  SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PO not found: %', p_po_id; END IF;

  -- org/branch scope ภายใน function (กัน RLS bypass ของ SECURITY DEFINER)
  IF NOT public.has_org_row_scope(v_po.tenant_id, v_po.branch_id)
     OR NOT public.has_staff_branch_scope(v_po.branch_id) THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN_SCOPE';
  END IF;

  IF v_po.status NOT IN ('draft', 'submitted') THEN
    RAISE EXCEPTION 'Cannot edit PO in status: %', v_po.status;
  END IF;
  IF v_po.version != p_version THEN
    RAISE EXCEPTION 'Version mismatch. Current version: %, provided: %', v_po.version, p_version;
  END IF;

  IF p_expected_date IS NOT NULL THEN
    UPDATE purchase_orders SET expected_date = p_expected_date WHERE id = p_po_id;
  END IF;
  IF p_shipping_amount IS NOT NULL THEN
    UPDATE purchase_orders SET shipping_amount = p_shipping_amount WHERE id = p_po_id;
  END IF;
  IF p_discount_amount IS NOT NULL THEN
    UPDATE purchase_orders SET discount_amount = p_discount_amount WHERE id = p_po_id;
  END IF;
  IF p_tax_amount IS NOT NULL THEN
    UPDATE purchase_orders SET tax_amount = p_tax_amount WHERE id = p_po_id;
  END IF;
  IF p_notes IS NOT NULL THEN
    UPDATE purchase_orders SET notes = p_notes WHERE id = p_po_id;
  END IF;

  IF p_lines IS NOT NULL THEN
    DELETE FROM purchase_order_lines WHERE po_id = p_po_id;
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
      v_line_id := 'pol-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')
                    || '-' || substr(md5(random()::text), 1, 6);
      SELECT * INTO v_sp FROM supplier_products WHERE id = (v_line->>'supplier_product_id')::TEXT;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Supplier product not found: %', v_line->>'supplier_product_id';
      END IF;
      INSERT INTO purchase_order_lines (
        id, po_id, supplier_product_id, ingredient_id,
        ordered_qty, purchase_unit, use_unit, conversion_factor,
        unit_price, line_discount, line_total, notes
      ) VALUES (
        v_line_id, p_po_id, v_sp.id, v_sp.ingredient_id,
        (v_line->>'ordered_qty')::NUMERIC, v_sp.purchase_unit, v_sp.use_unit, v_sp.conversion_factor,
        COALESCE((v_line->>'unit_price')::NUMERIC, v_sp.last_approved_price),
        COALESCE((v_line->>'line_discount')::NUMERIC, 0),
        0,
        v_line->>'notes'
      );
      UPDATE purchase_order_lines SET
        line_total = (ordered_qty * unit_price) - line_discount
      WHERE id = v_line_id;
      v_subtotal := v_subtotal + ((v_line->>'ordered_qty')::NUMERIC
                    * COALESCE((v_line->>'unit_price')::NUMERIC, v_sp.last_approved_price))
                    - COALESCE((v_line->>'line_discount')::NUMERIC, 0);
    END LOOP;
  ELSE
    SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal FROM purchase_order_lines WHERE po_id = p_po_id;
  END IF;

  v_total_amount := v_subtotal - COALESCE(p_discount_amount, v_po.discount_amount)
                    + COALESCE(p_shipping_amount, v_po.shipping_amount)
                    + COALESCE(p_tax_amount, v_po.tax_amount);

  UPDATE purchase_orders SET
    subtotal = v_subtotal,
    total_amount = v_total_amount,
    version = version + 1
  WHERE id = p_po_id;

  RETURN jsonb_build_object('ok', true, 'po_id', p_po_id, 'version', v_po.version + 1);
END;
$$;

-- ============================================
-- submit_purchase_order
-- ============================================
CREATE OR REPLACE FUNCTION submit_purchase_order(p_po_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po purchase_orders%ROWTYPE;
  v_line_count INT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

  SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PO not found: %', p_po_id; END IF;
  IF NOT public.has_org_row_scope(v_po.tenant_id, v_po.branch_id)
     OR NOT public.has_staff_branch_scope(v_po.branch_id) THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN_SCOPE';
  END IF;
  IF v_po.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft PO can be submitted, current status: %', v_po.status;
  END IF;

  SELECT COUNT(*) INTO v_line_count FROM purchase_order_lines WHERE po_id = p_po_id;
  IF v_line_count = 0 THEN RAISE EXCEPTION 'PO must have at least one line'; END IF;
  IF EXISTS (SELECT 1 FROM purchase_order_lines WHERE po_id = p_po_id AND ordered_qty <= 0) THEN
    RAISE EXCEPTION 'All lines must have ordered_qty > 0';
  END IF;

  UPDATE purchase_orders SET status = 'submitted', updated_at = NOW() WHERE id = p_po_id;
  RETURN jsonb_build_object('ok', true, 'po_id', p_po_id, 'status', 'submitted');
END;
$$;

-- ============================================
-- approve_purchase_order (finance/admin เท่านั้น + scope)
-- ============================================
CREATE OR REPLACE FUNCTION approve_purchase_order(p_po_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po purchase_orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_finance() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only finance or admin can approve PO';
  END IF;

  SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PO not found: %', p_po_id; END IF;
  IF NOT public.has_org_row_scope(v_po.tenant_id, v_po.branch_id) THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN_SCOPE';
  END IF;
  IF v_po.status != 'submitted' THEN
    RAISE EXCEPTION 'Only submitted PO can be approved, current status: %', v_po.status;
  END IF;

  UPDATE purchase_orders SET
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_po_id;

  UPDATE supplier_products sp SET
    last_committed_price = pol.unit_price,
    last_committed_at = NOW()
  FROM purchase_order_lines pol
  WHERE sp.id = pol.supplier_product_id
    AND pol.po_id = p_po_id;

  RETURN jsonb_build_object('ok', true, 'po_id', p_po_id, 'po_number', v_po.po_number, 'status', 'approved');
END;
$$;

-- Grants (ใช้กับ migration 219-223 เท่านั้น)
GRANT EXECUTE ON FUNCTION generate_po_number() TO authenticated;
GRANT EXECUTE ON FUNCTION create_purchase_order(TEXT, JSONB, DATE, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_purchase_order(TEXT, JSONB, DATE, NUMERIC, NUMERIC, NUMERIC, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_purchase_order(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_purchase_order(TEXT) TO authenticated;
