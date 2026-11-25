// ============================================
// Bite Me Baby — R213 source-contract test (Migration 213: cart_sessions payload + select_own RLS)
// ตรวจสอบ migration 213 มี:
// 1. ADD COLUMN IF NOT EXISTS payload JSONB (additive)
// 2. RLS policy cart_sessions_select_own FOR SELECT TO authenticated (mirror m180 insert_own/update_own)
// ============================================

import { describe, it, expect } from 'vitest'
import mig213Src from '../../supabase/migrations/213_cart_sessions_payload.sql?raw'

describe('R213 — Migration 213: cart_sessions payload + select_own RLS', () => {
  // ============================================
  // A — Migration 213: payload column + SELECT-own RLS
  // ============================================
  describe('Migration 213: payload + select_own', () => {
    it('เพิ่ม payload JSONB แบบ IF NOT EXISTS (additive — ไม่แตะ column เดิม)', () => {
      expect(mig213Src).toMatch(/ADD COLUMN IF NOT EXISTS payload JSONB/)
    })

    it('มี RLS SELECT ให้เจ้าของตัวเอง — เงื่อนไข mirror insert_own/update_own ของ m180', () => {
      expect(mig213Src).toMatch(/CREATE POLICY cart_sessions_select_own ON public\.cart_sessions/)
      expect(mig213Src).toMatch(/FOR SELECT TO authenticated/)
      expect(mig213Src).toMatch(
        /USING \(customer_id IS NULL OR customer_id IN \(SELECT id FROM public\.customers WHERE user_id = auth\.uid\(\)\)\)/
      )
    })

    it('ไม่ลบ/แตะ policy เดิมของ m180 (deny_anon/insert_own/update_own/admin_all คงอยู่)', () => {
      expect(mig213Src).not.toMatch(/DROP POLICY IF EXISTS (cart_sessions_deny_anon|cart_sessions_insert_own|cart_sessions_update_own|cart_sessions_admin_all)/)
      expect(mig213Src).not.toMatch(/DROP TABLE|DROP COLUMN/)
    })
  })

  // ============================================
  // B — Additive only / no breaking changes
  // ============================================
  describe('Additive only — ไม่มี DROP TABLE/COLUMN/POLICY ที่ทำลายของเดิม', () => {
    it('ไม่มี DROP TABLE', () => {
      expect(mig213Src).not.toContain('DROP TABLE')
    })

    it('ไม่มี DROP COLUMN', () => {
      expect(mig213Src).not.toContain('DROP COLUMN')
    })

    it('DROP POLICY เฉพาะ IF EXISTS policies ที่จะ CREATE ใหม่ (cart_sessions_select_own)', () => {
      expect(mig213Src).toContain('DROP POLICY IF EXISTS cart_sessions_select_own ON public.cart_sessions')
      const drops = (mig213Src.match(/DROP POLICY IF EXISTS/g) || []).length
      const creates = (mig213Src.match(/CREATE POLICY/g) || []).length
      expect(drops).toBe(creates)
    })
  })
})