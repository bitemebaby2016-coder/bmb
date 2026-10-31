-- ============================================
-- 178_cron_publish_tick — R41 (Owner: "โพสยังไม่มาตามเวลาที่ตั้ง · เอไอไม่ตอบโพส มันเคยตอบได้")
--   ปัญหาจริง: GH automation-scheduler ง่อยข้ามชั่วโมง (run ล่าสุด 05:29Z · ทั้งวัน ~10/288) → queue marketing_publish
--   ไม่รันหลังครบกำหนด = FB ไม่ถูก push + comment poll หยุดตาม + site promote พึ่ง "มีคนเปิดหน้า"
--   (pg_cron = relation does not exist · e2e/r41_probe.cjs) · social webhook ยังทำงาน (คอมเม้น 05:48 ตอบใน 10 วิ ✓)
-- ทางแก้ = ภารกิจ time-based ย้ายเข้า DB เอง:
--   1) bmb-promote ทุกนาที → marketing_publish_due (m177) = โพสต์ขึ้นตรงเวลา ไม่ต้องรอคนเปิดหน้า/ไม่รอ GH
--   2) bmb_tick_http(token) → pg_net → EF cron-tick → automation-worker marketing_publish = FB push + comment poll
--      (ตอน apply ตั้ง secret tick token + schedule '*/5 * * * *' ด้วยค่าจริง — ไม่อยู่ในไฟล์นี้)
-- ทุกขั้น guarded — extension ไม่มี = ข้ามเงียบ (visit-path + GH เดิมยังเป็น backup)
-- ============================================

BEGIN;

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pg_cron unavailable: %', SQLERRM; END $$;

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pg_net unavailable: %', SQLERRM; END $$;

-- promote ทุกนาที (m177 fn = SECURITY DEFINER · idempotent · time-gated) — re-apply ปลอดภัย
DO $$ BEGIN
  PERFORM cron.unschedule('bmb-promote');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.schedule('bmb-promote', '* * * * *', 'SELECT public.marketing_publish_due()');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'bmb-promote schedule skipped: %', SQLERRM; END $$;

-- สะพาน pg_net → cron-tick (verify_jwt=false · x-tick-token = tick secret ตั้งตอน apply — ไม่อยู่ในไฟล์นี้)
CREATE OR REPLACE FUNCTION public.bmb_tick_http(p_token text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r bigint;
BEGIN
  SELECT net.http_post(
    url := 'https://ivkdfognyiwjcmrhcnwz.supabase.co/functions/v1/cron-tick',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-tick-token', p_token),
    body := jsonb_build_object('job', 'marketing_publish'),
    timeout_milliseconds := 30000
  ) INTO r;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'bmb_tick_http skipped: %', SQLERRM;
  RETURN -1;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.bmb_tick_http(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bmb_tick_http(text) TO postgres, service_role;

COMMIT;