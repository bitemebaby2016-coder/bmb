// ============================================
// Bite Me Baby — R212 source-contract test (Migration 212: delivery sync preparing hop)
// ตรวจสอบ migration 212 มี hop ใหม่ preparing -> ready_for_dispatch + guard ERR_KITCHEN_NOT_READY
// ใน 3 RPC canonical: driver_update_delivery_status, admin_advance_delivery_status, driver_checkin_arrival
// ============================================

import { describe, it, expect } from 'vitest'
import mig212Src from '../../supabase/migrations/212_delivery_sync_preparing_hop.sql?raw'

describe('R212 — Migration 212: delivery sync preparing hop + ERR_KITCHEN_NOT_READY', () => {
  // 3 ฟังก์ชัน canonical ที่ต้องมี hop ใหม่
  const FUNCTIONS = [
    'driver_update_delivery_status',
    'admin_advance_delivery_status',
    'driver_checkin_arrival',
  ]

  FUNCTIONS.forEach((fn) => {
    describe(`${fn} — hop chain + guard`, () => {
      it(`มี CASE WHEN 'preparing' THEN 'ready_for_dispatch'`, () => {
        // ตรวจหา CASE statement ที่มี preparing hop
        expect(mig212Src).toContain("WHEN 'preparing'          THEN 'ready_for_dispatch'")
      })

      it(`มี guard pending/confirmed → ERR_KITCHEN_NOT_READY`, () => {
        expect(mig212Src).toContain("IF v_order_status IN ('pending', 'confirmed') THEN")
        expect(mig212Src).toContain("RAISE EXCEPTION 'ERR_KITCHEN_NOT_READY: order % still % (needs ready_for_dispatch)'")
      })

      it(`มี audit message auto_hop: true เมื่อ hop จาก preparing`, () => {
        // ตรวจว่า append_audit_log มี auto_hop flag
        expect(mig212Src).toContain("'auto_hop', (v_hop_from = 'preparing')")
      })

      it(`ยังคง hop chain เดิมครบ (ready_for_dispatch -> dispatched -> in_transit -> arrived -> delivered)`, () => {
        expect(mig212Src).toContain("WHEN 'ready_for_dispatch' THEN 'dispatched'")
        expect(mig212Src).toContain("WHEN 'dispatched'         THEN 'in_transit'")
        expect(mig212Src).toContain("WHEN 'in_transit'         THEN 'arrived'")
        expect(mig212Src).toContain("WHEN 'arrived'            THEN 'delivered'")
      })

      it(`ยังคง bounded loop (WHILE v_hop_from <> v_target)`, () => {
        // ตรวจว่า loop structure คงเดิม
        expect(mig212Src).toContain('WHILE v_hop_from <> v_target LOOP')
        expect(mig212Src).toContain('v_hop_from := v_hop_to')
      })

      it(`ยังคง allow-list check order_transition_allowed`, () => {
        expect(mig212Src).toContain('order_transition_allowed(v_hop_from, v_hop_to, true, false)')
      })

      it(`grant pattern: REVOKE PUBLIC + GRANT authenticated (หรือ GRANT authenticated สำหรับ admin function)`, () => {
        if (fn === 'admin_advance_delivery_status') {
          // Admin function: GRANT authenticated only (no REVOKE FROM PUBLIC/anon pattern in this migration)
          expect(mig212Src).toContain('GRANT EXECUTE ON FUNCTION public.admin_advance_delivery_status(text, text) TO authenticated')
        } else {
          // Driver functions: REVOKE PUBLIC + GRANT authenticated
          expect(mig212Src).toContain(`REVOKE EXECUTE ON FUNCTION public.${fn}`)
          expect(mig212Src).toContain('FROM PUBLIC')
          expect(mig212Src).toContain('TO authenticated')
        }
      })
    })
  })

  // ตรวจสอบ migration มีฟังก์ชันทั้ง 3 ตัวครบ
  it('มี CREATE OR REPLACE FUNCTION สำหรับทั้ง 3 RPC', () => {
    FUNCTIONS.forEach((fn) => {
      expect(mig212Src).toContain(`CREATE OR REPLACE FUNCTION public.${fn}`)
    })
  })

  it('ไม่มีการลบ hop เดิม (backward compatibility)', () => {
    // ตรวจสอบว่า hop chain เดิมยังคงอยู่ทั้งหมด
    const requiredHops = [
      "WHEN 'ready_for_dispatch' THEN 'dispatched'",
      "WHEN 'dispatched'         THEN 'in_transit'",
      "WHEN 'in_transit'         THEN 'arrived'",
      "WHEN 'arrived'            THEN 'delivered'",
    ]
    requiredHops.forEach((hop) => {
      expect(mig212Src).toContain(hop)
    })
  })

  // ============================================
  // Additive only / no breaking changes
  // ============================================
  describe('Additive only — ไม่มี DROP TABLE/COLUMN/POLICY ที่ทำลายของเดิม', () => {
    it('ไม่มี DROP TABLE', () => {
      expect(mig212Src).not.toContain('DROP TABLE')
    })

    it('ไม่มี DROP COLUMN', () => {
      expect(mig212Src).not.toContain('DROP COLUMN')
    })

    it('มี BEGIN/COMMIT transaction wrapper', () => {
      expect(mig212Src).toContain('BEGIN;')
      expect(mig212Src).toContain('COMMIT;')
    })
  })
})