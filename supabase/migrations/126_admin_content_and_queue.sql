-- ============================================
-- Bite Me Baby Migration 126: content richness + admin job-queue tools
-- Date: 2026-10-18 · Baseline: m125 deployed
--
-- Owner requests (2026-10-18):
--   1. Content Approvals ต้องมีรายละเอียดมากกว่านี้ + แนบรูป (ลิงก์/อัปโหลด)
--      และเลือกมาสคอตได้เอง
--   2. Dead queue 13 (notification jobs ที่ยกเลิกแล้ว) — แอดมินจะลบเองเมื่อ
--      เครื่องมือแอดมินพร้อม → เพิ่มคำสั่ง list/ลบรายตัว (ไม่มี bulk delete)
-- Scope: additive only — columns + SECURITY DEFINER RPCs. No data mutation.
-- ============================================

BEGIN;

-- --------------------------------------------
-- 1. content_approvals: rich fields
-- --------------------------------------------
ALTER TABLE public.content_approvals ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.content_approvals ADD COLUMN IF NOT EXISTS mascot TEXT;

-- --------------------------------------------
-- 2. submit_content_for_approval — extended (image + mascot)
--    Recreate to avoid overload ambiguity; old 3-arg callers keep working
--    via defaults.
-- --------------------------------------------
DROP FUNCTION IF EXISTS public.submit_content_for_approval(text, text, text);
CREATE OR REPLACE FUNCTION public.submit_content_for_approval(
  p_content_type text,
  p_title text,
  p_body text DEFAULT '',
  p_image_url text DEFAULT NULL,
  p_mascot text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_id text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_title IS NULL OR trim(p_title) = '' THEN RAISE EXCEPTION 'ERR_MISSING_TITLE'; END IF;

  v_id := 'cap-' || to_char(EXTRACT(EPOCH FROM clock_timestamp()) * 1000, '99999999999') || '-' || substr(md5(random()::text), 1, 5);
  INSERT INTO public.content_approvals (id, content_type, title, body, status, created_by, created_at, image_url, mascot)
  VALUES (v_id, COALESCE(p_content_type, 'promotion'), trim(p_title), COALESCE(p_body, ''), 'pending', v_uid, NOW(),
          NULLIF(trim(COALESCE(p_image_url, '')), ''), NULLIF(trim(COALESCE(p_mascot, '')), ''));
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'status', 'pending');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_content_for_approval(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_content_for_approval(text, text, text, text, text) TO authenticated;

-- --------------------------------------------
-- 3. admin_list_jobs — คิวงานทั้งหมด (กรองตามสถานะได้) สำหรับแอดมินเท่านั้น
--    ไม่คืน payload (อาจมีข้อมูลส่วนบุคคล) — คืนเฉพาะหัวงาน/สถานะ/สาเหตุล้มเหลว
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_jobs(p_status text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_result jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', q.id,
           'job_type', q.job_type,
           'worker', q.worker,
           'status', q.status,
           'attempt_count', q.attempt_count,
           'max_attempts', q.max_attempts,
           'created_at', q.created_at,
           'failed_at', q.failed_at,
           'failure_reason', q.failure_reason,
           'last_error', left(COALESCE(q.last_error, ''), 160)
         ) ORDER BY q.created_at DESC), '[]'::jsonb)
    INTO v_result
    FROM public.automation_queue q
   WHERE p_status IS NULL OR q.status = p_status;

  RETURN jsonb_build_object('ok', true, 'jobs', v_result, 'count', jsonb_array_length(v_result));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_jobs(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_jobs(text) TO authenticated;

-- --------------------------------------------
-- 4. admin_delete_job — ลบงานค้างทีละรายการ (ไม่มี bulk) + บันทึก audit
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_job(p_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_status text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_id IS NULL OR trim(p_id) = '' THEN RAISE EXCEPTION 'ERR_MISSING_ID'; END IF;

  SELECT status INTO v_status FROM public.automation_queue WHERE id = p_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'ERR_JOB_NOT_FOUND'; END IF;

  DELETE FROM public.automation_queue WHERE id = p_id;
  PERFORM public.append_audit_log('queue_job_delete', 'automation_queue', p_id,
    'ลบงานค้างออกจากระบบ (สถานะเดิม: ' || v_status || ')',
    jsonb_build_object('previous_status', v_status));
  RETURN jsonb_build_object('ok', true, 'id', p_id, 'previous_status', v_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_job(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_job(text) TO authenticated;

COMMIT;

-- END OF MIGRATION 126