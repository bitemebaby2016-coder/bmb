-- ============================================
-- 177_marketing_publish_due — R39 (Owner 2026-10-31: "ตั้งเวลาโพส แล้วโพสยังไม่ขึ้น กลายเป็น scheduled")
-- หลักฐาน: mk-mvvspkna-n6uf scheduled_for=09:50 ICT · publish_attempts=0 · error=null
--   = worker ไม่เคยแตะ (GH cron `7 * * * *` ไม่ fire — run ล่าสุด 01:55Z ไม่มีรอบ 02:07/03:07Z)
-- ทางแก้ = ไม่พึ่ง GH cron อย่างเดียว:
--   1) marketing_publish_due() — promote scheduled ที่ถึงเวลา → published (website เห็นทันที)
--   2) marketing_feed_posts() — promote ก่อนคืนแถว (หน้าแรกที่มีคนเปิด = ปล่อยโพสต์เอง)
--   3) pg_cron ทุกนาที (guarded — extension ไม่มีก็ข้ามเงียบ)
--   4) worker (automation-worker) ปรับ query รับ published-but-unpushed เพื่อ FB ต่อ + กติกา sync
-- ============================================

BEGIN;

-- promote โพสต์ที่ถึงเวลา (idempotent · time-gated · ปลอดภัยแม้ anon เรียก)
CREATE OR REPLACE FUNCTION public.marketing_publish_due()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  UPDATE public.marketing_posts
     SET status = 'published',
         published_at = COALESCE(scheduled_for, now()),
         publish_attempts = publish_attempts + 1,
         updated_at = now()
   WHERE status = 'scheduled'
     AND scheduled_for IS NOT NULL
     AND scheduled_for <= now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$function$;

-- feed หน้าแรก: promote ก่อน + คืนแถว published (SETOF = ชนิดตรงตารางเสมอ — ไม่พังถ้าคอลัมน์เปลี่ยน)
CREATE OR REPLACE FUNCTION public.marketing_feed_posts(p_limit integer DEFAULT 6)
RETURNS SETOF public.marketing_posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.marketing_publish_due();
  RETURN QUERY
    SELECT p.* FROM public.marketing_posts p
     WHERE p.status = 'published'
     ORDER BY p.published_at DESC NULLS LAST
     LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 6), 12));
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.marketing_publish_due() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_publish_due() TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.marketing_feed_posts(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketing_feed_posts(integer) TO anon, authenticated, service_role;

-- pg_cron (ถ้ามีในโปรเจกต์) = promote ทุกนาทีแม้ไม่มีคนเข้าเว็บ — ไม่มี extension = ข้ามเงียบ
DO $$
BEGIN
  PERFORM cron.schedule('bmb-marketing-publish-due', '* * * * *', 'SELECT public.marketing_publish_due()');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron unavailable — skip schedule: %', SQLERRM;
END $$;

COMMIT;