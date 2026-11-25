-- ============================================================
-- Contract 126 — content richness + admin job-queue tools
-- ครอบคลุม:
--   126.1 content_approvals: image_url + mascot columns มีจริง
--   126.2 submit_content_for_approval: 5-arg เขียนครบ (image+mascot) / 3-arg เดิมยังทำงาน / title ว่าง = ERR_MISSING_TITLE / anon = ERR_NOT_AUTHENTICATED
--   126.3 admin_list_jobs: admin เห็นคิว + กรองสถานะ / non-admin = ERR_FORBIDDEN / anon = ERR_NOT_AUTHENTICATED
--   126.4 admin_delete_job: ลบรายตัว + เขียน audit / ERR_JOB_NOT_FOUND / non-admin = ERR_FORBIDDEN
-- รูปแบบ: ทุกเคสใน BEGIN ... ROLLBACK เดียว (ไม่ทิ้งข้อมูล)
-- ============================================================
BEGIN;

-- ---------- 126.1 schema ----------
DO $$
DECLARE v_missing int;
BEGIN
  SELECT count(*) INTO v_missing FROM information_schema.columns
   WHERE table_schema='public' AND table_name='content_approvals'
     AND column_name IN ('image_url','mascot');
  IF v_missing <> 2 THEN RAISE EXCEPTION '126.1 FAIL: expected image_url+mascot, found %/2', v_missing; END IF;
  RAISE NOTICE '126.1 PASS: content_approvals rich columns exist';
END $$;

-- ---------- fixture: admin role ----------
-- guard_profile_mutation (014) อนุญาตแก้ role เฉพาะเมื่อ auth.uid() IS NULL (bootstrap)
-- → ยก role ขึ้น admin "ก่อน" ตั้ง JWT claims ใด ๆ (ROLLBACK คืนค่าเดิมเอง)
UPDATE public.profiles SET role='admin' WHERE id='dddf4b57-405f-4852-a985-76d8d52b1b72';

