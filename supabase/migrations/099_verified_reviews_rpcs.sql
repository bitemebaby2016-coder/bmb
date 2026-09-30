-- ============================================
-- Bite Me Baby — Migration 099: Verified reviews RPCs (were never deployed)
-- reviewApi.ts calls get_verified_reviews_batch + submit_verified_review but
-- no migration ever created them → every call fell back to per-product
-- direct table reads (the source of the 401 spam before M098).
-- SECURITY DEFINER + search_path pinned; only VERIFIED reviews are exposed.
-- Idempotent — CREATE OR REPLACE.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_verified_reviews_batch(
  p_product_ids text[],
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id text,
  product_id text,
  customer_name text,
  rating integer,
  comment text,
  created_at timestamptz,
  is_verified boolean,
  order_number text,
  product_name_display text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT r.id, r.product_id, r.customer_name, r.rating, r.comment,
         r.created_at, r.is_verified, r.order_number, r.product_name_display
  FROM public.reviews r
  WHERE r.is_verified = true
    AND r.product_id = ANY (p_product_ids)
  ORDER BY r.rating DESC, r.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 100), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_verified_reviews_batch(text[], integer) TO anon, authenticated;

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
  -- verify the order belongs to this customer and is completed
  IF NOT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.order_number = p_order_number AND o.customer_id = v_customer
  ) THEN
    RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND';
  END IF;

  SELECT customer_name INTO v_customer_name
    FROM public.orders WHERE order_number = p_order_number LIMIT 1;

  INSERT INTO public.reviews (product_id, customer_id, customer_name, rating, comment, is_verified, order_number, branch_id)
  VALUES (p_product_id, v_customer, v_customer_name, p_rating, p_comment, true, p_order_number, p_branch_id)
  RETURNING id INTO v_review_id;

  RETURN QUERY SELECT v_review_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_verified_review(text, text, integer, text, text) TO authenticated;

-- Verification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_verified_reviews_batch'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'submit_verified_review'
  ) THEN
    RAISE EXCEPTION 'ERR_REVIEWS_RPC_MISSING';
  END IF;
  RAISE NOTICE 'Reviews RPCs ready — get_verified_reviews_batch + submit_verified_review';
END $$;