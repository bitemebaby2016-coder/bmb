-- ============================================================
-- STAGED REFERENCE — WP8: PO Dashboard Read API (ห้าม apply ใน WP1)
-- ที่มา: migration 225 เดิม (ย้ายตามคำสั่ง Owner 2026-11-26 §D)
-- แก้ตาม remediation:
--   - SECURITY INVOKER — ทุก aggregate ผ่าน RLS ของตารางต้นทาง
--     (purchase_orders / goods_receipts — policies ของ migration 223)
--     user ที่ไม่เห็น branch อื่น จะไม่มีข้อมูล branch นั้นในตัวเลขด้วย
-- เป้าหมาย apply: WP8 (พร้อม integration test ของ WP8)
-- ============================================================

CREATE OR REPLACE FUNCTION get_po_dashboard(
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_supplier_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- SECURITY INVOKER: RLS ของ purchase_orders + goods_receipts บังคับทุก subquery
  SELECT jsonb_build_object(
    'po_counts', (
      SELECT jsonb_object_agg(status, cnt) FROM (
        SELECT status, COUNT(*) as cnt
        FROM purchase_orders
        WHERE (p_date_from IS NULL OR order_date >= p_date_from)
          AND (p_date_to IS NULL OR order_date <= p_date_to)
          AND (p_supplier_id IS NULL OR supplier_id = p_supplier_id)
        GROUP BY status
      ) s
    ),
    'grn_pending', (
      SELECT COUNT(*) FROM goods_receipts
      WHERE status IN ('draft', 'submitted')
        AND (p_date_from IS NULL OR receipt_date >= p_date_from)
        AND (p_date_to IS NULL OR receipt_date <= p_date_to)
    ),
    'total_spend', (
      SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders
      WHERE status IN ('approved', 'ordered', 'partially_received', 'completed')
        AND (p_date_from IS NULL OR order_date >= p_date_from)
        AND (p_date_to IS NULL OR order_date <= p_date_to)
        AND (p_supplier_id IS NULL OR supplier_id = p_supplier_id)
    ),
    'outstanding_qty', (
      SELECT COALESCE(SUM(pol.ordered_qty - pol.received_qty), 0)
      FROM purchase_order_lines pol
      JOIN purchase_orders po ON po.id = pol.po_id
      WHERE po.status IN ('approved', 'ordered', 'partially_received')
        AND (p_date_from IS NULL OR po.order_date >= p_date_from)
        AND (p_date_to IS NULL OR po.order_date <= p_date_to)
        AND (p_supplier_id IS NULL OR po.supplier_id = p_supplier_id)
    ),
    'pos_needing_action', (
      SELECT jsonb_agg(jsonb_build_object(
        'po_id', po.id, 'po_number', po.po_number, 'supplier', s.name,
        'status', po.status, 'expected_date', po.expected_date,
        'outstanding', (SELECT SUM(ordered_qty - received_qty) FROM purchase_order_lines WHERE po_id = po.id)
      )) FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.status IN ('approved', 'ordered', 'partially_received')
        AND (p_date_from IS NULL OR po.order_date >= p_date_from)
        AND (p_date_to IS NULL OR po.order_date <= p_date_to)
        AND (p_supplier_id IS NULL OR po.supplier_id = p_supplier_id)
      ORDER BY po.expected_date NULLS LAST
      LIMIT 20
    ),
    'grns_awaiting_approval', (
      SELECT jsonb_agg(jsonb_build_object(
        'grn_id', gr.id, 'grn_number', gr.grn_number, 'po_number', po.po_number,
        'supplier', s.name, 'receipt_date', gr.receipt_date
      )) FROM goods_receipts gr
      JOIN purchase_orders po ON po.id = gr.po_id
      JOIN suppliers s ON s.id = gr.supplier_id
      WHERE gr.status IN ('submitted', 'approved')
        AND (p_date_from IS NULL OR gr.receipt_date >= p_date_from)
        AND (p_date_to IS NULL OR gr.receipt_date <= p_date_to)
      ORDER BY gr.receipt_date
      LIMIT 20
    ),
    'top_suppliers', (
      SELECT jsonb_agg(jsonb_build_object(
        'supplier_id', s.id, 'supplier_name', s.name,
        'total_spend', COALESCE(SUM(po.total_amount), 0)
      )) FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.status IN ('completed')
        AND (p_date_from IS NULL OR po.order_date >= p_date_from)
        AND (p_date_to IS NULL OR po.order_date <= p_date_to)
      GROUP BY s.id, s.name
      ORDER BY COALESCE(SUM(po.total_amount), 0) DESC
      LIMIT 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_po_dashboard(DATE, DATE, TEXT) TO authenticated;