-- ---------- fixture: admin JWT (ผู้ใช้ fixture-owner จาก shim 066) ----------
SELECT set_config('request.jwt.claims',
  '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);

DO $$
DECLARE v_out jsonb;
BEGIN
  -- ---------- 126.2 submit 5-arg: image + mascot ถูกบันทึก ----------
  v_out := public.submit_content_for_approval('promotion','หัวข้อทดสอบ 126','เนื้อหา','https://example.invalid/126.png','bite');
  IF (v_out->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION '126.2 FAIL: ok!=true'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.content_approvals WHERE id = v_out->>'id'
                 AND image_url='https://example.invalid/126.png' AND mascot='bite'
                 AND status='pending') THEN
    RAISE EXCEPTION '126.2 FAIL: image_url/mascot not persisted';
  END IF;
  RAISE NOTICE '126.2a PASS: submit_content_for_approval 5-arg persists image+mascot';
END $$;

DO $$
DECLARE v_out jsonb;
BEGIN
  -- ---------- 126.2 submit 3-arg (legacy signature ยังทำงานผ่าน defaults) ----------
  v_out := public.submit_content_for_approval('post','หัวข้อ 3-arg','เนื้อหา');
  IF (v_out->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION '126.2 FAIL: legacy 3-arg broken'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.content_approvals WHERE id = v_out->>'id'
                 AND image_url IS NULL AND mascot IS NULL) THEN
    RAISE EXCEPTION '126.2 FAIL: legacy call should leave image/mascot NULL';
  END IF;
  RAISE NOTICE '126.2b PASS: legacy 3-arg signature still works';
END $$;

DO $$
BEGIN
  -- ---------- 126.2 title ว่าง = ERR_MISSING_TITLE ----------
  BEGIN
    PERFORM public.submit_content_for_approval('post','   ','x');
    RAISE EXCEPTION '126.2 FAIL: blank title accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_MISSING_TITLE%' THEN
      RAISE EXCEPTION '126.2 FAIL: wrong error %', SQLERRM;
    END IF;
  END;
  -- ---------- 126.2 anon = ERR_NOT_AUTHENTICATED ----------
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  BEGIN
    PERFORM public.submit_content_for_approval('post','t','x');
    RAISE EXCEPTION '126.2 FAIL: anon accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_NOT_AUTHENTICATED%' THEN
      RAISE EXCEPTION '126.2 FAIL: wrong error %', SQLERRM;
    END IF;
  END;
  RAISE NOTICE '126.2c PASS: blank title + anon rejected with correct codes';
END $$;

-- ---------- fixture คิวงาน ----------
SELECT set_config('request.jwt.claims',
  '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);

DO $$
DECLARE v_out jsonb; v_job text;
BEGIN
  v_job := 'job-c126-' || substr(md5(random()::text),1,8);
  INSERT INTO public.automation_queue (id, job_type, worker, status, attempt_count, max_attempts)
  VALUES (v_job, 'contract126', 'contract', 'failed', 3, 3)
  ON CONFLICT (id) DO NOTHING;

  -- ---------- 126.3 admin_list_jobs: เห็น + กรอง ----------
  v_out := public.admin_list_jobs('failed');
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_out->'jobs') j
     WHERE j->>'id' = v_job AND j->>'status'='failed') THEN
    RAISE EXCEPTION '126.3 FAIL: admin_list_jobs did not return the fixture job';
  END IF;
  -- payload ถูกซ่อน (ไม่คืน payload column)
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_out->'jobs') j WHERE j ? 'payload') THEN
    RAISE EXCEPTION '126.3 FAIL: payload leaked in admin_list_jobs output';
  END IF;
  RAISE NOTICE '126.3a PASS: admin_list_jobs returns job without payload leak';

  -- ---------- 126.3 non-admin = ERR_FORBIDDEN ----------
  PERFORM set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  BEGIN
    PERFORM public.admin_list_jobs(NULL);
    RAISE EXCEPTION '126.3 FAIL: non-admin accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_FORBIDDEN%' THEN
      RAISE EXCEPTION '126.3 FAIL: wrong error %', SQLERRM;
    END IF;
  END;
  -- ---------- 126.3 anon = ERR_NOT_AUTHENTICATED ----------
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  BEGIN
    PERFORM public.admin_list_jobs(NULL);
    RAISE EXCEPTION '126.3 FAIL: anon accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_NOT_AUTHENTICATED%' THEN
      RAISE EXCEPTION '126.3 FAIL: wrong error %', SQLERRM;
    END IF;
  END;
  RAISE NOTICE '126.3b PASS: non-admin/anon rejected';

  -- ---------- 126.4 delete: ลบ + audit ----------
  PERFORM set_config('request.jwt.claims',
    '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72","role":"authenticated"}', true);
  v_out := public.admin_delete_job(v_job);
  IF (v_out->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION '126.4 FAIL: ok!=true'; END IF;
  IF EXISTS (SELECT 1 FROM public.automation_queue WHERE id = v_job) THEN
    RAISE EXCEPTION '126.4 FAIL: job still exists';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.audit_logs
                 WHERE action='queue_job_delete' AND entity_id=v_job) THEN
    RAISE EXCEPTION '126.4 FAIL: audit log missing';
  END IF;

  -- ---------- 126.4 ERR_JOB_NOT_FOUND ----------
  BEGIN
    PERFORM public.admin_delete_job('job-c126-nonexistent');
    RAISE EXCEPTION '126.4 FAIL: missing job accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_JOB_NOT_FOUND%' THEN
      RAISE EXCEPTION '126.4 FAIL: wrong error %', SQLERRM;
    END IF;
  END;

  -- ---------- 126.4 non-admin = ERR_FORBIDDEN ----------
  PERFORM set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  BEGIN
    PERFORM public.admin_delete_job('any');
    RAISE EXCEPTION '126.4 FAIL: non-admin delete accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ERR_FORBIDDEN%' THEN
      RAISE EXCEPTION '126.4 FAIL: wrong error %', SQLERRM;
    END IF;
  END;
  RAISE NOTICE '126.4 PASS: delete + audit + guards OK';
END $$;

ROLLBACK;