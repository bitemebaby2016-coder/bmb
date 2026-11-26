// ============================================
// Bite Me Baby — R203/R204 source-contract test (Migration 203: AI Grounding + user_post_context, 204: order_memory + sync_approval_to_marketing_post)
// ตรวจสอบ migration 203 มี: social_events grounding_data, reply_draft + GIN index + user_post_context table
// ตรวจสอบ migration 204 มี: social_events customer_id, last_order_id, order_history + indexes + review_content sync
// ============================================

import { describe, it, expect } from 'vitest'
import mig203GroundingSrc from '../../supabase/migrations/203_ai_grounding.sql?raw'
import mig203UserPostCtxSrc from '../../supabase/migrations/231_user_post_context.sql?raw'
import mig204OrderMemorySrc from '../../supabase/migrations/204_order_memory.sql?raw'
import mig204SyncApprovalSrc from '../../supabase/migrations/232_sync_approval_to_marketing_post.sql?raw'

describe('R203/R204 — Migration 203: AI Grounding + user_post_context, Migration 204: order_memory + sync approval', () => {
  // ============================================
  // A — Migration 203: AI Grounding columns
  // ============================================
  describe('Migration 203: AI Grounding columns on social_events', () => {
    it('มี ALTER TABLE social_events ADD COLUMN grounding_data jsonb', () => {
      expect(mig203GroundingSrc).toContain('ALTER TABLE public.social_events ADD COLUMN IF NOT EXISTS grounding_data jsonb')
    })

    it('มี ALTER TABLE social_events ADD COLUMN reply_draft text', () => {
      expect(mig203GroundingSrc).toContain('ALTER TABLE public.social_events ADD COLUMN IF NOT EXISTS reply_draft text')
    })

    it('มี COMMENT ON COLUMN grounding_data + reply_draft', () => {
      expect(mig203GroundingSrc).toContain("COMMENT ON COLUMN public.social_events.grounding_data IS 'R96: Product IDs, prices, schedules used for AI reply grounding'")
      expect(mig203GroundingSrc).toContain("COMMENT ON COLUMN public.social_events.reply_draft IS 'R96: Full draft text before sending (audit trail)'")
    })

    it('มี GIN index idx_social_events_grounding_data', () => {
      expect(mig203GroundingSrc).toContain('CREATE INDEX IF NOT EXISTS idx_social_events_grounding_data ON public.social_events USING GIN (grounding_data)')
    })
  })

  // ============================================
  // B — Migration 203: user_post_context table
  // ============================================
  describe('Migration 203: user_post_context table', () => {
    it('มี CREATE TABLE user_post_context พร้อม column ครบ', () => {
      expect(mig203UserPostCtxSrc).toContain('CREATE TABLE IF NOT EXISTS user_post_context')
      expect(mig203UserPostCtxSrc).toContain('user_id TEXT NOT NULL')
      expect(mig203UserPostCtxSrc).toContain('page_id TEXT NOT NULL')
      expect(mig203UserPostCtxSrc).toContain('post_id TEXT NOT NULL')
      expect(mig203UserPostCtxSrc).toContain('post_message TEXT NOT NULL')
      expect(mig203UserPostCtxSrc).toContain('post_created_at TIMESTAMPTZ')
      expect(mig203UserPostCtxSrc).toContain('updated_at TIMESTAMPTZ DEFAULT now()')
      expect(mig203UserPostCtxSrc).toContain('PRIMARY KEY (user_id, page_id)')
    })

    it('มี index idx_user_post_context_updated', () => {
      expect(mig203UserPostCtxSrc).toContain('CREATE INDEX IF NOT EXISTS idx_user_post_context_updated ON user_post_context(updated_at)')
    })

    it('มี RLS ENABLE + policy service_role_full_access', () => {
      expect(mig203UserPostCtxSrc).toContain('ALTER TABLE user_post_context ENABLE ROW LEVEL SECURITY')
      expect(mig203UserPostCtxSrc).toContain('CREATE POLICY "service_role_full_access" ON user_post_context')
      expect(mig203UserPostCtxSrc).toContain('FOR ALL USING (auth.role() = \'service_role\')')
    })

    it('มี GRANT ALL ON user_post_context TO service_role', () => {
      expect(mig203UserPostCtxSrc).toContain('GRANT ALL ON user_post_context TO service_role')
    })
  })

  // ============================================
  // C — Migration 204: order_memory columns
  // ============================================
  describe('Migration 204: order_memory columns on social_events', () => {
    it('มี ALTER TABLE social_events ADD COLUMN customer_id text', () => {
      expect(mig204OrderMemorySrc).toContain('ALTER TABLE public.social_events ADD COLUMN IF NOT EXISTS customer_id text')
    })

    it('มี ALTER TABLE social_events ADD COLUMN last_order_id text', () => {
      expect(mig204OrderMemorySrc).toContain('ALTER TABLE public.social_events ADD COLUMN IF NOT EXISTS last_order_id text')
    })

    it('มี ALTER TABLE social_events ADD COLUMN order_history jsonb', () => {
      expect(mig204OrderMemorySrc).toContain('ALTER TABLE public.social_events ADD COLUMN IF NOT EXISTS order_history jsonb')
    })

    it('มี COMMENT ON COLUMN customer_id + last_order_id + order_history', () => {
      expect(mig204OrderMemorySrc).toContain("COMMENT ON COLUMN public.social_events.customer_id IS 'R97: Facebook/Messenger user ID for order lookup'")
      expect(mig204OrderMemorySrc).toContain("COMMENT ON COLUMN public.social_events.last_order_id IS 'R97: Most recent order ID for quick reference'")
      expect(mig204OrderMemorySrc).toContain("COMMENT ON COLUMN public.social_events.order_history IS 'R97: Last 10 orders with summary (menu, total, status)'")
    })

    it('มี index idx_social_events_customer_id + idx_social_events_last_order_id', () => {
      expect(mig204OrderMemorySrc).toContain('CREATE INDEX IF NOT EXISTS idx_social_events_customer_id ON public.social_events (customer_id)')
      expect(mig204OrderMemorySrc).toContain('CREATE INDEX IF NOT EXISTS idx_social_events_last_order_id ON public.social_events (last_order_id)')
    })
  })

  // ============================================
  // D — Migration 204: sync approval to marketing_post (review_content)
  // ============================================
  describe('Migration 204: review_content sync marketing_posts on approve', () => {
    it('มี CREATE OR REPLACE FUNCTION review_content(text, text, text) RETURNS jsonb', () => {
      expect(mig204SyncApprovalSrc).toContain('CREATE OR REPLACE FUNCTION public.review_content(')
      expect(mig204SyncApprovalSrc).toContain('p_approval_id text')
      expect(mig204SyncApprovalSrc).toContain('p_decision text')
      expect(mig204SyncApprovalSrc).toContain("p_note text DEFAULT ''")
      expect(mig204SyncApprovalSrc).toContain('RETURNS jsonb')
      expect(mig204SyncApprovalSrc).toContain('LANGUAGE plpgsql')
      expect(mig204SyncApprovalSrc).toContain('SECURITY DEFINER')
      expect(mig204SyncApprovalSrc).toContain('SET search_path = public')
    })

    it('มี validation: ERR_NOT_AUTHENTICATED + ERR_FORBIDDEN + ERR_INVALID_DECISION + ERR_APPROVAL_NOT_PENDING', () => {
      expect(mig204SyncApprovalSrc).toContain("RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'")
      expect(mig204SyncApprovalSrc).toContain("RAISE EXCEPTION 'ERR_FORBIDDEN'")
      expect(mig204SyncApprovalSrc).toContain("RAISE EXCEPTION 'ERR_INVALID_DECISION'")
      expect(mig204SyncApprovalSrc).toContain("RAISE EXCEPTION 'ERR_APPROVAL_NOT_PENDING'")
    })

    it('มี logic: UPDATE content_approvals SET status = p_decision WHERE id = p_approval_id AND status = pending', () => {
      expect(mig204SyncApprovalSrc).toContain('UPDATE public.content_approvals')
      expect(mig204SyncApprovalSrc).toContain("SET status = p_decision")
      expect(mig204SyncApprovalSrc).toContain("WHERE id = p_approval_id AND status = 'pending'")
      expect(mig204SyncApprovalSrc).toContain("IF NOT FOUND THEN RAISE EXCEPTION 'ERR_APPROVAL_NOT_PENDING'")
    })

    it('มี sync marketing_posts: WHEN p_decision = approved THEN UPDATE marketing_posts SET status = approved WHERE approval_id = p_approval_id', () => {
      expect(mig204SyncApprovalSrc).toContain("IF p_decision = 'approved' THEN")
      expect(mig204SyncApprovalSrc).toContain('UPDATE public.marketing_posts')
      expect(mig204SyncApprovalSrc).toContain("SET status = 'approved'")
      expect(mig204SyncApprovalSrc).toContain('WHERE approval_id = p_approval_id')
    })

    it('มี append_audit_log marketing_post_synced เมื่อ approved', () => {
      expect(mig204SyncApprovalSrc).toContain("append_audit_log('marketing_post_synced'")
      expect(mig204SyncApprovalSrc).toContain("'marketing_posts status synced to approved via review_content'")
    })

    it('มี append_audit_log content_review', () => {
      expect(mig204SyncApprovalSrc).toContain("append_audit_log('content_review'")
      expect(mig204SyncApprovalSrc).toContain("'content ' || p_decision")
    })

    it('มี GRANT: REVOKE FROM PUBLIC + GRANT TO authenticated', () => {
      expect(mig204SyncApprovalSrc).toContain('REVOKE EXECUTE ON FUNCTION public.review_content FROM PUBLIC')
      expect(mig204SyncApprovalSrc).toContain('GRANT EXECUTE ON FUNCTION public.review_content TO authenticated')
    })

    it('มี BEGIN/COMMIT transaction wrapper', () => {
      expect(mig204SyncApprovalSrc).toContain('BEGIN;')
      expect(mig204SyncApprovalSrc).toContain('COMMIT;')
    })
  })

  // ============================================
  // E — Additive only / no breaking changes
  // ============================================
  describe('Additive only — ไม่มี DROP TABLE/COLUMN/POLICY ที่ทำลายของเดิม', () => {
    it('Migration 203 (grounding): ไม่มี DROP TABLE', () => {
      expect(mig203GroundingSrc).not.toContain('DROP TABLE')
    })

    it('Migration 203 (grounding): ไม่มี DROP COLUMN', () => {
      expect(mig203GroundingSrc).not.toContain('DROP COLUMN')
    })

    it('Migration 203 (user_post_context): ไม่มี DROP TABLE', () => {
      expect(mig203UserPostCtxSrc).not.toContain('DROP TABLE')
    })

    it('Migration 203 (user_post_context): ไม่มี DROP COLUMN', () => {
      expect(mig203UserPostCtxSrc).not.toContain('DROP COLUMN')
    })

    it('Migration 204 (order_memory): ไม่มี DROP TABLE', () => {
      expect(mig204OrderMemorySrc).not.toContain('DROP TABLE')
    })

    it('Migration 204 (order_memory): ไม่มี DROP COLUMN', () => {
      expect(mig204OrderMemorySrc).not.toContain('DROP COLUMN')
    })

    it('Migration 204 (sync_approval): ไม่มี DROP TABLE', () => {
      expect(mig204SyncApprovalSrc).not.toContain('DROP TABLE')
    })

    it('Migration 204 (sync_approval): ไม่มี DROP COLUMN', () => {
      expect(mig204SyncApprovalSrc).not.toContain('DROP COLUMN')
    })
  })
})