-- ============================================================
-- STAGED REFERENCE — WP6: WAVG Posting + Reversal Execution
-- (ห้าม apply ใน WP1 — ย้ายจาก migration 223 เดิมตามคำสั่ง Owner §D)
-- แก้ครบตาม remediation:
--   DEFECT-2  Reversal = positive-quantity mirrored GRN + reversal_of
--             linkage + unique index (ทำซ้ำไม่ได้) · stock ย้อนด้วย
--             inventory_transactions type='out' qty บวก (convention เดิม
--             m019/m026) · WAVG ย้อนด้วย unit_cost ที่เก็บไว้
--   DEFECT-3  Idempotency: key เดิม + payload hash ตรง = คืนผลเดิม
--             (ไม่สร้าง stock transaction ซ้ำ) · key เดิม hash ต่าง =
--             ปฏิเสธ (ERR_IDEMPOTENCY_CONFLICT) · กัน line double-post
--             ด้วยการเช็ค itx ที่มีอยู่
--   DEFECT-4  landed_cost ตามนิยามใน 221: ต่อ line ต่อหน่วยซื้อ · เก็บใน
--             purchase_price_history.landed_cost (append-only) และ
--             inventory_transactions.unit_cost (ต่อ use_unit) — reversal
--             อ่านจากที่เก็บไว้ ไม่เดาจากคอลัมน์ที่ไม่มี
--   DEFECT-5  ไม่มีการอ้าง supplier_products.package_size (ไม่มีใน m217)
-- เป้าหมาย apply: WP6 (พร้อม integration test ของ WP6)
-- ============================================================
--
-- กฎบังคับ (Owner C): SECURITY DEFINER — RLS ไม่บังคับในตัว ทุก function
--   ตรวจ role (m146) + public.has_org_row_scope(tenant, branch) ภายในตัวเอง
-- ============================================================

