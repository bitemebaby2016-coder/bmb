-- ============================================================
-- Bite Me Baby — Migration 193: customers.crm_consent + CRM scan ส่งเฉพาะคนยินยอม
-- Date: 2026-11-06 · Owner สั่ง: "ทำเลย" (UI เก็บวันเกิด + consent)
--
-- Context: m192 เปิด winback/birthday scan = เริ่มส่งแจ้งเตือนทันที — ปิดความเสี่ยง
--   ด้วย consent ที่ลูกค้ากดเองในหน้าบัญชี (ProfilePage · R73g): default false =
--   ยังไม่ส่งใครเลย จนกว่าจะยินยอม · ถอนภายหลังได้ทุกเมื่อ (uncheck + บันทึก)
--
-- FIX = 2 fn body VERBATIM จาก 192_crm_automation_and_sales_stats.sql
--   (สร้างด้วย e2e/ci/_r73g_mk193.cjs) เติมเงื่อนไข crm_consent = true ทั้งสอง scan
--   + ALTER TABLE customers ADD COLUMN crm_consent (additive · default false)
--   (business rule/grant คงเดิม · scan อื่น/segment summary ไม่แตะ)
-- ============================================================
BEGIN;

-- ---- consent column (default false = ยังไม่ยินยอม = ยังไม่ส่งอะไร) ----
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS crm_consent boolean NOT NULL DEFAULT false;
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
       AND c.crm_consent = true
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
       AND crm_consent = true
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

COMMIT;
