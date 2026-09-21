-- ============================================
-- Bite Me Baby — Migration 022: Phases 5-7 (AI hardening, Intelligence, Growth)
-- Date: 2026-09-21
--
-- 5 (AI-03 tuning)  save_ai_memory MERGES into existing memory instead of replace
-- 6 (CI-01)         customer_intelligence view + RPC (server-side segmentation)
-- 7 (CNT-01)        content_approvals + submit/review RPCs (no auto-publish)
--
-- Security: SECURITY DEFINER; admin-guarded where needed. Idempotent.
-- ============================================

BEGIN;

-- ============================================
-- 1. AI-03 tuning: merge (never lose old keys when persisting memory)
-- ============================================
CREATE OR REPLACE FUNCTION public.save_ai_memory(p_memory jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  INSERT INTO public.ai_customer_memory (user_id, memory, updated_at)
  VALUES (v_uid, COALESCE(p_memory, '{}'), NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET memory = COALESCE(ai_customer_memory.memory, '{}'::jsonb) || COALESCE(EXCLUDED.memory, '{}'::jsonb),
        updated_at = NOW();
  RETURN jsonb_build_object('ok', true, 'user_id', v_uid::text);
END;
$$;

-- ============================================
-- 2. CI-01: customer_intelligence (server-side, from paid orders only)
-- ============================================
CREATE OR REPLACE VIEW public.customer_intelligence AS
SELECT
  customer_ref AS user_id,
  count(*)::int  AS total_orders,
  sum(total_amount) AS total_revenue,
  round(avg(total_amount), 2) AS average_order_value,
  (CURRENT_DATE - max(created_at)::date) AS days_since_last_order,
  max(created_at) AS last_order_at,
  CASE WHEN count(*) >= 10 THEN 'vip' WHEN count(*) >= 2 THEN 'regular' ELSE 'new' END AS segment
FROM public.orders
WHERE customer_ref IS NOT NULL AND payment_status = 'paid'
GROUP BY customer_ref;

-- RPC: admin reads a customer's intelligence OR the whole list; customers read own.
CREATE OR REPLACE FUNCTION public.customer_intelligence(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_rows jsonb;
  v_me jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT to_jsonb(x) INTO v_me FROM public.customer_intelligence x WHERE user_id = p_user_id;
    IF p_user_id = v_uid OR public.is_admin() THEN
      RETURN jsonb_build_object('ok', true, 'customer', COALESCE(v_me, '{}'::jsonb));
    END IF;
    RAISE EXCEPTION 'ERR_FORBIDDEN';
  END IF;

  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  SELECT jsonb_agg(x) INTO v_rows FROM (SELECT * FROM public.customer_intelligence ORDER BY total_revenue DESC NULLS LAST) x;
  RETURN jsonb_build_object('ok', true, 'customers', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

GRANT SELECT ON public.customer_intelligence TO authenticated;

-- ============================================
-- 3. CNT-01: content approval workflow (no auto-publish)
-- ============================================
CREATE TABLE IF NOT EXISTS public.content_approvals (
  id            TEXT PRIMARY KEY,
  content_type  TEXT NOT NULL DEFAULT 'promotion' CHECK (content_type IN ('promotion','banner','post','announcement')),
  title         TEXT NOT NULL,
  body          TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_note   TEXT DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_content_approvals_status ON public.content_approvals (status, created_at DESC);
-- Submit content for approval (creator -> pending).
CREATE OR REPLACE FUNCTION public.submit_content_for_approval(
  p_content_type text,
  p_title text,
  p_body text DEFAULT ''
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
  INSERT INTO public.content_approvals (id, content_type, title, body, status, created_by, created_at)
  VALUES (v_id, COALESCE(p_content_type, 'promotion'), trim(p_title), COALESCE(p_body, ''), 'pending', v_uid, NOW());
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'status', 'pending');
END;
$$;

-- Review: admin approves (publishable) or rejects.
CREATE OR REPLACE FUNCTION public.review_content(
  p_approval_id text,
  p_decision text,
  p_note text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'ERR_INVALID_DECISION'; END IF;

  UPDATE public.content_approvals
     SET status = p_decision, reviewed_by = v_uid, review_note = COALESCE(p_note, ''), reviewed_at = NOW()
   WHERE id = p_approval_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_APPROVAL_NOT_PENDING'; END IF;

  PERFORM public.append_audit_log('content_review', 'content', p_approval_id, 'content ' || p_decision, jsonb_build_object('decision', p_decision));
  RETURN jsonb_build_object('ok', true, 'id', p_approval_id, 'status', p_decision);
END;
$$;

-- Publish gate: only approved content may be published (checked by client + EF).
CREATE OR REPLACE FUNCTION public.is_content_approved(p_approval_id text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.content_approvals WHERE id = p_approval_id AND status = 'approved');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_content_for_approval FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.review_content FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_content_for_approval TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_content TO authenticated;

-- ============================================
-- DONE
-- ============================================
COMMIT;

-- ============================================
-- END OF MIGRATION 022
-- ============================================

ALTER TABLE public.content_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS content_approvals_anon ON public.content_approvals;
CREATE POLICY content_approvals_anon ON public.content_approvals FOR ALL TO anon USING (false);
DROP POLICY IF EXISTS content_approvals_auth_read ON public.content_approvals;
CREATE POLICY content_approvals_auth_read ON public.content_approvals
  FOR SELECT TO authenticated USING (created_by = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS content_approvals_admin ON public.content_approvals;
CREATE POLICY content_approvals_admin ON public.content_approvals
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());