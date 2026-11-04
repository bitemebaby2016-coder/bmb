-- ============================================================
-- Bite Me Baby — Migration 185: ADMIN SWITCHES (Owner R66 Workstream B)
-- 1) MASTER เปิด/ปิดร้าน — business_settings.store_master_open
--    "อยู่เหนือกฎทั้งหมด": trigger BEFORE INSERT ON orders บล็อกทุกช่องทาง
--    (ออนไลน์ + POS) เมื่อปิด · UPDATE เดิม (ส่งมอบ/ปิดกะ/ยกเลิก) ยังใช้ได้ปกติ
-- 2) per-category mode: product_categories.allow_same_day / allow_pre_order
--    trigger BEFORE INSERT ON order_items บล็อกสินค้าจากหมวดที่ไม่เปิดรับโหมดนั้น
-- 3) per-product "current+future" = products.is_available เดิมอยู่แล้ว
--    (client filter + getSameDay/Preorder selectors + cart block) — ไม่แตะ
-- Policy: additive-only · missing key/row = เปิดร้าน (ZERO-FAKE ห้ามเดาปิด)
-- ============================================================

-- ---------- 1. seed master switch (default = เปิด) ----------
INSERT INTO public.business_settings (key, value, updated_at)
VALUES ('store_master_open', '{"open": true}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

-- ---------- 2. category mode columns ----------
ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS allow_same_day BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS allow_pre_order BOOLEAN NOT NULL DEFAULT true;

-- ---------- 3. master reader (SECURITY DEFINER — อ่าน business_settings ได้ทุก role) ----------
CREATE OR REPLACE FUNCTION public.store_master_is_open()
RETURNS boolean
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v TEXT;
BEGIN
  SELECT COALESCE(value::text, '') INTO v
    FROM public.business_settings WHERE key = 'store_master_open';
  IF v IS NULL OR v = '' THEN RETURN true; END IF;  -- ไม่มีค่า = เปิด (ห้ามเดาปิด)
  RETURN COALESCE((v::jsonb ->> 'open')::boolean, true);
EXCEPTION WHEN others THEN
  RETURN true; -- ค่าเพี้ยน = ไม่บล็อก (แอดมินแก้ค่าได้จากหน้า settings)
END;
$$;
REVOKE ALL ON FUNCTION public.store_master_is_open() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_master_is_open() TO PUBLIC, anon, authenticated, service_role;

-- ---------- 4. MASTER gate: บล็อกออเดอร์ใหม่ทุกช่องทาง ----------
CREATE OR REPLACE FUNCTION public.trg_orders_master_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.store_master_is_open() THEN
    RAISE EXCEPTION 'ERR_STORE_CLOSED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_master_gate ON public.orders;
CREATE TRIGGER trg_orders_master_gate
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_master_gate();

-- ---------- 5. category mode gate:  itemCount ตามโหมดของออเดอร์ ----------
CREATE OR REPLACE FUNCTION public.trg_order_items_category_mode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode TEXT;
  v_same BOOLEAN;
  v_pre  BOOLEAN;
BEGIN
  SELECT o.order_mode::text INTO v_mode
    FROM public.orders o WHERE o.id = NEW.order_id;
  IF v_mode IS NULL OR v_mode NOT IN ('SAME_DAY', 'PRE_ORDER') THEN
    RETURN NEW; -- ไม่ระบุโหมด = ไม่บังคับ (legacy/ช่องทางอื่น)
  END IF;

  SELECT c.allow_same_day, c.allow_pre_order INTO v_same, v_pre
    FROM public.products p
    JOIN public.product_categories c ON c.id = p.category_id
   WHERE p.id = NEW.product_id;
  IF NOT FOUND THEN RETURN NEW; END IF; -- ไม่พบ = ให้ engine เดิมจัดการ

  IF v_mode = 'SAME_DAY' AND v_same IS FALSE THEN
    RAISE EXCEPTION 'ERR_CATEGORY_MODE_NOT_ALLOWED';
  END IF;
  IF v_mode = 'PRE_ORDER' AND v_pre IS FALSE THEN
    RAISE EXCEPTION 'ERR_CATEGORY_MODE_NOT_ALLOWED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_category_mode ON public.order_items;
CREATE TRIGGER trg_order_items_category_mode
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_order_items_category_mode();

-- ========== CONTRACT NOTES (185) ==========
-- * ไม่แตะฟังก์ชันเดิม (order engine / transition / closeout คงเดิมทุกตัว)
-- * master ปิด = INSERT orders ใหม่ไม่ได้ทุก channel · UPDATE เดิมทำงานปกติ
-- * category gate = ตอน insert order_items เท่านั้น — หมวด default true ทุกแถวเดิม
-- * client mirror: storeMaster.ts + getShopConfig().masterOpen + deriveOrderModeFor