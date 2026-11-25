// ============================================
// Bite Me Baby — R207/R211 source-contract test (Migration 207: rider history dates, 211: my_deliveries v3 RETURN fix)
// ตรวจสอบ migration 207: my_deliveries v3 (5 params required, scheduled_date + filters)
// ตรวจสอบ migration 211: my_deliveries v3-fixed (to_jsonb(v_drv) RETURN fix + offline gate + delivery_round_id JOIN)
// ============================================

import { describe, it, expect } from 'vitest'
import mig207Src from '../../supabase/migrations/207_rider_history_dates.sql?raw'
import mig211Src from '../../supabase/migrations/211_rider_my_deliveries_return_fix.sql?raw'

describe('R207/R211 — Migration 207: rider history dates + Migration 211: my_deliveries v3 RETURN fix', () => {
  // ============================================
  // A — Migration 207: my_deliveries v3 (5 params required)
  // ============================================
  describe('Migration 207: my_deliveries v3 (5 params required, scheduled_date + filters)', () => {
    it('มี DROP FUNCTION IF EXISTS my_deliveries(text, timestamptz, timestamptz, date, date)', () => {
      expect(mig207Src).toContain("DROP FUNCTION IF EXISTS public.my_deliveries(text, timestamptz, timestamptz, date, date)")
    })

    it('มี CREATE OR REPLACE FUNCTION my_deliveries 5 params (p_driver_phone, p_assigned_from, p_assigned_to, p_scheduled_from, p_scheduled_to)', () => {
      expect(mig207Src).toContain('CREATE OR REPLACE FUNCTION public.my_deliveries(')
      expect(mig207Src).toContain('p_driver_phone text')
      expect(mig207Src).toContain('p_assigned_from timestamptz')
      expect(mig207Src).toContain('p_assigned_to timestamptz')
      expect(mig207Src).toContain('p_scheduled_from date')
      expect(mig207Src).toContain('p_scheduled_to date')
      expect(mig207Src).toContain('RETURNS jsonb')
      expect(mig207Src).toContain('LANGUAGE plpgsql')
      expect(mig207Src).toContain('SECURITY DEFINER')
      expect(mig207Src).toContain('SET search_path = public')
    })

    it('ไม่มี DEFAULT บน parameter ใดๆ (กัน overload ambiguity กับ legacy my_deliveries(text))', () => {
      // Migration 207 มี check ใน VERIFICATION block ว่าไม่มี DEFAULT แต่ไม่ได้เขียน DEFAULT ใน function signature จริง
      expect(mig207Src).toContain('p_driver_phone text,')
      expect(mig207Src).toContain('p_assigned_from timestamptz,')
      expect(mig207Src).toContain('p_assigned_to timestamptz,')
      expect(mig207Src).toContain('p_scheduled_from date,')
      expect(mig207Src).toContain('p_scheduled_to date')
      // ตรวจสอบว่า VERIFICATION block check ไม่มี DEFAULT
      expect(mig207Src).toContain("p_driver_phone text DEFAULT")
    })

    it('มี JOIN delivery_rounds ผ่าน o.round_id → scheduled_date', () => {
      expect(mig207Src).toContain('LEFT JOIN public.delivery_rounds dr ON dr.id = o.round_id')
      expect(mig207Src).toContain('dr.scheduled_date')
    })

    it('มี filter params: p_assigned_from, p_assigned_to, p_scheduled_from, p_scheduled_to', () => {
      expect(mig207Src).toContain('AND (p_assigned_from IS NULL OR da.assigned_at >= p_assigned_from)')
      expect(mig207Src).toContain('AND (p_assigned_to IS NULL OR da.assigned_at <= p_assigned_to)')
      expect(mig207Src).toContain('AND (p_scheduled_from IS NULL OR dr.scheduled_date >= p_scheduled_from)')
      expect(mig207Src).toContain('AND (p_scheduled_to IS NULL OR dr.scheduled_date <= p_scheduled_to)')
    })

    it('มี VERIFICATION DO block: scheduled_date + filters + JOIN delivery_rounds', () => {
      expect(mig207Src).toContain("ERR_VERIFY: scheduled_date missing in my_deliveries")
      expect(mig207Src).toContain("ERR_VERIFY: p_assigned_from missing")
      expect(mig207Src).toContain("ERR_VERIFY: p_scheduled_from missing")
      expect(mig207Src).toContain("ERR_VERIFY: JOIN delivery_rounds missing")
      expect(mig207Src).toContain("ERR_VERIFY: p_driver_phone ห้ามมี DEFAULT")
      expect(mig207Src).toContain("ERR_VERIFY: p_assigned_from ห้ามมี DEFAULT")
    })

    it('มี VERIFICATION DO block: ambiguity guards (0-arg, 1-arg resolve unambiguously)', () => {
      expect(mig207Src).toContain("ERR_VERIFY_AMBIGUOUS_0ARG: my_deliveries() is not unique")
      expect(mig207Src).toContain("ERR_VERIFY_AMBIGUOUS_1ARG: my_deliveries(text) is not unique")
    })

    it('มี GRANT: REVOKE FROM PUBLIC, anon + GRANT TO authenticated', () => {
      expect(mig207Src).toContain('REVOKE EXECUTE ON FUNCTION public.my_deliveries(text, timestamptz, timestamptz, date, date) FROM PUBLIC, anon')
      expect(mig207Src).toContain('GRANT EXECUTE ON FUNCTION public.my_deliveries(text, timestamptz, timestamptz, date, date) TO authenticated')
    })
  })

  // ============================================
  // B — Migration 211: my_deliveries v3-fixed (RETURN fix)
  // ============================================
  describe('Migration 211: my_deliveries v3-fixed (to_jsonb(v_drv) RETURN fix)', () => {
    it('มี DROP FUNCTION IF EXISTS my_deliveries(text, timestamptz, timestamptz, date, date)', () => {
      expect(mig211Src).toContain("DROP FUNCTION IF EXISTS public.my_deliveries(text, timestamptz, timestamptz, date, date)")
    })

    it('มี CREATE OR REPLACE FUNCTION my_deliveries 5 params (เหมือน m207)', () => {
      expect(mig211Src).toContain('CREATE OR REPLACE FUNCTION public.my_deliveries(')
      expect(mig211Src).toContain('p_driver_phone text')
      expect(mig211Src).toContain('p_assigned_from timestamptz')
      expect(mig211Src).toContain('p_assigned_to timestamptz')
      expect(mig211Src).toContain('p_scheduled_from date')
      expect(mig211Src).toContain('p_scheduled_to date')
      expect(mig211Src).toContain('RETURNS jsonb')
    })

    it('มี OFFLINE GATE: IF v_drv.status = offline THEN RAISE EXCEPTION ERR_DRIVER_OFFLINE', () => {
      expect(mig211Src).toContain("IF v_drv.status = 'offline' THEN")
      expect(mig211Src).toContain("RAISE EXCEPTION 'ERR_DRIVER_OFFLINE'")
    })

    it('มี JOIN delivery_rounds ผ่าน o.delivery_round_id (แก้จาก m207 ที่ใช้อ round_id)', () => {
      expect(mig211Src).toContain('LEFT JOIN public.delivery_rounds dr ON dr.id = o.delivery_round_id')
      expect(mig211Src).toContain('dr.scheduled_date')
    })

    it('มี RETURN FIX: to_jsonb(v_drv) แทน subquery SELECT * (บั๊ก m210)', () => {
      expect(mig211Src).toContain("RETURN jsonb_build_object('ok', true, 'driver', to_jsonb(v_drv)")
      // ตรวจสอบว่า function definition ใช้ to_jsonb(v_drv) ไม่ใช่ subquery
      expect(mig211Src).toContain('to_jsonb(v_drv)')
    })

    it('มี VERIFICATION A — รันจริงจนถึง RETURN (set_config JWT claims + ต้องได้ ok=true)', () => {
      expect(mig211Src).toContain("PERFORM set_config('request.jwt.claims'")
      expect(mig211Src).toContain("jsonb_build_object('sub', v_uid::text, 'role', 'authenticated')::text")
      expect(mig211Src).toContain("true")
      expect(mig211Src).toContain("v_res := public.my_deliveries('', NULL, NULL, NULL, NULL)")
      expect(mig211Src).toContain("(v_res->>'ok') <> 'true'")
      expect(mig211Src).toContain("VERIFY-A FAIL: my_deliveries ไม่คืน ok=true")
      expect(mig211Src).toContain("VERIFY-A PASS: my_deliveries 5-arg รันถึง RETURN จริง")
    })

    it('มี VERIFICATION B — signature + JOIN + offline gate + to_jsonb(v_drv) + no defaults', () => {
      expect(mig211Src).toContain("ERR_VERIFY: scheduled_date missing")
      expect(mig211Src).toContain("ERR_VERIFY: delivery_round_id JOIN missing")
      expect(mig211Src).toContain("ERR_VERIFY: legacy o.round_id JOIN ยังติดค้าง")
      expect(mig211Src).toContain("ERR_VERIFY: RETURN ต้องใช้ to_jsonb(v_drv)")
      expect(mig211Src).toContain("ERR_VERIFY: subquery SELECT * ใน RETURN ยังติดค้าง")
      expect(mig211Src).toContain("ERR_VERIFY: offline gate หาย")
      expect(mig211Src).toContain("ERR_VERIFY: ห้ามมี DEFAULT")
    })

    it('มี VERIFICATION C — ambiguity guards (0-arg, 1-arg)', () => {
      expect(mig211Src).toContain("ERR_VERIFY_AMBIGUOUS_0ARG: my_deliveries() is not unique")
      expect(mig211Src).toContain("ERR_VERIFY_AMBIGUOUS_1ARG: my_deliveries(text) is not unique")
    })

    it('มี GRANT: REVOKE FROM PUBLIC, anon + GRANT TO authenticated', () => {
      expect(mig211Src).toContain('REVOKE EXECUTE ON FUNCTION public.my_deliveries(text, timestamptz, timestamptz, date, date) FROM PUBLIC, anon')
      expect(mig211Src).toContain('GRANT EXECUTE ON FUNCTION public.my_deliveries(text, timestamptz, timestamptz, date, date) TO authenticated')
    })
  })

  // ============================================
  // C — Additive only / no breaking changes
  // ============================================
  describe('Additive only — ไม่มี DROP TABLE/COLUMN/POLICY ที่ทำลายของเดิม', () => {
    it('Migration 207: ไม่มี DROP TABLE', () => {
      expect(mig207Src).not.toContain('DROP TABLE')
    })

    it('Migration 207: ไม่มี DROP COLUMN', () => {
      expect(mig207Src).not.toContain('DROP COLUMN')
    })

    it('Migration 211: ไม่มี DROP TABLE', () => {
      expect(mig211Src).not.toContain('DROP TABLE')
    })

    it('Migration 211: ไม่มี DROP COLUMN', () => {
      expect(mig211Src).not.toContain('DROP COLUMN')
    })
  })
})