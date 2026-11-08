-- ============================================================
-- Bite Me Baby — Migration 199: รีวิวต้องผ่านแอดมิน (D6f · R88) + ซ่อมดริฟต์คอลัมน์ m093
--   Owner 2026-11-08: "ช่องที่ลูกค้าเขียนรีวิวที่ลิงก์ไปต้องขึ้นโชว์จริง อัพเดทใหม่เสมอ
--   โดยถ้ามีรีวิวให้แอดมินอนุมัติก่อนและลบได้ตอบได้"
-- Context (probe prod READ-ONLY 2026-11-08 — e2e/_r88_probe*.cjs):
--   · prod `reviews` = 8 คอลัมน์ · 0 แถว — ไม่มี order_number/branch_id/product_name_display
--     (m093 อยู่ใน history แต่ ALTER ไม่เคยถูก execute → m099/m198 RPC พังตอนรันจริง)
--   · policy อ่านปัจจุบัน = is_verified=true (ไม่มี moderation) · แอดมินมี admins_all_reviews อยู่แล้ว
-- FIX = ① คอลัมน์ที่ m093 สั่งแต่หายจริง ② status(pending/approved/rejected) + reply
--       ③ RLS: สาธารณะเห็นเฉพาะ approved · เห็นของตัวเอง · INSERT ตรง = pending เท่านั้น
--       ④ แก้ RPC ทั้งสองตัว: batch = เฉพาะ approved · submit = เติมชื่อเมนู + status=pending
-- ห้ามทำซ้ำ: กติกา m099/m198 (delivered + dedupe) = คงเดิมทั้งหมด — เสริมเฉพาะส่วน R88
-- ============================================================

BEGIN;

-- ---- 1) คอลัมน์ที่ m093 สั่งไว้แต่ไม่เคยถูก apply (ดริฟต์ — ต้นตอ RPC พัง) ----
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS product_name_display TEXT;

-- ---- 2) moderation columns (Owner: แอดมินอนุมัติก่อนแสดง · ลบได้ · ตอบได้) ----
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reply TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;
DO $$ BEGIN
  ALTER TABLE public.reviews ADD CONSTRAINT reviews_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- แถวก่อนระบบอนุมัติ = เคยแสดงอยู่แล้ว → grandfather เป็น approved (ตอนนี้ตารางว่าง 0 แถว = no-op)
UPDATE public.reviews SET status = 'approved' WHERE status = 'pending' AND created_at < NOW();

-- กันซ้ำระดับ schema: 1 ออเดอร์ = 1 รีวิวต่อเมนู (เสริม guard ในฟังก์ชัน m198)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_order_product
  ON public.reviews (order_number, product_id)
  WHERE order_number IS NOT NULL;

-- ---- 3) RLS: สาธารณะเห็นเฉพาะ "แอดมินอนุมัติแล้ว" + เห็นของตัวเอง (สถานะไหนก็ได้) ----
DROP POLICY IF EXISTS public_read_verified_reviews ON public.reviews;
DROP POLICY IF EXISTS users_read_own_reviews ON public.reviews;
-- ลูกค้าไม่ต้องแก้รีวิวเอง — กันแก้ status ขึ้น approved เอง (แอดมินแก้ผ่าน admins_all_reviews)
DROP POLICY IF EXISTS customers_update_own_review ON public.reviews;
DROP POLICY IF EXISTS customers_insert_own_review ON public.reviews;
DROP POLICY IF EXISTS public_read_approved_reviews ON public.reviews;
DROP POLICY IF EXISTS customers_read_own_reviews ON public.reviews;
-- legacy duplicates 4 ตัว (เจอตอน verify — RLS PERMISSIVE = OR กัน → ตัวเก่า bypass moderation):
--   reviews_anon_read / reviews_public_read = อ่าน is_verified โดยไม่ดู status → pending รั่ว
--   reviews_own_update = ลูกค้าแก้ status ตัวเองเป็น approved ได้
--   reviews_own_insert = แทรก status='approved' ตรงได้ (customer_id IS NULL ก็ผ่าน)
DROP POLICY IF EXISTS reviews_anon_read ON public.reviews;
DROP POLICY IF EXISTS reviews_public_read ON public.reviews;
DROP POLICY IF EXISTS reviews_own_update ON public.reviews;
DROP POLICY IF EXISTS reviews_own_insert ON public.reviews;

