-- ============================================
-- Bite Me Baby — 137: Marketing posts + rules (Part C — AdminMarketing E2E base)
-- ============================================
-- เส้นทางจริง (C2): อ่านเมนูจริง -> PLAN -> GENERATE(aiService) -> VALIDATE ->
-- DRAFT (content_approvals เดิม 022/126) -> APPROVE (คนเท่านั้น — เดิม)
-- -> SCHEDULE (ตารางนี้) -> PUBLISH (social-publish-worker ของเดิม) -> RECORD ผล
--   · marketing_posts ผูก content_approvals 1:1 — ตารางนี้เพิ่มเฉพาะ
--     วงจร scheduling/publishing/ผลลัพธ์ (ของเดิมไม่แตะ)
--   · marketing_schedule_post บังคับ approval status='approved' ใน RPC
--     (scheduler ห้ามรันก่อนคนอนุมัติ = กฎ C2 · กันพลาดที่ UI อย่างเดียวไม่พอ)
--   · marketing_rules = ค่าตั้งแคมเปญที่แอดมินแก้ได้จริง (ไม่ hardcode)
-- ============================================

CREATE TABLE IF NOT EXISTS public.marketing_posts (
  id                TEXT PRIMARY KEY,
  approval_id       TEXT REFERENCES public.content_approvals(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  body              TEXT NOT NULL DEFAULT '',
  content_type      TEXT NOT NULL DEFAULT 'post'
                    CHECK (content_type IN ('promotion', 'banner', 'post', 'announcement')),
  image_urls        JSONB NOT NULL DEFAULT '[]'::jsonb,
  objective         TEXT NOT NULL DEFAULT 'reach',
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'pending_approval', 'approved', 'scheduled', 'published', 'failed')),
  scheduled_for     TIMESTAMPTZ,
  provider_post_id  TEXT,
  error             TEXT,
  publish_attempts  INTEGER NOT NULL DEFAULT 0,
  idempotency_key   TEXT UNIQUE,
  created_by        uuid,
  published_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_posts_status ON public.marketing_posts (status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_marketing_posts_approval ON public.marketing_posts (approval_id);

-- ตารางตั้งค่าเดียว (แถวเดียว id='default') — แอดมินแก้ได้จริง ไม่ hardcode
CREATE TABLE IF NOT EXISTS public.marketing_rules (
  id                TEXT PRIMARY KEY DEFAULT 'default',
  frequency_per_week INTEGER NOT NULL DEFAULT 3 CHECK (frequency_per_week BETWEEN 1 AND 21),
  publishing_window JSONB NOT NULL DEFAULT '{"start": "10:00", "end": "19:00"}'::jsonb,
  content_mix       JSONB NOT NULL DEFAULT '{"menu": 40, "promotion": 30, "festival": 20, "brand": 10}'::jsonb,
  menu_rules        JSONB NOT NULL DEFAULT '{}'::jsonb,
  cooldown_hours    INTEGER NOT NULL DEFAULT 6 CHECK (cooldown_hours BETWEEN 0 AND 168),
  stop_conditions   JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by        uuid,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.marketing_rules (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.marketing_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_posts_deny_anon ON public.marketing_posts;
CREATE POLICY marketing_posts_deny_anon ON public.marketing_posts FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS marketing_posts_auth_read ON public.marketing_posts;
CREATE POLICY marketing_posts_auth_read ON public.marketing_posts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS marketing_posts_admin_write ON public.marketing_posts;
CREATE POLICY marketing_posts_admin_write ON public.marketing_posts
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS marketing_rules_deny_anon ON public.marketing_rules;
CREATE POLICY marketing_rules_deny_anon ON public.marketing_rules FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS marketing_rules_auth_read ON public.marketing_rules;
CREATE POLICY marketing_rules_auth_read ON public.marketing_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS marketing_rules_admin_write ON public.marketing_rules;
CREATE POLICY marketing_rules_admin_write ON public.marketing_rules
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================
-- marketing_schedule_post (admin) — "อนุมัติ != ตั้งเวลา != เผยแพร่"
--   ตั้งเวลาได้เฉพาะโพสต์ที่คนอนุมัติแล้วเท่านั้น (approval='approved')
-- ============================================
CREATE OR REPLACE FUNCTION public.marketing_schedule_post(
  p_post_id text,
  p_when timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_status text;
  v_approval_status text;
  v_approval_id text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND current_setting('request.jwt.claims', true) IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;
  IF v_uid IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;
  IF p_when IS NULL THEN RAISE EXCEPTION 'ERR_MISSING_ASSIGNMENT'; END IF;

  SELECT status, approval_id INTO v_status, v_approval_id
    FROM public.marketing_posts WHERE id = p_post_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ORDER_NOT_FOUND'; END IF;

  SELECT status INTO v_approval_status FROM public.content_approvals WHERE id = v_approval_id;

  -- คนเท่านั้นที่อนุมัติได้ — โพสต์ที่ยังไม่ผ่านการอนุมัติห้ามตั้งเวลา (C2)
  IF v_approval_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'ERR_APPROVAL_REQUIRED';
  END IF;
  IF v_status = 'published' THEN
    RAISE EXCEPTION 'ERR_ASSIGNMENT_CLOSED'; -- เผยแพร่แล้ว แก้ไม่ได้
  END IF;

  UPDATE public.marketing_posts
     SET status = 'scheduled', scheduled_for = p_when, error = NULL, updated_at = NOW()
   WHERE id = p_post_id;

  PERFORM public.append_audit_log('marketing_scheduled', 'marketing', p_post_id,
    'marketing post scheduled', jsonb_build_object('scheduled_for', p_when, 'approval_id', v_approval_id));
  RETURN jsonb_build_object('ok', true, 'id', p_post_id, 'status', 'scheduled', 'scheduled_for', p_when);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.marketing_schedule_post(text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketing_schedule_post(text, timestamptz) TO authenticated;

-- ============================================
-- marketing_save_rules (admin) — ค่าตั้งแคมเปญแก้ได้จริง (ห้าม hardcode ฝั่ง UI)
-- ============================================
CREATE OR REPLACE FUNCTION public.marketing_save_rules(
  p_rules jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_out jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL AND current_setting('request.jwt.claims', true) IS NOT NULL THEN
    RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED';
  END IF;
  IF v_uid IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;
  IF p_rules IS NULL OR p_rules = '{}'::jsonb THEN
    RAISE EXCEPTION 'ERR_MISSING_ASSIGNMENT';
  END IF;

  UPDATE public.marketing_rules
     SET frequency_per_week = COALESCE((p_rules->>'frequency_per_week')::int, frequency_per_week),
         publishing_window  = COALESCE(p_rules->'publishing_window', publishing_window),
         content_mix        = COALESCE(p_rules->'content_mix', content_mix),
         menu_rules         = COALESCE(p_rules->'menu_rules', menu_rules),
         cooldown_hours     = COALESCE((p_rules->>'cooldown_hours')::int, cooldown_hours),
         stop_conditions    = COALESCE(p_rules->'stop_conditions', stop_conditions),
         updated_by         = v_uid,
         updated_at         = NOW()
   WHERE id = 'default';

  PERFORM public.append_audit_log('marketing_rules_saved', 'marketing', 'default',
    'marketing rules updated', jsonb_build_object('rules', p_rules));
  SELECT to_jsonb(r) INTO v_out FROM public.marketing_rules r WHERE r.id = 'default';
  RETURN v_out;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.marketing_save_rules(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketing_save_rules(jsonb) TO authenticated;