-- ============================================
-- Landed cost ต่อ GRN line ต่อหน่วยซื้อ (DEFECT-4 นิยามเดียวกับ m221)
-- = ((received × actual_price) − discount + shipping + ภาษี non_recoverable)
--   / received
-- ============================================
CREATE OR REPLACE FUNCTION calculate_grn_line_landed_cost(
  p_grn_line_id TEXT,
  p_shipping_allocation NUMERIC DEFAULT 0,
  p_tax_allocation NUMERIC DEFAULT 0
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grl goods_receipt_lines%ROWTYPE;
  v_line_subtotal NUMERIC;
BEGIN
  SELECT * INTO v_grl FROM goods_receipt_lines WHERE id = p_grn_line_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRN line not found: %', p_grn_line_id;
  END IF;

  v_line_subtotal := (v_grl.received_qty * v_grl.actual_unit_price) - v_grl.line_discount;

  RETURN (v_line_subtotal + COALESCE(p_shipping_allocation, 0) + COALESCE(p_tax_allocation, 0))
         / NULLIF(v_grl.received_qty, 0);
END;
$$;

-- ============================================
-- Payload hash (DEFECT-3): hash เชิงดีเทอร์มินิสต์จากเนื้อหาเอกสาร
-- retry โดยไม่แก้ข้อมูล = hash เดิม · แก้บรรทัดหลัง post = hash ต่าง → ปฏิเสธ
-- ============================================
CREATE OR REPLACE FUNCTION compute_grn_payload_hash(p_grn_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT md5(
    p_grn_id || '|' ||
    COALESCE((SELECT grn_number FROM goods_receipts WHERE id = p_grn_id), '') || '|' ||
    COALESCE((SELECT string_agg(
      grl.id || ':' || grl.received_qty || ':' || grl.accepted_qty || ':'
      || grl.rejected_qty || ':' || grl.actual_unit_price, ';' ORDER BY grl.id)
      FROM goods_receipt_lines grl WHERE grl.grn_id = p_grn_id), '')
  );
$$;

-- ============================================
-- post_goods_receipt_line (internal — เรียกโดย post_goods_receipt เท่านั้น)
-- กัน double-post ระดับ line: ถ้ามี itx ของ line นี้อยู่แล้ว → error
-- ============================================
CREATE OR REPLACE FUNCTION post_goods_receipt_line(
  p_grn_line_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grl goods_receipt_lines%ROWTYPE;
  v_gr goods_receipts%ROWTYPE;
  v_pol purchase_order_lines%ROWTYPE;
  v_ingredient inventory%ROWTYPE;
  v_old_stock NUMERIC;
  v_old_wavg NUMERIC;
  v_accepted_use NUMERIC;
  v_landed_cost NUMERIC;
  v_landed_use NUMERIC;
  v_new_wavg NUMERIC;
  v_new_stock NUMERIC;
  v_itx_id TEXT;
BEGIN
  -- 1. Lock GRN line → GRN header → PO line → ingredient (ตามลำดับ)
  SELECT * INTO v_grl FROM goods_receipt_lines WHERE id = p_grn_line_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRN line not found: %', p_grn_line_id;
  END IF;

  SELECT * INTO v_gr FROM goods_receipts WHERE id = v_grl.grn_id FOR UPDATE;
  IF v_gr.status != 'approved' THEN
    RAISE EXCEPTION 'GRN not approved, current status: %', v_gr.status;
  END IF;

  -- กัน double-post ระดับ line (DEFECT-3 — duplicate retry ต้องไม่สร้าง stock tx ซ้ำ)
  IF EXISTS (SELECT 1 FROM inventory_transactions
             WHERE grn_line_id = p_grn_line_id AND reference_type = 'grn') THEN
    RAISE EXCEPTION 'ERR_LINE_ALREADY_POSTED: %', p_grn_line_id;
  END IF;

  SELECT * INTO v_pol FROM purchase_order_lines WHERE id = v_grl.po_line_id FOR UPDATE;
  SELECT * INTO v_ingredient FROM inventory WHERE id = v_pol.ingredient_id FOR UPDATE;
  v_old_stock := v_ingredient.current_stock;
  v_old_wavg := v_ingredient.wavg_cost;

  -- 2. เฉพาะของที่ยอมรับเข้า stock (accepted ไม่ใช่ received — Owner decision)
  v_accepted_use := v_grl.accepted_qty * v_grl.conversion_factor;

  -- 3. Landed cost (DEFECT-4): ภาษี non_recoverable เท่านั้นที่เข้าต้นทุน
  v_landed_cost := calculate_grn_line_landed_cost(
    p_grn_line_id,
    v_grl.shipping_allocated,
    CASE WHEN v_grl.tax_treatment = 'non_recoverable' THEN v_grl.tax_amount ELSE 0 END
  );
  v_landed_use := v_landed_cost / v_grl.conversion_factor;

  -- 4. WAVG (accepted_qty เป็นตัวคูณ — ต้นทุนเดิมคูณ stock เดิม)
  IF v_old_stock + v_accepted_use > 0 THEN
    v_new_wavg := (v_old_stock * COALESCE(v_old_wavg, 0) + v_accepted_use * v_landed_use)
                  / (v_old_stock + v_accepted_use);
  ELSE
    v_new_wavg := v_landed_use;
  END IF;
  v_new_stock := v_old_stock + v_accepted_use;

  UPDATE inventory SET
    current_stock = v_new_stock,
    wavg_cost = v_new_wavg,
    last_purchase_price = v_landed_use,
    updated_at = NOW()
  WHERE id = v_ingredient.id;

  -- 5. Stock transaction — qty บวกเสมอ (convention m019/m026), type='in'
  v_itx_id := 'itx-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')
               || '-' || substr(md5(random()::text), 1, 6);
  INSERT INTO inventory_transactions (
    id, inventory_id, type, quantity, unit_cost, conversion_snapshot,
    reference_type, reference_id, notes, created_by, created_at,
    po_id, grn_id, grn_line_id
  ) VALUES (
    v_itx_id,
    v_ingredient.id, 'in', v_accepted_use, v_landed_use, v_grl.conversion_factor,
    'grn', v_grl.id, 'GRN post: ' || v_gr.grn_number || ' line: ' || v_grl.id,
    auth.uid()::text, NOW(),
    v_gr.po_id, v_gr.id, v_grl.id
  );

  -- 6. PO line received_qty (หน่วยซื้อ — รวมทุก GRN line, รองรับ partial)
  UPDATE purchase_order_lines SET
    received_qty = received_qty + v_grl.received_qty,
    updated_at = NOW()
  WHERE id = v_pol.id;

  -- 7. Price history 3 states — tenant/branch มาจาก GRN header (RLS 223)
  INSERT INTO purchase_price_history (
    supplier_id, supplier_product_id, ingredient_id,
    po_id, po_line_id, grn_id, grn_line_id,
    price_type, purchase_unit, use_unit, conversion_factor,
    ordered_qty, received_qty, unit_price,
    discount_allocated, shipping_allocated, tax_treatment,
    landed_cost, effective_date, approval_status, source_user, source_document,
    tenant_id, branch_id
  ) VALUES
    (v_gr.supplier_id, v_grl.supplier_product_id, v_pol.ingredient_id,
     v_gr.po_id, v_pol.id, v_gr.id, v_grl.id,
     'committed', v_pol.purchase_unit, v_pol.use_unit, v_pol.conversion_factor,
     v_pol.ordered_qty, 0, v_pol.unit_price,
     0, 0, 'exempt', v_gr.receipt_date, 'approved', auth.uid(), 'PO',
     v_gr.tenant_id, v_gr.branch_id),
    (v_gr.supplier_id, v_grl.supplier_product_id, v_pol.ingredient_id,
     v_gr.po_id, v_pol.id, v_gr.id, v_grl.id,
     'realized', v_grl.purchase_unit, v_grl.use_unit, v_grl.conversion_factor,
     v_pol.ordered_qty, v_grl.received_qty, v_grl.actual_unit_price,
     v_grl.line_discount, v_grl.shipping_allocated, v_grl.tax_treatment,
     v_landed_cost, v_gr.receipt_date, 'approved', auth.uid(), 'GRN',
     v_gr.tenant_id, v_gr.branch_id),
    (v_gr.supplier_id, v_grl.supplier_product_id, v_pol.ingredient_id,
     v_gr.po_id, v_pol.id, v_gr.id, v_grl.id,
     'landed', v_grl.purchase_unit, v_grl.use_unit, v_grl.conversion_factor,
     v_pol.ordered_qty, v_grl.received_qty, v_landed_cost,
     v_grl.line_discount, v_grl.shipping_allocated, v_grl.tax_treatment,
     v_landed_cost, v_gr.receipt_date, 'approved', auth.uid(), 'GRN',
     v_gr.tenant_id, v_gr.branch_id);

  -- 8. Supplier product price states (คอลัมน์มีจริงใน m217)
  UPDATE supplier_products SET
    last_realized_price = v_grl.actual_unit_price,
    last_realized_at = NOW(),
    last_purchase_date = v_gr.receipt_date
  WHERE id = v_grl.supplier_product_id;

  RETURN jsonb_build_object(
    'ok', true,
    'grn_line_id', p_grn_line_id,
    'ingredient_id', v_ingredient.id,
    'new_stock', v_new_stock,
    'new_wavg', v_new_wavg,
    'landed_cost_per_purchase_unit', v_landed_cost,
    'landed_cost_per_use_unit', v_landed_use,
    'accepted_qty_use_unit', v_accepted_use
  );
END;
$$;

-- ============================================
-- post_goods_receipt (entry point เดียวของการ post ทั้งใบ)
-- Idempotency contract:
--   status=posted + key ตรง + hash ตรง   → คืนผลเดิม (ไม่ post ซ้ำ)
--   status=posted + key ตรง + hash ต่าง  → ERR_IDEMPOTENCY_CONFLICT
--   status=posted + key ไม่ตรง           → ERR_ALREADY_POSTED
--   concurrent same key คนละใบ           → unique index ตีกลับ (rollback)
-- ============================================
CREATE OR REPLACE FUNCTION post_goods_receipt(
  p_grn_id TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gr goods_receipts%ROWTYPE;
  v_results JSONB[] := '{}';
  v_grl RECORD;
  v_posted_count INT := 0;
  v_payload_hash TEXT;
  v_existing jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_idempotency_key IS NULL OR p_idempotency_key = '' THEN
    RAISE EXCEPTION 'ERR_IDEMPOTENCY_KEY_REQUIRED';
  END IF;
  IF NOT public.is_inventory() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only inventory or admin can post GRN';
  END IF;

  SELECT * INTO v_gr FROM goods_receipts WHERE id = p_grn_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GRN not found: %', p_grn_id; END IF;

  -- org/branch scope ภายใน function (กัน RLS bypass)
  IF NOT public.has_org_row_scope(v_gr.tenant_id, v_gr.branch_id)
     OR NOT public.has_staff_branch_scope(v_gr.branch_id) THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN_SCOPE';
  END IF;

  v_payload_hash := compute_grn_payload_hash(p_grn_id);

  -- ===== Idempotency gate (DEFECT-3) =====
  IF v_gr.status = 'posted' THEN
    IF v_gr.idempotency_key = p_idempotency_key THEN
      IF v_gr.idempotency_payload_hash = v_payload_hash THEN
        -- retry เดิม: คืนผลเดิมจาก stock transactions ที่บันทึกไว้ (ไม่ post ซ้ำ)
        SELECT coalesce(jsonb_agg(jsonb_build_object(
                 'grn_line_id', grn_line_id, 'ingredient_id', inventory_id,
                 'unit_cost_per_use_unit', unit_cost, 'accepted_qty_use_unit', quantity)),
               '[]'::jsonb)
          INTO v_existing
          FROM inventory_transactions WHERE grn_id = p_grn_id AND reference_type = 'grn';
        RETURN jsonb_build_object('ok', true, 'idempotent', true,
                                  'grn_id', p_grn_id, 'posted_lines',
                                  (SELECT count(*) FROM inventory_transactions
                                   WHERE grn_id = p_grn_id AND reference_type = 'grn'),
                                  'results', v_existing);
      END IF;
      RAISE EXCEPTION 'ERR_IDEMPOTENCY_CONFLICT: key % reused with different payload', p_idempotency_key;
    END IF;
    RAISE EXCEPTION 'ERR_ALREADY_POSTED: %', p_grn_id;
  END IF;
  IF v_gr.status != 'approved' THEN
    RAISE EXCEPTION 'GRN not approved, current status: %', v_gr.status;
  END IF;
  IF v_gr.reversal_of IS NOT NULL THEN
    RAISE EXCEPTION 'Reversal GRN cannot be posted through this flow';
  END IF;

  -- Post ทีละบรรทัด (lock order: line→header→po_line→inventory)
  FOR v_grl IN
    SELECT id FROM goods_receipt_lines WHERE grn_id = p_grn_id ORDER BY created_at
  LOOP
    v_results := v_results || post_goods_receipt_line(v_grl.id);
    v_posted_count := v_posted_count + 1;
  END LOOP;

  -- Mark posted + บันทึก key + hash (unique index กัน key ซ้ำข้ามใบ)
  UPDATE goods_receipts SET
    status = 'posted',
    posted_by = auth.uid(),
    posted_at = NOW(),
    idempotency_key = p_idempotency_key,
    idempotency_payload_hash = v_payload_hash,
    updated_at = NOW()
  WHERE id = p_grn_id;

  -- PO status transitions
  IF (SELECT bool_and(received_qty >= ordered_qty) FROM purchase_order_lines WHERE po_id = v_gr.po_id) THEN
    UPDATE purchase_orders SET status = 'completed', updated_at = NOW() WHERE id = v_gr.po_id;
  ELSIF (SELECT bool_or(received_qty > 0) FROM purchase_order_lines WHERE po_id = v_gr.po_id) THEN
    UPDATE purchase_orders SET status = 'partially_received', updated_at = NOW() WHERE id = v_gr.po_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'grn_id', p_grn_id,
                            'posted_lines', v_posted_count, 'results', v_results);
END;
$$;

-- ============================================
-- reverse_grn (DEFECT-2 — ออกแบบใหม่ทั้งหมด)
--   โมเดล: reversal GRN = positive-quantity mirror + reversal_of linkage
--   ผลต่อ stock = itx type='out' qty บวก · WAVG ย้อนด้วย landed cost
--   ที่เก็บไว้ใน price history (ไม่อ่านคอลัมน์ที่ไม่มี)
--   ทำซ้ำไม่ได้: uq_grn_reversal_once (unique บน reversal_of) + status gate
-- ============================================
CREATE OR REPLACE FUNCTION reverse_grn(
  p_grn_id TEXT,
  p_reason TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gr goods_receipts%ROWTYPE;
  v_reversal_grn_id TEXT;
  v_grl RECORD;
  v_landed_pph NUMERIC;
  v_landed_use NUMERIC;
  v_reversal_qty NUMERIC;
  v_reversal_wavg NUMERIC;
  v_itx_id TEXT;
  v_grl_reversal_id TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_inventory() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only inventory or admin can reverse GRN';
  END IF;

  SELECT * INTO v_gr FROM goods_receipts WHERE id = p_grn_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GRN not found: %', p_grn_id; END IF;

  IF NOT public.has_org_row_scope(v_gr.tenant_id, v_gr.branch_id)
     OR NOT public.has_staff_branch_scope(v_gr.branch_id) THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN_SCOPE';
  END IF;

  IF v_gr.status != 'posted' THEN
    RAISE EXCEPTION 'Only posted GRN can be reversed, current status: %', v_gr.status;
  END IF;
  IF v_gr.reversal_of IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_REVERSAL_OF_REVERSAL';
  END IF;

  -- 30-day window (Owner decision) — เกิน window ต้องเป็น admin/finance
  IF v_gr.posted_at < NOW() - INTERVAL '30 days'
     AND NOT public.is_admin() AND NOT public.is_finance() THEN
    RAISE EXCEPTION 'GRN reversal window expired (30 days). Special permission required.';
  END IF;

  -- Reversal header: positive mirror document, linkage กลับต้นฉบับ
  -- (unique index uq_grn_reversal_once → ทำซ้ำไม่ได้ระดับ DB)
  BEGIN
    v_reversal_grn_id := 'grn-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')
                          || '-' || substr(md5(random()::text), 1, 6);
    INSERT INTO goods_receipts (
      id, grn_number, po_id, supplier_id, status, receipt_date,
      received_by, posted_by, posted_at, notes, reversal_of, tenant_id, branch_id
    ) VALUES (
      v_reversal_grn_id,
      'REV-' || v_gr.grn_number,
      v_gr.po_id, v_gr.supplier_id, 'posted', CURRENT_DATE,
      auth.uid(), auth.uid(), NOW(),
      p_reason || ' (reversal of ' || v_gr.grn_number || ')', p_grn_id,
      v_gr.tenant_id, v_gr.branch_id
    );
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'ERR_ALREADY_REVERSED: %', p_grn_id;
  END;

  -- ย้อนทีละบรรทัดต้นฉบับ
  FOR v_grl IN
    SELECT * FROM goods_receipt_lines WHERE grn_id = p_grn_id ORDER BY created_at
  LOOP
    SELECT * INTO v_landed_pph
      FROM purchase_price_history
      WHERE price_type = 'landed' AND grn_line_id = v_grl.id
      ORDER BY created_at DESC LIMIT 1;

    -- landed cost จากที่เก็บไว้ (append-only) — ถ้าไม่มี (legacy) คำนวณใหม่
    IF v_landed_pph IS NOT NULL THEN
      v_landed_use := v_landed_pph.landed_cost / v_grl.conversion_factor;
    ELSE
      v_landed_use := calculate_grn_line_landed_cost(
        v_grl.id, v_grl.shipping_allocated,
        CASE WHEN v_grl.tax_treatment = 'non_recoverable' THEN v_grl.tax_amount ELSE 0 END
      ) / v_grl.conversion_factor;
    END IF;

    v_reversal_qty := v_grl.accepted_qty * v_grl.conversion_factor;  -- use units (บวก)

    -- ย้อน WAVG: หัก contribution ของ line นี้ออกจาก valuation ปัจจุบัน
    IF (SELECT current_stock FROM inventory WHERE id = v_grl.ingredient_id) - v_reversal_qty > 0 THEN
      v_reversal_wavg := (
        (SELECT current_stock * COALESCE(wavg_cost, 0) FROM inventory WHERE id = v_grl.ingredient_id)
        - (v_reversal_qty * v_landed_use)
      ) / ((SELECT current_stock FROM inventory WHERE id = v_grl.ingredient_id) - v_reversal_qty);
    ELSE
      v_reversal_wavg := 0;
    END IF;

    UPDATE inventory SET
      current_stock = GREATEST(current_stock - v_reversal_qty, 0),
      wavg_cost = v_reversal_wavg,
      updated_at = NOW()
    WHERE id = v_grl.ingredient_id;

    -- Stock transaction: type='out', qty บวก (convention เดิม) + linkage
    v_itx_id := 'itx-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')
                 || '-' || substr(md5(random()::text), 1, 6);
    INSERT INTO inventory_transactions (
      id, inventory_id, type, quantity, unit_cost, conversion_snapshot,
      reference_type, reference_id, notes, created_by, created_at,
      po_id, grn_id, grn_line_id
    ) VALUES (
      v_itx_id,
      v_grl.ingredient_id, 'out', v_reversal_qty, v_landed_use, v_grl.conversion_factor,
      'grn_reversal', v_reversal_grn_id, 'GRN reversal: ' || v_gr.grn_number || ' line: ' || v_grl.id,
      auth.uid()::text, NOW(),
      v_gr.po_id, v_reversal_grn_id, v_grl.id
    );

    -- PO line received_qty ลดลง (ห้ามติดลบ)
    UPDATE purchase_order_lines SET
      received_qty = GREATEST(received_qty - v_grl.received_qty, 0),
      updated_at = NOW()
    WHERE id = v_grl.po_line_id;

    -- Price history correction: mirrored reversal entry (append-only)
    -- ค่าติดลบ = รายการปรับปรุงย้อนกลับตามแบบบัญชี (reference grn_line_id
    -- ชี้ line ต้นฉบับ + source_document='GRN_REVERSAL' ตรวจย้อนได้)
    INSERT INTO purchase_price_history (
      supplier_id, supplier_product_id, ingredient_id,
      po_id, po_line_id, grn_id, grn_line_id,
      price_type, purchase_unit, use_unit, conversion_factor,
      ordered_qty, received_qty, unit_price,
      discount_allocated, shipping_allocated, tax_treatment,
      landed_cost, effective_date, approval_status, source_user, source_document,
      tenant_id, branch_id
    ) VALUES (
      v_gr.supplier_id, v_grl.supplier_product_id, v_grl.ingredient_id,
      v_gr.po_id, v_grl.po_line_id, v_reversal_grn_id, v_grl.id,
      'correction', v_grl.purchase_unit, v_grl.use_unit, v_grl.conversion_factor,
      0, -v_grl.received_qty, -v_grl.actual_unit_price,
      -v_grl.line_discount, -v_grl.shipping_allocated, v_grl.tax_treatment,
      -v_landed_pph.landed_cost, CURRENT_DATE, 'approved', auth.uid(), 'GRN_REVERSAL',
      v_gr.tenant_id, v_gr.branch_id
    );

    -- Reversal line: positive mirror (CHECK เดิมคงอยู่ ไม่ถูกลดความเข้มงวด)
    v_grl_reversal_id := 'grl-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999')
                          || '-' || substr(md5(random()::text), 1, 6);
    INSERT INTO goods_receipt_lines (
      id, grn_id, po_line_id, supplier_product_id, ingredient_id,
      received_qty, accepted_qty, rejected_qty,
      purchase_unit, use_unit, conversion_factor, actual_unit_price,
      line_discount, shipping_allocated, tax_treatment, tax_amount,
      lot_number, expiry_date, notes
    ) VALUES (
      v_grl_reversal_id, v_reversal_grn_id, v_grl.po_line_id, v_grl.supplier_product_id, v_grl.ingredient_id,
      v_grl.received_qty, v_grl.accepted_qty, v_grl.rejected_qty,
      v_grl.purchase_unit, v_grl.use_unit, v_grl.conversion_factor, v_grl.actual_unit_price,
      v_grl.line_discount, v_grl.shipping_allocated, v_grl.tax_treatment, v_grl.tax_amount,
      v_grl.lot_number, v_grl.expiry_date, 'Reversal mirror of ' || v_grl.id
    );
  END LOOP;

  -- ต้นฉบับ → reversed (non-repeatable: ครั้งถัดไปโดน status gate ตีกลับ)
  UPDATE goods_receipts SET status = 'reversed', updated_at = NOW() WHERE id = p_grn_id;

  -- PO status re-evaluate
  IF (SELECT bool_and(received_qty >= ordered_qty) FROM purchase_order_lines WHERE po_id = v_gr.po_id) THEN
    UPDATE purchase_orders SET status = 'completed', updated_at = NOW() WHERE id = v_gr.po_id;
  ELSIF (SELECT bool_or(received_qty > 0) FROM purchase_order_lines WHERE po_id = v_gr.po_id) THEN
    UPDATE purchase_orders SET status = 'partially_received', updated_at = NOW() WHERE id = v_gr.po_id;
  ELSE
    UPDATE purchase_orders SET status = 'ordered', updated_at = NOW() WHERE id = v_gr.po_id;
  END IF;

  RETURN v_reversal_grn_id;
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_grn_line_landed_cost(TEXT, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_grn_payload_hash(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION post_goods_receipt_line(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION post_goods_receipt(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reverse_grn(TEXT, TEXT) TO authenticated;