CREATE POLICY public_read_approved_reviews ON public.reviews
  FOR SELECT TO public
  USING (status = 'approved');

CREATE POLICY customers_read_own_reviews ON public.reviews
  FOR SELECT TO authenticated
  USING (customer_id = (auth.uid())::text);

-- INSERT ตรง: ต้องเป็นของตัวเอง + อยู่ในคิวรออนุมัติเท่านั้น (อนุมัติ = แอดมินคนเดียว)
CREATE POLICY customers_insert_own_review ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = (auth.uid())::text AND status = 'pending');

-- (คงเดิมไม่แตะ: admins_all_reviews · reviews_admin_manage = แอดมินอนุมัติ/ตอบ/ลบผ่าน is_admin())

-- ---- 4) RPC get_verified_reviews_batch (m099) — เฉพาะ approved + คอลัมน์จริงครบ ----
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
    AND r.status = 'approved'              -- R88: แสดงเฉพาะที่แอดมินอนุมัติแล้ว
    AND r.product_id = ANY (p_product_ids)
  ORDER BY r.rating DESC, r.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 100), 1);
$$;

REVOKE EXECUTE ON FUNCTION public.get_verified_reviews_batch(text[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_verified_reviews_batch(text[], integer) TO anon, authenticated;

-- ---- 5) RPC submit_verified_review (m198 = กติกาเดิมครบ) + status=pending + ชื่อเมนู ----
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
  v_product_name text;
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
  -- R87/m198: verified = ได้รับของแล้วจริง — ออเดอร์ยังไม่ส่งมอบยังรีวิวไม่ได้
  IF NOT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.order_number = p_order_number AND o.customer_id = v_customer
      AND o.status = 'delivered'
  ) THEN
    RAISE EXCEPTION 'ERR_REVIEW_ORDER_NOT_DELIVERED';
  END IF;
  -- R87/m198: 1 ออเดอร์ = 1 รีวิวต่อเมนู (กดซ้ำ/สแปม = ไม่สร้างแถวใหม่)
  IF EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.order_number = p_order_number AND r.product_id = p_product_id
  ) THEN
    RAISE EXCEPTION 'ERR_REVIEW_ALREADY_EXISTS';
  END IF;

  SELECT customer_name INTO v_customer_name
    FROM public.orders WHERE order_number = p_order_number LIMIT 1;
  -- m093: ชื่อเมนู ณ ตอนรีวิว (cast กันชนิด id ต่างฝั่ง)
  SELECT name INTO v_product_name FROM public.products WHERE id::text = p_product_id LIMIT 1;

  INSERT INTO public.reviews
    (product_id, customer_id, customer_name, rating, comment, is_verified,
     order_number, branch_id, product_name_display, status)
  VALUES
    (p_product_id, v_customer, v_customer_name, p_rating, p_comment, true,
     p_order_number, p_branch_id, v_product_name, 'pending')   -- R88: รอแอดมินอนุมัติก่อนแสดง
  RETURNING id INTO v_review_id;

  RETURN QUERY SELECT v_review_id;
END;
$$;

-- ACL เท่า m099/m198 (authenticated เท่านั้น)
REVOKE EXECUTE ON FUNCTION public.submit_verified_review(text, text, integer, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_verified_review(text, text, integer, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_verified_review(text, text, integer, text, text) TO authenticated;

-- ---- 6) verification ----
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'order_number')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'status')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'reply') THEN
    RAISE EXCEPTION 'ERR_R88_REVIEW_COLUMNS_MISSING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'reviews'
                   AND policyname = 'public_read_approved_reviews') THEN
    RAISE EXCEPTION 'ERR_R88_MODERATION_POLICY_MISSING';
  END IF;
  -- legacy หละหลวมต้องหายไปหมด (ถ้ายังอยู่ = pending รั่ว / ลูกค้า self-approve ได้)
  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'reviews'
               AND policyname IN ('reviews_anon_read', 'reviews_public_read',
                                  'reviews_own_update', 'reviews_own_insert')) THEN
    RAISE EXCEPTION 'ERR_R88_LEGACY_POLICY_STILL_PRESENT';
  END IF;
  RAISE NOTICE 'R88 review moderation ready: columns + approved-only RLS + RPCs (new reviews = pending until admin approves)';
END $$;

COMMIT;
