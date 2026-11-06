-- ============================================================
-- Bite Me Baby — Migration 192: CRM automation (win-back/birthday/segments) + menu_sales_stats
-- Date: 2026-11-06 · Owner สั่ง: "ทำเรื่องค้างทั้งหมด" (ข้อ ② CRM segmentation/win-back/birthday + ③ ranking จริง)
--
-- ราง = ของเดิมเป๊ะ (m177/m178): pg_cron → SECURITY DEFINER fn (idempotent · bounded · audit trace)
--   ไม่แตะ EF/ไม่สร้าง workflow ใหม่ · แจ้งเตือน in-app ผ่าน notifications (deterministic id
--   = notifyOnce pattern ของ automation-worker) · category 'Marketing' (CHECK ของ m179)
-- Kill-switch: business_settings key 'crm_automation' -> {"enabled": true|false} (ขาด = เปิด)
--   · ปิดได้ทันทีโดยไม่แตะโค้ด
-- เนื้อหา = คำทักทายทั่วไป ไม่สัญญาส่วนลด/ราคา/โปรโมชัน (การตลาดเชิงราคา = อำนาจ Owner)
-- menu_sales_stats = ตัวเลขขายรวมต่อสินค้า (ไม่มี PII/ไม่มียอดเงิน) สำหรับ "ขายดีช่วงนี้"
--   ของ Talk to Bite (แทน proxy pickTopAvailable เดิม)
-- ============================================================

BEGIN;

-- ---- A) birthday ของลูกค้า (additive · nullable · เก็บวัน/เดือน) ----
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS birthday DATE;

