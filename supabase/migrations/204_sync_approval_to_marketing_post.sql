-- ============================================
-- Bite Me Baby — Migration 204: Sync content_approvals approved -> marketing_posts approved
-- Date: 2026-11-11
--
-- Fix: review_content RPC doesn't update marketing_posts when approving
-- Result: marketing_posts.status stays 'pending_approval' even after approval
-- Fix: When review_content approves, also UPDATE marketing_posts SET status='approved'
-- ============================================

BEGIN;

-- ============================================
-- 1. Update review_content to sync marketing_posts on approve
-- ============================================
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
  v_content_type text;
  v_title text;
  v_body text;
  v_image_url text;
  v_mascot text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'ERR_FORBIDDEN'; END IF;
  IF p_decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'ERR_INVALID_DECISION'; END IF;

  UPDATE public.content_approvals
     SET status = p_decision, reviewed_by = v_uid, review_note = COALESCE(p_note, ''), reviewed_at = NOW()
   WHERE id = p_approval_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'ERR_APPROVAL_NOT_PENDING'; END IF;

  -- If approved, sync marketing_posts status to 'approved'
  IF p_decision = 'approved' THEN
    UPDATE public.marketing_posts
       SET status = 'approved', updated_at = NOW()
     WHERE approval_id = p_approval_id;
    
    -- Log sync for audit
    PERFORM public.append_audit_log('marketing_post_synced', 'marketing', p_approval_id,
      'marketing_posts status synced to approved via review_content', jsonb_build_object('approval_id', p_approval_id));
  END IF;

  PERFORM public.append_audit_log('content_review', 'content', p_approval_id, 'content ' || p_decision, jsonb_build_object('decision', p_decision));
  RETURN jsonb_build_object('ok', true, 'id', p_approval_id, 'status', p_decision);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_content FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_content TO authenticated;

COMMIT;