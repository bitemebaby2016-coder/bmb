-- ============================================
-- Bite Me Baby — Migration 179: Notification Hub (R48 · 2026-11-01)
-- ============================================
-- Owner task: "End-to-End Notification System Architecture & Production Deployment"
--   Modular Unified Layer · ห้ามเขียนโค้ดซ้ำซ้อน · ห้ามรบกวน Core Business Logic
--
-- ต่อยอดของจริงที่ production มีแล้ว (ไม่สร้างใหม่ — กันซ้ำซ้อน):
--   push_subscriptions (m115) + push-send EF (VAPID/web-push) + notifications + notification_prefs (m021)
--   + automation_queue (m110) + queue-enqueue/dispatcher + automation-worker notification_dispatch
--   + pg_cron/pg_net bridge (m178 pattern)
-- เพิ่มเฉพาะชิ้นที่ขาด (R48 deliverables):
--   1) channel_identities — schema เก็บ PSID (Messenger) / LINE userId ต่อลูกค้า (identity mapping = gap เดิม)
--   2) notification_outbox — transport queue ชั้นเดียว (event_key UNIQUE = idempotent · กัน infinite loop)
--   3) RPC register/enqueue/claim/complete — เส้นทางเขียน/อ่านสถานะเดียว (state machine ชัด)
--   4) business_settings.notification_channels — feature flags {push, messenger, line, lineMode}
--      (LINE = DISABLED/MOCK จนกว่า API อนุมัติ → สลับ lineMode='live' ไม่ต้องแก้ business logic)
--   5) bmb_notify_http(token) — สะพาน pg_cron → EF notification-dispatcher (mirror m178 · token ไม่อยู่ในไฟล์)
--
-- ADDITIVE ONLY · re-run ปลอดภัย (IF NOT EXISTS / ON CONFLICT / CREATE OR REPLACE ทุกจุด)
-- ไม่แตะ business logic เดิม: ไม่แก้ RPC สั่งซื้อ/จ่ายเงิน/ครัว/จัดส่ง · ไม่แก้ automation-worker

-- ============================================
-- 1) channel_identities — PSID / LINE identity ต่อลูกค้า (F-14 identity mapping)
-- ============================================
CREATE TABLE IF NOT EXISTS public.channel_identities (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL CHECK (channel IN ('messenger', 'line')),
  external_id TEXT NOT NULL,                    -- FB PSID หรือ LINE userId (opaque token เท่านั้น)
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'mock')),
  source      TEXT NOT NULL DEFAULT 'manual',   -- manual | webhook | order_link
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_channel_identity UNIQUE (channel, external_id),
  CONSTRAINT uq_channel_customer UNIQUE (customer_id, channel)
);

CREATE INDEX IF NOT EXISTS channel_identities_customer_idx
  ON public.channel_identities (customer_id, channel) WHERE status = 'active';

-- RLS: deny anon · own read ผ่าน customers link · เขียนผ่าน RPC SECURITY DEFINER เท่านั้น (identity ห้าม client ยัด)
ALTER TABLE public.channel_identities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS channel_ident_deny_anon ON public.channel_identities;
CREATE POLICY channel_ident_deny_anon ON public.channel_identities FOR ALL TO anon USING (false);
DROP POLICY IF EXISTS channel_ident_own_read ON public.channel_identities;
CREATE POLICY channel_ident_own_read ON public.channel_identities
  FOR SELECT TO authenticated
  USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS channel_ident_admin_read ON public.channel_identities;
CREATE POLICY channel_ident_admin_read ON public.channel_identities
  FOR SELECT TO authenticated USING (public.is_admin());

-- ============================================
-- 2) notification_outbox — transport queue ชั้นเดียว (state machine)
--    pending → sending → sent | failed(วน backoff) → dead (max attempts) · mock = บันทึก LINE ยังไม่ live
-- ============================================
CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id              TEXT PRIMARY KEY,
  event_key       TEXT NOT NULL UNIQUE,          -- idempotency: trigger ซ้ำ = insert เดิม (กัน loop/ซ้ำ)
  customer_id     TEXT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  category        TEXT NOT NULL DEFAULT 'Transactional'
                  CHECK (category IN ('Transactional', 'Marketing', 'Bite', 'Operational')),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL DEFAULT '',
  url             TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'dead', 'mock')),
  channel         TEXT,                          -- ช่องทางที่สำเร็จ (web_push | messenger | line)
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at      TIMESTAMPTZ,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_outbox_due_idx
  ON public.notification_outbox (next_attempt_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS notification_outbox_customer_idx
  ON public.notification_outbox (customer_id, created_at DESC);

-- RLS: service-role (dispatcher) เท่านั้นฝั่งเขียน · admin อ่านได้ · client ผ่าน RPC เท่านั้น
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outbox_deny_all_client ON public.notification_outbox;
CREATE POLICY outbox_deny_all_client ON public.notification_outbox FOR ALL TO anon, authenticated USING (false);
DROP POLICY IF EXISTS outbox_admin_read ON public.notification_outbox;
CREATE POLICY outbox_admin_read ON public.notification_outbox
  FOR SELECT TO authenticated USING (public.is_admin());
-- ============================================
-- 3) RPCs
-- ============================================

