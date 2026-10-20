-- ============================================
-- Bite Me Baby — Migration 134: Kitchen location + fee sync
-- Date: 2026-10-20
-- ============================================
-- Problem (Owner QA 2026-10-20: "ระยะทางถูกแล้ว แต่ค่าส่งไม่ได้ซิงค์จากที่แอดมินตั้ง"):
--   compute_delivery_fee (020) วัดระยะจาก kitchen_location() — ถ้า
--   business_settings.kitchen_location ไม่มีค่า จะ fallback ผิดที่
--   (10.7016, 102.1429) ห่างจากครัวจริง 200+ กม. → ระยะในสูตรเพี้ยน →
--   ไม่ match delivery_zones ที่แอดมินตั้ง → หล่นไปใช้สูตร legacy
--   (30 + dist*4 + items*2) แทนค่า zone — ค่าส่งจึงไม่ซิงค์กับที่ตั้งไว้
--
-- Fix:
--   1) upsert business_settings.kitchen_location = พิกัดครัวจริง
--      (สอดคล้อง src/config/kitchenLocation.ts default 12.615659, 102.098063)
--   2) kitchen_location() fallback = พิกัดครัวจริงเดียวกัน (กันค่าหายอีก)
--   ทุกส่วนที่คิดค่าส่ง (quote RPC + create_order re-derive) จะได้ระยะเดียวกับ
--   ที่ลูกค้าเห็นบนหน้าจอ → เลือก zone ตรงกับ delivery_zones ของแอดมินเสมอ
-- ============================================

-- 1. canonical kitchen location (idempotent upsert)
INSERT INTO public.business_settings (key, value, updated_at)
VALUES ('kitchen_location', '{"latitude":12.615659,"longitude":102.098063}'::jsonb, NOW())
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = NOW();

-- 2. kitchen_location() — fallback ต้องเป็นครัวจริงเท่านั้น
CREATE OR REPLACE FUNCTION public.kitchen_location()
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_loc jsonb;
BEGIN
  SELECT value INTO v_loc FROM public.business_settings WHERE key = 'kitchen_location';
  IF v_loc IS NULL THEN
    -- ครัวจริง ( Bite Me Baby — สอดคล้อง VITE_DELIVERY_KITCHEN_LAT/LNG default )
    -- ห้ามกลับไปใช้ (10.7016, 102.1429) อีก — ทำให้ค่าส่งหลุดโซนของแอดมิน
    RETURN '{"latitude":12.615659,"longitude":102.098063}'::jsonb;
  END IF;
  RETURN v_loc::jsonb;
END;
$$;