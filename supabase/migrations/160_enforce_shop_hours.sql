-- ============================================
-- 160 — enforce business_settings.hours บน SAME_DAY orders (Owner 2026-10-26)
-- ============================================
-- ปัญหาจริงจาก production: แอดมินตั้ง hours={"open":"8:00","close":"20:00"} แต่ตอน 22:55
--   ยังสั่งเซมเดย์ได้ — rule 148 = SAME_DAY "ไม่มีคัทออฟ (เปิดร้านถึงปิดร้าน)"
--   แต่ไม่มีใครเช็ค "ปิดร้าน" ทั้ง client/server (hours ไม่เคยถูกอ่าน)
-- ทำ: BEFORE INSERT on orders (mirror enforce_operating_hours · 039) —
--   order_mode='SAME_DAY' + นอกช่วง open..close (เวลากรุงเทพ) → RAISE ERR_STORE_CLOSED
-- ZERO-FAKE: ไม่มีแถว hours / ค่าว่าง / parse ไม่ได้ = ข้าม (ห้ามเดาปิด) ·
--   ไม่ INSERT/UPDATE ค่า hours เอง (แอดมินเป็นเจ้าของค่า)
-- CI NOTE: ephemeral seed (008) มี hours=10:00-22:00 → contract-tests.yml ตั้ง
--   hours กว้าง (00:00-23:59) "หลัง" apply migrations "ก่อน" รัน contract SQL
--   (กัน contract insert orders ติด trigger ตามเวลาที่ runner รัน)
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_shop_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_h     jsonb;
  v_open  text;
  v_close text;
  v_o     int;
  v_c     int;
  v_now   int;
  v_in    boolean;
BEGIN
  -- เฉพาะสายส่งวันนี้ (พรีออเดอร์วันล่วงหน้า = ยังสั่งได้นอกเวลาเปิดร้าน)
  IF NEW.order_mode::text <> 'SAME_DAY' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(value, '{}'::jsonb) INTO v_h
    FROM public.business_settings WHERE key = 'hours';
  v_open  := v_h->>'open';
  v_close := v_h->>'close';
  IF v_open IS NULL OR v_close IS NULL THEN RETURN NEW; END IF;
  IF v_open  !~ '^[0-9]{1,2}:[0-9]{2}' THEN RETURN NEW; END IF;
  IF v_close !~ '^[0-9]{1,2}:[0-9]{2}' THEN RETURN NEW; END IF;

  v_o := split_part(v_open, ':', 1)::int * 60 + left(split_part(v_open, ':', 2), 2)::int;
  v_c := split_part(v_close, ':', 1)::int * 60 + left(split_part(v_close, ':', 2), 2)::int;
  IF v_o > 1439 OR v_c > 1439 THEN RETURN NEW; END IF; -- ค่าเพี้ยน = ห้ามเดา

  v_now := EXTRACT(HOUR  FROM (now() AT TIME ZONE 'Asia/Bangkok'))::int * 60
         + EXTRACT(MINUTE FROM (now() AT TIME ZONE 'Asia/Bangkok'))::int;

  IF v_c > v_o THEN
    v_in := (v_now >= v_o AND v_now < v_c);
  ELSE
    -- ข้ามเที่ยงคืน (เปิด 22:00 ปิด 02:00)
    v_in := (v_now >= v_o OR v_now < v_c);
  END IF;

  IF NOT v_in THEN
    RAISE EXCEPTION 'ERR_STORE_CLOSED: ร้านปิดแล้วตามเวลาที่แอดมินตั้ง (%–%) น.', v_open, v_close;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shop_hours ON public.orders;
CREATE TRIGGER trg_shop_hours
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_shop_hours();

REVOKE EXECUTE ON FUNCTION public.enforce_shop_hours() FROM PUBLIC, anon, authenticated;

COMMIT;
-- ============================================
-- END OF MIGRATION 160
-- ============================================
