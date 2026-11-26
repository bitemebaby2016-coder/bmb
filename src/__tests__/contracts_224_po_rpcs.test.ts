// ============================================
// Bite Me Baby — Phase 2 WP2 source-contract test (MIGRATION 224)
// ประเภท: STATIC SOURCE-CONTRACT ของ migration 224 (PO Workflow RPC)
//   ยืนยันว่าโค้ด SQL สอดคล้อง schema contract ของ WP1 (m219/223)
//   และกฎ Owner C/D (SECURITY DEFINER ตรวจ role + has_org_row_scope เอง)
//   + WP2 REMEDIATION: ลบ has_staff_branch_scope ที่ไม่มีอยู่จริง
// runtime จริง พิสูจน์ใน e2e/contracts_wp2_224.sql (Docker replay)
// ============================================

import { describe, it, expect } from 'vitest'
import wp2Migration from '../../supabase/migrations/224_purchase_order_rpcs.sql?raw'

describe('Phase 2 WP2 — Migration 224 (PO Workflow RPC) source-contract', () => {
  describe('โครงสร้างไฟล์ + ข้อกำหนดกลาง (Owner C/D)', () => {
    it('เป็น migration ที่มี BEGIN/COMMIT', () => {
      expect(wp2Migration).toMatch(/BEGIN;/)
      expect(wp2Migration).toMatch(/COMMIT;/)
    })

    it('ระบุ WP2 + dependencies 219/223', () => {
      expect(wp2Migration).toMatch(/WP2/)
      expect(wp2Migration).toMatch(/219/)
      expect(wp2Migration).toMatch(/223/)
    })

    it('ทุก function เป็น SECURITY DEFINER + SET search_path = public', () => {
      const defCount = (wp2Migration.match(/SECURITY DEFINER/g) || []).length
      expect(defCount).toBeGreaterThanOrEqual(5)
      expect(wp2Migration).toMatch(/SET search_path = public/)
    })

    it('ตรวจ role ภายใน function (is_staff/is_finance/is_admin)', () => {
      expect(wp2Migration).toMatch(/public\.is_staff\(\)/)
      expect(wp2Migration).toMatch(/public\.is_finance\(\)/)
      expect(wp2Migration).toMatch(/public\.is_admin\(\)/)
    })

    it('ตรวจ org scope ด้วย has_org_row_scope ในทุก function ที่แตะ PO เดิม', () => {
      expect(wp2Migration).toMatch(/public\.has_org_row_scope\(v_po\.tenant_id, v_po\.branch_id\)/)
    })

    it('REVOKE จาก PUBLIC/anon + GRANT ให้ authenticated', () => {
      expect(wp2Migration).toMatch(/REVOKE EXECUTE ON FUNCTION public\.create_purchase_order/)
      expect(wp2Migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.create_purchase_order/)
      expect(wp2Migration).toMatch(/TO authenticated/)
    })
  })

  describe('WP2 REMEDIATION — has_staff_branch_scope ถูกลบ (ไม่มีอยู่จริงใน migration ใด)', () => {
    it('ไม่มีการเรียก has_staff_branch_scope (กัน runtime error)', () => {
      expect(wp2Migration).not.toMatch(/has_staff_branch_scope\s*\(/)
    })
  })

  describe('5 functions ครบ + ตรง contract', () => {
    it('generate_po_number ใช้ po_number_seq + format PO-YYYYMMDD-{seq} + BKK date (ห้าม CURRENT_DATE)', () => {
      expect(wp2Migration).toMatch(/CREATE OR REPLACE FUNCTION public\.generate_po_number\(\)/)
      expect(wp2Migration).toMatch(/nextval\('po_number_seq'\)/)
      expect(wp2Migration).toMatch(/'PO-' \|\| to_char\(v_today, 'YYYYMMDD'\)/)
      expect(wp2Migration).toMatch(/lpad\(v_seq::TEXT, 4, '0'\)/)
      expect(wp2Migration).toMatch(/Asia\/Bangkok/)
      expect(wp2Migration).not.toMatch(/CURRENT_DATE/)
    })

    it('create/update/submit/approve ครบ', () => {
      expect(wp2Migration).toMatch(/CREATE OR REPLACE FUNCTION public\.create_purchase_order\(/)
      expect(wp2Migration).toMatch(/CREATE OR REPLACE FUNCTION public\.update_purchase_order\(/)
      expect(wp2Migration).toMatch(/CREATE OR REPLACE FUNCTION public\.submit_purchase_order\(p_po_id TEXT\)/)
      expect(wp2Migration).toMatch(/CREATE OR REPLACE FUNCTION public\.approve_purchase_order\(p_po_id TEXT\)/)
    })

    it('approve = finance/admin เท่านั้น + status gate submitted', () => {
      expect(wp2Migration).toMatch(/NOT public\.is_finance\(\) AND NOT public\.is_admin\(\)/)
      expect(wp2Migration).toMatch(/v_po\.status <> 'submitted'/)
    })

    it('create บังคับ branch ของ caller (ERR_FORBIDDEN_BRANCH)', () => {
      expect(wp2Migration).toMatch(/ERR_FORBIDDEN_BRANCH/)
      expect(wp2Migration).toMatch(/v_branch IS NOT NULL AND p_branch_id IS NOT NULL AND p_branch_id <> v_branch/)
    })

    it('optimistic lock (version mismatch rejected)', () => {
      expect(wp2Migration).toMatch(/v_po\.version <> p_version/)
      expect(wp2Migration).toMatch(/ERR_VERSION_MISMATCH/)
      expect(wp2Migration).toMatch(/version = version \+ 1/)
    })

    it('validation: supplier active + conversion > 0 + qty > 0', () => {
      expect(wp2Migration).toMatch(/ERR_SUPPLIER_INVALID/)
      expect(wp2Migration).toMatch(/ERR_INVALID_CONVERSION/)
      expect(wp2Migration).toMatch(/ERR_INVALID_QTY/)
    })

    it('audit trail ผ่าน append_audit_log (create/submit/approve)', () => {
      expect(wp2Migration).toMatch(/public\.append_audit_log\(/)
      expect(wp2Migration).toMatch(/'po_create'/)
      expect(wp2Migration).toMatch(/'po_submit'/)
      expect(wp2Migration).toMatch(/'po_approve'/)
    })

    it('approve เขียน last_committed_price (Owner B4 committed state)', () => {
      expect(wp2Migration).toMatch(/last_committed_price = pol\.unit_price/)
      expect(wp2Migration).toMatch(/last_committed_at = NOW\(\)/)
    })
  })

  describe('ห้ามอ้างคอลัมน์ที่ไม่มีจริง / ห้ามแก้ migration ที่ apply แล้ว', () => {
    it('ไม่สร้างตาราง PO ซ้ำ (ห้าม CREATE TABLE purchase_orders)', () => {
      expect(wp2Migration).not.toMatch(/CREATE TABLE[^;]*purchase_orders/)
    })

    it('ไม่มี package_size จาก supplier_products (DEFECT-5 regression)', () => {
      expect(wp2Migration).not.toMatch(/package_size/)
    })
  })
})