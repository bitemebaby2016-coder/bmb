-- ============================================================
-- STAGED REFERENCE — WP7: Price History Read API (ห้าม apply ใน WP1)
-- ที่มา: migration 225 เดิม (ย้ายตามคำสั่ง Owner 2026-11-26 §D)
-- แก้ตาม remediation:
--   - SECURITY INVOKER (ไม่ใช่ DEFINER) — RLS ของ migration 223 บังคับจริง
--     (staff read + has_org_row_scope + has_staff_branch_scope)
--   - ไม่มี package_size (DEFECT-5)
-- เป้าหมาย apply: WP7 (พร้อม integration test ของ WP7)
-- ============================================================

CREATE OR REPLACE FUNCTION get_purchase_price_history(
  p_ingredient_id TEXT DEFAULT NULL,
  p_supplier_id TEXT DEFAULT NULL,
  p_price_type TEXT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS SETOF purchase_price_history
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- SECURITY INVOKER: query นี้ถูกกรองด้วย RLS ของ purchase_price_history
  -- (pph_staff_read / pph_admin จาก migration 223) — cross-branch/other
  -- tenant rows หายไปตามสิทธิ์ผู้เรียกโดยอัตโนมัติ
  RETURN QUERY
  SELECT * FROM purchase_price_history
  WHERE (p_ingredient_id IS NULL OR ingredient_id = p_ingredient_id)
    AND (p_supplier_id IS NULL OR supplier_id = p_supplier_id)
    AND (p_price_type IS NULL OR price_type = p_price_type)
    AND (p_date_from IS NULL OR effective_date >= p_date_from)
    AND (p_date_to IS NULL OR effective_date <= p_date_to)
  ORDER BY effective_date DESC, created_at DESC
  LIMIT LEAST(p_limit, 500) OFFSET GREATEST(p_offset, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION get_purchase_price_history(TEXT, TEXT, TEXT, DATE, DATE, INT, INT) TO authenticated;