-- ---- E) menu_sales_stats — จำนวนขายรวมต่อสินค้า (หน้าต่าง N วัน · ไม่ใช่ cancelled) ----
CREATE OR REPLACE FUNCTION public.menu_sales_stats(p_days integer DEFAULT 30)
RETURNS TABLE (product_id text, sold_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oi.product_id::text AS product_id,
         COALESCE(SUM(oi.quantity), 0)::bigint AS sold_count
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
   WHERE o.status <> 'cancelled'
     AND o.created_at >= now() - make_interval(days => LEAST(GREATEST(COALESCE(p_days, 30), 1), 90))
     AND oi.product_id IS NOT NULL
   GROUP BY oi.product_id
   ORDER BY 2 DESC
$$;
REVOKE EXECUTE ON FUNCTION public.menu_sales_stats(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.menu_sales_stats(integer) TO anon, authenticated, service_role;

-- ---- B) crm_segment_summary — ตัวเลขเซกเมนต์ลูกค้า (แอดมิน/งานระบบ เท่านั้น) ----
CREATE OR REPLACE FUNCTION public.crm_segment_summary(p_inactive_days integer DEFAULT 45)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_total integer; v_active integer; v_inactive integer; v_lapsed integer; v_birthday integer;
  v_days integer := LEAST(GREATEST(COALESCE(p_inactive_days, 45), 7), 365);
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.customers;
  SELECT
    COUNT(*) FILTER (WHERE last_order_at >= now() - make_interval(days => 30)),
    COUNT(*) FILTER (WHERE last_order_at < now() - make_interval(days => 30)
                      AND last_order_at >= now() - make_interval(days => 90)),
    COUNT(*) FILTER (WHERE last_order_at < now() - make_interval(days => 90))
  INTO v_active, v_inactive, v_lapsed
  FROM (
    SELECT c.id, MAX(o.created_at) AS last_order_at
      FROM public.customers c
      JOIN public.orders o ON o.customer_id = c.id AND o.status <> 'cancelled'
     GROUP BY c.id
  ) t;
  SELECT COUNT(*) INTO v_birthday
    FROM public.customers
   WHERE birthday IS NOT NULL
     AND date_part('month', birthday) = date_part('month', v_now)
     AND date_part('day', birthday) = date_part('day', v_now);
  RETURN jsonb_build_object(
    'as_of', v_now, 'window_days', v_days,
    'customers_total', v_total,
    'active_30d', v_active, 'inactive_31_90d', v_inactive, 'lapsed_90d_plus', v_lapsed,
    'birthday_today', v_birthday
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.crm_segment_summary(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_segment_summary(integer) TO postgres, service_role;

-- ---- C) crm_winback_scan — ลูกค้าที่เคยสั่งแต่หายไป N วัน → แจ้งเตือน in-app (1 ครั้ง/สัปดาห์/คน) ----
CREATE OR REPLACE FUNCTION public.crm_winback_scan(p_inactive_days integer DEFAULT 45, p_max integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days integer := LEAST(GREATEST(COALESCE(p_inactive_days, 45), 7), 365);
  v_max integer := LEAST(GREATEST(COALESCE(p_max, 50), 1), 200);
  v_week text := to_char((now() AT TIME ZONE 'Asia/Bangkok')::date, 'IYYY') || '-W' ||
                 to_char((now() AT TIME ZONE 'Asia/Bangkok')::date, 'IW');
  v_enabled boolean;
  v_row record;
  v_created integer := 0; v_dup integer := 0; v_seen integer := 0;
BEGIN
  SELECT CASE WHEN jsonb_typeof(value -> 'enabled') = 'boolean'
              THEN (value ->> 'enabled')::boolean ELSE true END
    INTO v_enabled
    FROM public.business_settings WHERE key = 'crm_automation' AND branch_id IS NULL LIMIT 1;
  IF v_enabled IS NOT NULL AND v_enabled = false THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'disabled_by_settings', 'week', v_week);
  END IF;

  FOR v_row IN
    SELECT c.id AS customer_id, c.full_name, t.last_order_at
      FROM public.customers c
      JOIN (
        SELECT o.customer_id, MAX(o.created_at) AS last_order_at
          FROM public.orders o
         WHERE o.status <> 'cancelled' AND o.customer_id IS NOT NULL
         GROUP BY o.customer_id
      ) t ON t.customer_id = c.id
     WHERE t.last_order_at < now() - make_interval(days => v_days)
     ORDER BY t.last_order_at ASC
     LIMIT v_max
  LOOP
    v_seen := v_seen + 1;
    BEGIN
      INSERT INTO public.notifications
        (id, customer_id, title, message, is_read, notification_type, category)
      VALUES
        ('crm-winback-' || v_row.customer_id || '-' || v_week,
         v_row.customer_id,
         'คิดถึงคุณครับ 🧡',
         'ไม่ได้เจอคุณ' || CASE WHEN COALESCE(v_row.full_name, '') <> '' THEN ' ' || v_row.full_name ELSE '' END ||
           ' สักพักแล้วครับ วันนี้มีเมนูอร่อยรออยู่ — กดดูที่หน้าเมนูได้เลยครับ 🍊',
         false, 'crm_winback', 'Marketing')
      ON CONFLICT (id) DO NOTHING;
      IF FOUND THEN v_created := v_created + 1; ELSE v_dup := v_dup + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      v_dup := v_dup + 1;
    END;
  END LOOP;

  INSERT INTO public.audit_logs (id, action, entity_type, entity_id, description, metadata)
  VALUES ('crm-winback-' || v_week, 'crm.winback_scan', 'crm', 'winback',
          'crm winback scan: ' || v_created || ' notified / ' || v_seen || ' candidates',
          jsonb_build_object('week', v_week, 'inactive_days', v_days, 'candidates', v_seen,
                             'notified', v_created, 'deduped', v_dup))
  ON CONFLICT (id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'week', v_week, 'inactive_days', v_days,
                            'candidates', v_seen, 'notified', v_created, 'deduped', v_dup);
END;
$$;
-- ---- D) crm_birthday_scan — สุขสันต์วันเกิด (1 ครั้ง/ปี/คน · ตามวัน BKK) ----
CREATE OR REPLACE FUNCTION public.crm_birthday_scan(p_max integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_max integer := LEAST(GREATEST(COALESCE(p_max, 50), 1), 200);
  v_enabled boolean;
  v_row record;
  v_created integer := 0; v_dup integer := 0; v_seen integer := 0;
BEGIN
  SELECT CASE WHEN jsonb_typeof(value -> 'enabled') = 'boolean'
              THEN (value ->> 'enabled')::boolean ELSE true END
    INTO v_enabled
    FROM public.business_settings WHERE key = 'crm_automation' AND branch_id IS NULL LIMIT 1;
  IF v_enabled IS NOT NULL AND v_enabled = false THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'disabled_by_settings', 'date', v_today);
  END IF;

  FOR v_row IN
    SELECT id AS customer_id, full_name
      FROM public.customers
     WHERE birthday IS NOT NULL
       AND date_part('month', birthday) = date_part('month', v_today)
       AND date_part('day', birthday) = date_part('day', v_today)
     LIMIT v_max
  LOOP
    v_seen := v_seen + 1;
    BEGIN
      INSERT INTO public.notifications
        (id, customer_id, title, message, is_read, notification_type, category)
      VALUES
        ('crm-birthday-' || v_row.customer_id || '-' || to_char(v_today, 'YYYYMMDD'),
         v_row.customer_id,
         'สุขสันต์วันเกิดครับ 🎂',
         'สุขสันต์วันเกิด' || CASE WHEN COALESCE(v_row.full_name, '') <> '' THEN ' ' || v_row.full_name ELSE '' END ||
           ' ครับ ขอบคุณที่อยู่กับ Bite Me Baby เสมอมา 🎉',
         false, 'crm_birthday', 'Marketing')
      ON CONFLICT (id) DO NOTHING;
      IF FOUND THEN v_created := v_created + 1; ELSE v_dup := v_dup + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      v_dup := v_dup + 1;
    END;
  END LOOP;

  INSERT INTO public.audit_logs (id, action, entity_type, entity_id, description, metadata)
  VALUES ('crm-birthday-' || to_char(v_today, 'YYYYMMDD'), 'crm.birthday_scan', 'crm', 'birthday',
          'crm birthday scan: ' || v_created || ' notified / ' || v_seen || ' candidates',
          jsonb_build_object('date', v_today, 'candidates', v_seen, 'notified', v_created, 'deduped', v_dup))
  ON CONFLICT (id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'date', v_today, 'candidates', v_seen,
                            'notified', v_created, 'deduped', v_dup);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.crm_birthday_scan(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_birthday_scan(integer) TO postgres, service_role;

-- ---- F) pg_cron schedules — ตามแบบ m178 (guarded · extension ไม่มี = ข้ามเงียบ) ----
-- pg_cron รันเป็น UTC: winback 02:00 UTC = 09:00 ICT · birthday 17:05 UTC = 00:05 ICT (ข้ามวัน BKK)
DO $$ BEGIN PERFORM cron.unschedule('bmb-crm-winback'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.schedule('bmb-crm-winback', '0 2 * * *', 'SELECT public.crm_winback_scan()');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'bmb-crm-winback schedule skipped: %', SQLERRM; END $$;

DO $$ BEGIN PERFORM cron.unschedule('bmb-crm-birthday'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.schedule('bmb-crm-birthday', '5 17 * * *', 'SELECT public.crm_birthday_scan()');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'bmb-crm-birthday schedule skipped: %', SQLERRM; END $$;

COMMIT;

