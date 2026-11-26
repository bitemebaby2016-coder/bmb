-- ============================================
-- Phase 2 WP8: PO Dashboard Read API
-- Migration 228
-- Scope (Owner Master Directive 2026-11-26 — WP8):
--   SECURITY INVOKER aggregate — RLS ของ purchase_orders + goods_receipts (m223)
--   บังคับทุก subquery (user ไม่เห็น branch อื่น = ตัวเลขไม่รวม branch นั้น)
-- Dependencies: 219 (purchase_orders/_lines), 220 (goods_receipts), 214 (suppliers), 223 (RLS)
-- Source: supabase/staged_workflows/wp8_po_dashboard_read_api.sql (promoted)
-- Note: SECURITY INVOKER — RLS จึงบังคับ
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_po_dashboard(
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
        'po_id', t.po_id, 'po_number', t.po_number, 'supplier', t.supplier,
        'status', t.status, 'expected_date', t.expected_date,
        'outstanding', t.outstanding
      )) FROM (
        SELECT po.id AS po_id, po.po_number, s.name AS supplier, po.status,
               po.expected_date,
               (SELECT SUM(ordered_qty - received_qty) FROM purchase_order_lines WHERE po_id = po.id) AS outstanding
        FROM purchase_orders po
        JOIN suppliers s ON s.id = po.supplier_id
        WHERE po.status IN ('approved', 'ordered', 'partially_received')
          AND (p_date_from IS NULL OR po.order_date >= p_date_from)
          AND (p_date_to IS NULL OR po.order_date <= p_date_to)
          AND (p_supplier_id IS NULL OR po.supplier_id = p_supplier_id)
        ORDER BY po.expected_date NULLS LAST
        LIMIT 20
      ) t
    ),
    'grns_awaiting_approval', (
      SELECT jsonb_agg(jsonb_build_object(
        'grn_id', t.grn_id, 'grn_number', t.grn_number, 'po_number', t.po_number,
        'supplier', t.supplier, 'receipt_date', t.receipt_date
      )) FROM (
        SELECT gr.id AS grn_id, gr.grn_number, po.po_number, s.name AS supplier, gr.receipt_date
        FROM goods_receipts gr
        JOIN purchase_orders po ON po.id = gr.po_id
        JOIN suppliers s ON s.id = gr.supplier_id
        WHERE gr.status IN ('submitted', 'approved')
          AND (p_date_from IS NULL OR gr.receipt_date >= p_date_from)
          AND (p_date_to IS NULL OR gr.receipt_date <= p_date_to)
        ORDER BY gr.receipt_date
        LIMIT 20
      ) t
    ),
    'top_suppliers', (
      SELECT jsonb_agg(jsonb_build_object(
        'supplier_id', t.supplier_id, 'supplier_name', t.supplier_name,
        'total_spend', t.total_spend
      )) FROM (
        SELECT s.id AS supplier_id, s.name AS supplier_name, COALESCE(SUM(po.total_amount), 0) AS total_spend
        FROM purchase_orders po
        JOIN suppliers s ON s.id = po.supplier_id
        WHERE po.status IN ('completed')
          AND (p_date_from IS NULL OR po.order_date >= p_date_from)
          AND (p_date_to IS NULL OR po.order_date <= p_date_to)
        GROUP BY s.id, s.name
        ORDER BY COALESCE(SUM(po.total_amount), 0) DESC
        LIMIT 10
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_po_dashboard(DATE, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_po_dashboard(DATE, DATE, TEXT) TO authenticated;

COMMIT;