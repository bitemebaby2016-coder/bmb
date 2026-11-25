// ============================================
// Bite Me Baby — R205 source-contract test (Migration 205: Social AI order actions + web timeline)
// ตรวจสอบ migration 205 มี:
// 1. cancel_order_as_customer(p_order_number, p_customer_ref, p_reason) - service_role only
// 2. social_timeline_for_web() - authenticated user's cross-channel timeline
// ============================================

import { describe, it, expect } from 'vitest'
import mig205Src from '../../supabase/migrations/205_social_order_actions.sql?raw'

describe('R205 — Migration 205: Social AI order actions + web timeline', () => {
  // ============================================
  // A — cancel_order_as_customer
  // ============================================
  describe('cancel_order_as_customer — EF service_role เรียกยกเลิกแทนลูกค้า', () => {
    it('มี CREATE OR REPLACE FUNCTION cancel_order_as_customer(text, uuid, text) RETURNS jsonb', () => {
      expect(mig205Src).toContain('CREATE OR REPLACE FUNCTION public.cancel_order_as_customer(')
      expect(mig205Src).toContain('p_order_number text')
      expect(mig205Src).toContain('p_customer_ref uuid')
      expect(mig205Src).toContain("p_reason text DEFAULT ''")
      expect(mig205Src).toContain('RETURNS jsonb')
      expect(mig205Src).toContain('LANGUAGE plpgsql')
      expect(mig205Src).toContain('SECURITY DEFINER')
      expect(mig205Src).toContain('SET search_path = public')
    })

    it('มี guard: ห้ามใช้จาก authenticated (JWT claims มีอยู่แล้ว) → ERR_FORBIDDEN', () => {
      expect(mig205Src).toContain("v_claims := COALESCE(current_setting('request.jwt.claims', true), '')")
      expect(mig205Src).toContain("IF v_claims <> '' AND COALESCE(v_claims::jsonb ->> 'sub', '') <> '' THEN")
      expect(mig205Src).toContain("RAISE EXCEPTION 'ERR_FORBIDDEN'")
    })

    it('มี validation: ERR_MISSING_ORDER + ERR_MISSING_CUSTOMER', () => {
      expect(mig205Src).toContain("RAISE EXCEPTION 'ERR_MISSING_ORDER'")
      expect(mig205Src).toContain("RAISE EXCEPTION 'ERR_MISSING_CUSTOMER'")
    })

    it('มีผูกตัวตน: SELECT orders FOR UPDATE WHERE order_number = p_order_number + customer_ref = p_customer_ref', () => {
      expect(mig205Src).toContain("SELECT * INTO v_order FROM public.orders WHERE order_number = p_order_number FOR UPDATE")
      expect(mig205Src).toContain("IF v_order.customer_ref IS NULL OR v_order.customer_ref <> p_customer_ref THEN")
      expect(mig205Src).toContain("RAISE EXCEPTION 'ERR_FORBIDDEN'")
    })

    it('มี set_config JWT claims เป็นลูกค้า (transaction-local) → เรียก public.cancel_order', () => {
      expect(mig205Src).toContain("PERFORM set_config(")
      expect(mig205Src).toContain("'request.jwt.claims'")
      expect(mig205Src).toContain("json_build_object('sub', p_customer_ref::text, 'role', 'authenticated')::text")
      expect(mig205Src).toContain("true")
      expect(mig205Src).toContain("v_result := public.cancel_order(p_order_number, p_reason)")
    })

    it('มี GRANT: REVOKE FROM PUBLIC, anon, authenticated + GRANT TO service_role เท่านั้น', () => {
      expect(mig205Src).toContain('REVOKE EXECUTE ON FUNCTION public.cancel_order_as_customer FROM PUBLIC, anon, authenticated')
      expect(mig205Src).toContain('GRANT EXECUTE ON FUNCTION public.cancel_order_as_customer TO service_role')
    })
  })

  // ============================================
  // B — social_timeline_for_web
  // ============================================
  describe('social_timeline_for_web — ประวัติข้ามช่องทางสำหรับลูกค้าล็อกอินบนเว็บ', () => {
    it('มี CREATE OR REPLACE FUNCTION social_timeline_for_web() RETURNS jsonb', () => {
      expect(mig205Src).toContain('CREATE OR REPLACE FUNCTION public.social_timeline_for_web()')
      expect(mig205Src).toContain('RETURNS jsonb')
      expect(mig205Src).toContain('LANGUAGE plpgsql')
      expect(mig205Src).toContain('SECURITY DEFINER')
      expect(mig205Src).toContain('SET search_path = public')
    })

    it('มี validation: ERR_NOT_AUTHENTICATED', () => {
      expect(mig205Src).toContain("v_uid     uuid := auth.uid()")
      expect(mig205Src).toContain("IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'")
    })

    it('มี logic: หา external_user_id จาก customer_channel_identities WHERE customer_ref = auth.uid()', () => {
      expect(mig205Src).toContain("FROM public.customer_channel_identities")
      expect(mig205Src).toContain("WHERE customer_ref = v_uid")
      expect(mig205Src).toContain("array_agg(external_user_id)")
    })

    it('มี query social_events WHERE customer_id = ANY(v_extids) AND event_type IN (comment, message) ORDER BY received_at DESC LIMIT 10', () => {
      expect(mig205Src).toContain("FROM public.social_events se")
      expect(mig205Src).toContain("WHERE se.customer_id = ANY (v_extids)")
      expect(mig205Src).toContain("AND se.event_type IN ('comment', 'message')")
      expect(mig205Src).toContain("ORDER BY se.received_at DESC")
      expect(mig205Src).toContain("LIMIT 10")
    })

    it('มี select: event_type, left(content, 200), left(ai_reply_text, 200), received_at', () => {
      expect(mig205Src).toContain("se.event_type")
      expect(mig205Src).toContain("left(COALESCE(se.content, ''), 200)")
      expect(mig205Src).toContain("left(COALESCE(se.ai_reply_text, ''), 200)")
      expect(mig205Src).toContain("se.received_at")
    })

    it('มี GRANT: REVOKE FROM PUBLIC, anon + GRANT TO authenticated', () => {
      expect(mig205Src).toContain('REVOKE EXECUTE ON FUNCTION public.social_timeline_for_web FROM PUBLIC, anon')
      expect(mig205Src).toContain('GRANT EXECUTE ON FUNCTION public.social_timeline_for_web TO authenticated')
    })
  })

  // ============================================
  // C — Additive only / no breaking changes
  // ============================================
  describe('Additive only — ไม่มี DROP TABLE/COLUMN/POLICY ที่ทำลายของเดิม', () => {
    it('ไม่มี DROP TABLE', () => {
      expect(mig205Src).not.toContain('DROP TABLE')
    })

    it('ไม่มี DROP COLUMN', () => {
      expect(mig205Src).not.toContain('DROP COLUMN')
    })

    it('ไม่มี DROP FUNCTION (CREATE OR REPLACE ครบ 2 ฟังก์ชัน)', () => {
      const drops = (mig205Src.match(/DROP FUNCTION IF EXISTS/g) || []).length
      expect(drops).toBe(0)
      const creates = (mig205Src.match(/CREATE OR REPLACE FUNCTION/g) || []).length
      expect(creates).toBe(2)
    })

    it('มี BEGIN/COMMIT transaction wrapper', () => {
      expect(mig205Src).toContain('BEGIN;')
      expect(mig205Src).toContain('COMMIT;')
    })
  })
})