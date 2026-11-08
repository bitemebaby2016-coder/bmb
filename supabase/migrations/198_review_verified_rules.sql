-- ============================================================
-- Bite Me Baby — Migration 198: verified review = ได้รับของแล้วจริง + 1 ออเดอร์/1 รีวิวต่อเมนู
--   (R87 · Owner 2026-11-08: "ระบบรีวิวทั้งเส้นต้องทำงานตามกฏ ห้ามมีม็อกฯ")
-- Context: m099 `submit_verified_review` ตรวจแค่ ownership — ออเดอร์ยังไม่ส่งมอบก็รีวิวได้
--   และกดซ้ำได้ไม่จำกัด (verified badge ต้องแปลว่า "ได้รับของแล้วจริง")
-- FIX = body เดิม + ① ต้อง status='delivered' ② กันซ้ำ (order_number, product_id)
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.submit_verified_review(
  p_order_number text,
  p_product_id text,
  p_rating integer,
  p_comment text,
  p_branch_id text DEFAULT NULL
)
RETURNS TABLE (review_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer text;
  v_customer_name text;
  v_review_id text;
BEGIN
  -- must be logged in
  v_customer := auth.uid()::text;
  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'ERR_NOT_LOGGED_IN';
  END IF;
  -- rating bounds
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'ERR_INVALID_RATING';
  END IF;
  -- verify the order belongs to this customer
  IF NOT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.order_number = p_order_number AND o.customer_id = v_customer
  ) THEN
    RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND';
  END IF;
  -- R87: verified = ได้รับของแล้วจริง — ออเดอร์ยังไม่ส่งมอบยังรีวิวไม่ได้
  IF NOT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.order_number = p_order_number AND o.customer_id = v_customer
      AND o.status = 'delivered'
  ) THEN
    RAISE EXCEPTION 'ERR_REVIEW_ORDER_NOT_DELIVERED';
  END IF;
  -- R87: 1 ออเดอร์ = 1 รีวิวต่อเมนู (กดซ้ำ/สแปม = ไม่สร้างแถวใหม่)
  IF EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.order_number = p_order_number AND r.product_id = p_product_id
  ) THEN
    RAISE EXCEPTION 'ERR_REVIEW_ALREADY_EXISTS';
  END IF;

  SELECT customer_name INTO v_customer_name
    FROM public.orders WHERE order_number = p_order_number LIMIT 1;

  INSERT INTO public.reviews (product_id, customer_id, customer_name, rating, comment, is_verified, order_number, branch_id)
  VALUES (p_product_id, v_customer, v_customer_name, p_rating, p_comment, true, p_order_number, p_branch_id)
  RETURNING id INTO v_review_id;

  RETURN QUERY SELECT v_review_id;
END;
$$;

-- ACL เท่า m099 (authenticated เท่านั้น)
REVOKE EXECUTE ON FUNCTION public.submit_verified_review(text, text, integer, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_verified_review(text, text, integer, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_verified_review(text, text, integer, text, text) TO authenticated;

COMMIT;
