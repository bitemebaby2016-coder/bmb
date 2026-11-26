-- ============================================
-- Phase 2 WP7: Price History Read API
-- Migration 227
-- Scope (Owner Master Directive 2026-11-26 — WP7):
--   SECURITY INVOKER read API — RLS ของ m223 (pph_staff_read / pph_admin)
--   บังคับจริง (cross-branch/other-tenant rows หายตามสิทธิ์ผู้เรียก)
-- Dependencies: 221 (purchase_price_history), 223 (RLS policies)
-- Source: supabase/staged_workflows/wp7_price_history_read_api.sql (promoted)
-- Note: SECURITY INVOKER (ไม่ใช่ DEFINER) — RLS จึงบังคับ
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_purchase_price_history(
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
  -- SECURITY INVOKER: query ถูกกรองด้วย RLS ของ purchase_price_history
  -- (pph_staff_read / pph_admin จาก m223) — cross-branch/other tenant หายเอง
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

REVOKE EXECUTE ON FUNCTION public.get_purchase_price_history(TEXT, TEXT, TEXT, DATE, DATE, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_purchase_price_history(TEXT, TEXT, TEXT, DATE, DATE, INT, INT) TO authenticated;

COMMIT;