-- 3.1 register_channel_identity — ผูก PSID/LINE userId กับลูกค้า (identity = JWT เท่านั้นแบบ m115)
CREATE OR REPLACE FUNCTION public.register_channel_identity(
  p_channel     text,
  p_external_id text,
  p_source      text DEFAULT 'client'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid; v_customer text; v_id text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF p_channel IS NULL OR p_channel NOT IN ('messenger', 'line') THEN RAISE EXCEPTION 'ERR_INVALID_CHANNEL'; END IF;
  IF p_external_id IS NULL OR length(trim(p_external_id)) < 4 OR length(p_external_id) > 128 THEN
    RAISE EXCEPTION 'ERR_INVALID_EXTERNAL_ID';
  END IF;
  SELECT id INTO v_customer FROM public.customers WHERE user_id = v_uid;
  IF v_customer IS NULL THEN RAISE EXCEPTION 'ERR_NO_CUSTOMER_PROFILE'; END IF;

  -- PSID หนึ่งตัวผูกลูกค้าได้ทีละคน — ปลดแถวที่ถือ external_id นี้อยู่ก่อน (identity ย้ายเครื่อง/แอคเคาต์)
  DELETE FROM public.channel_identities
   WHERE channel = p_channel AND external_id = trim(p_external_id) AND customer_id <> v_customer;

  INSERT INTO public.channel_identities (id, customer_id, channel, external_id, status, source)
  VALUES ('chi-' || substr(md5(v_customer || ':' || p_channel), 1, 16),
          v_customer, p_channel, trim(p_external_id), 'active', left(coalesce(p_source, 'manual'), 32))
  ON CONFLICT (customer_id, channel) DO UPDATE
    SET external_id = EXCLUDED.external_id, status = 'active', source = EXCLUDED.source, updated_at = NOW();

  SELECT id INTO v_id FROM public.channel_identities
   WHERE customer_id = v_customer AND channel = p_channel;
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'channel', p_channel);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
REVOKE ALL ON FUNCTION public.register_channel_identity(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_channel_identity(text, text, text) TO authenticated;

-- 3.2 enqueue_notification — จุดเดียวของการ "ยิง event เข้าคิว" (client = ของตัวเอง · server/EF = ส่ง customer_id มาเอง)
--     idempotent ด้วย event_key UNIQUE — trigger ซ้ำ/ cron ทับรอบ = ไม่มีแถวซ้ำ ไม่มีทาง loop
CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_event_key   text,
  p_customer_id text DEFAULT NULL,
  p_category    text DEFAULT 'Transactional',
  p_title       text DEFAULT '',
  p_body        text DEFAULT '',
  p_url         text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_customer text; v_id text; v_inserted boolean := false;
BEGIN
  IF p_event_key IS NULL OR length(trim(p_event_key)) < 3 OR length(p_event_key) > 200 THEN
    RAISE EXCEPTION 'ERR_INVALID_EVENT_KEY';
  END IF;
  IF p_category IS NULL OR p_category NOT IN ('Transactional', 'Marketing', 'Bite', 'Operational') THEN
    RAISE EXCEPTION 'ERR_INVALID_CATEGORY';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN RAISE EXCEPTION 'ERR_MISSING_TITLE'; END IF;

  v_customer := nullif(coalesce(p_customer_id, ''), '');
  IF v_customer IS NULL THEN
    -- client path: resolve จาก JWT เสมอ (ไม่เชื่อ customer_id จากข้างนอก)
    SELECT id INTO v_customer FROM public.customers WHERE user_id = auth.uid();
  END IF;
  IF v_customer IS NULL THEN RAISE EXCEPTION 'ERR_NO_CUSTOMER_PROFILE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = v_customer) THEN
    RAISE EXCEPTION 'ERR_UNKNOWN_CUSTOMER';
  END IF;

  v_id := 'obx-' || substr(md5(trim(p_event_key)), 1, 20);
  INSERT INTO public.notification_outbox
    (id, event_key, customer_id, category, title, body, url)
  VALUES
    (v_id, trim(p_event_key), v_customer, p_category,
     left(p_title, 200), left(coalesce(p_body, ''), 1000), left(coalesce(p_url, ''), 500))
  ON CONFLICT (event_key) DO NOTHING;
  v_inserted := FOUND;
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'inserted', v_inserted);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_notification(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_notification(text, text, text, text, text, text) TO authenticated, service_role;

-- 3.3 claim_notification_outbox — เคลมแถว due แบบ FOR UPDATE SKIP LOCKED (หลายตัวก็ไม่ชน · stale reclaim 10 นาที)
CREATE OR REPLACE FUNCTION public.claim_notification_outbox(p_limit integer DEFAULT 25)
RETURNS SETOF public.notification_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE public.notification_outbox o
     SET status = 'sending', claimed_at = NOW(), updated_at = NOW()
   WHERE o.id IN (
     SELECT i.id FROM public.notification_outbox i
      WHERE (
              i.status = 'pending'
           OR (i.status = 'failed'  AND i.next_attempt_at <= NOW())
           OR (i.status = 'sending' AND i.claimed_at < NOW() - interval '10 minutes')
          )
        AND i.next_attempt_at <= NOW()
        AND i.attempts < 5
      ORDER BY i.next_attempt_at
      LIMIT greatest(1, least(coalesce(p_limit, 25), 100))
      FOR UPDATE SKIP LOCKED
   )
  RETURNING o.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_notification_outbox(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_notification_outbox(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_outbox(integer) TO service_role;

-- 3.4 complete_notification — ปิดสถานะเดียวทุกผลลัพธ์ (ok=sent · fail=backoff 2^n นาที cap 30 · >=5 = dead)
CREATE OR REPLACE FUNCTION public.complete_notification(
  p_id      text,
  p_ok      boolean,
  p_channel text DEFAULT NULL,
  p_error   text DEFAULT NULL,
  p_final   text DEFAULT NULL   -- 'mock' | 'dead' บังคับสถานะปลายทาง (เช่น LINE ยังไม่ live = mock)
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_att integer; v_next timestamptz;
BEGIN
  IF p_final = 'mock' THEN
    UPDATE public.notification_outbox
       SET status = 'mock', channel = coalesce(p_channel, 'line'), last_error = NULL,
           claimed_at = NULL, updated_at = NOW()
     WHERE id = p_id;
    RETURN jsonb_build_object('ok', true, 'status', 'mock');
  END IF;
  IF coalesce(p_ok, false) THEN
    UPDATE public.notification_outbox
       SET status = 'sent', channel = p_channel, attempts = attempts + 1,
           last_error = NULL, claimed_at = NULL, updated_at = NOW()
     WHERE id = p_id;
    RETURN jsonb_build_object('ok', true, 'status', 'sent', 'channel', p_channel);
  END IF;

  -- fail path
  SELECT attempts + 1 INTO v_att FROM public.notification_outbox WHERE id = p_id;
  IF v_att IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF v_att >= 5 OR p_final = 'dead' THEN
    UPDATE public.notification_outbox
       SET status = 'dead', attempts = v_att, last_error = left(coalesce(p_error, 'failed'), 300),
           claimed_at = NULL, updated_at = NOW()
     WHERE id = p_id;
    RETURN jsonb_build_object('ok', true, 'status', 'dead', 'attempts', v_att);
  END IF;
  -- retryable: backoff = 2^attempts นาที (cap 30 นาที)
  v_next := NOW() + (least(power(2, greatest(v_att, 1)), 30) * interval '1 minute');
  UPDATE public.notification_outbox
     SET status = 'failed', attempts = v_att, next_attempt_at = v_next,
         last_error = left(coalesce(p_error, 'failed'), 300), claimed_at = NULL, updated_at = NOW()
   WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'status', 'failed', 'attempts', v_att);
END;
$$;
REVOKE ALL ON FUNCTION public.complete_notification(text, boolean, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_notification(text, boolean, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_notification(text, boolean, text, text, text) TO service_role;

-- ============================================
-- 4) Feature flags (ค่าเริ่มต้น: push on · messenger on · LINE = DISABLED/MOCK ตามคำสั่ง Owner)
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.business_settings WHERE key = 'notification_channels') THEN
    INSERT INTO public.business_settings (key, value)
    VALUES ('notification_channels',
            '{"push": true, "messenger": true, "line": false, "lineMode": "mock"}'::jsonb);
  END IF;
END $$;

-- ============================================
-- 5) สะพาน pg_cron → EF notification-dispatcher (mirror m178 — guarded · token ไม่อยู่ในไฟล์)
--    ขั้นตอน apply: ตั้ง schedule ด้วย AUTOMATION_TOKEN จริง (e2e/r48Apply179.cjs)
-- ============================================
CREATE OR REPLACE FUNCTION public.bmb_notify_http(p_token text)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_job_id bigint;
BEGIN
  SELECT net.http_post(
    url := 'https://ivkdfognyiwjcmrhcnwz.supabase.co/functions/v1/notification-dispatcher',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-automation-token', p_token),
    body := jsonb_build_object('job', 'tick')
  ) INTO v_job_id;
  RETURN v_job_id;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'bmb_notify_http skipped: %', SQLERRM;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.bmb_notify_http(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bmb_notify_http(text) TO service_role;