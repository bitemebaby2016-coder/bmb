// ============================================
// Bite Me Baby — Phase 2 WP1 source-contract test (Migration 223: RLS org/branch isolation)
// ประเภท: STATIC SOURCE-CONTRACT (ตรวจเนื้อ SQL ผ่าน regex — ไม่ execute ต่อ DB)
//   Runtime proof (ผู้ใช้/role จริง + cross-branch) อยู่ที่
//   e2e/contracts_phase2_219_223.sql (Docker replay) — T223 ครบ 11 เคส
// ครอบคลุม (Owner C 2026-11-26):
//   - ห้าม Role Check เพียงอย่างเดียว — ทุก policy ต้องผ่าน has_org_row_scope
//   - รูปแบบตาม Phase 1: m065/071 (tenant + is_platform), m088/090 (branch),
//     m146 (role predicates)
//   - 17 policies (PO 5 + POL 4 + GRN 3 + GRL 3 + PPH 2)
// ============================================

import { describe, it, expect } from 'vitest'
import mig223Src from '../../supabase/migrations/223_po_grn_rls.sql?raw'

describe('Phase 2 WP1 — Migration 223: RLS Organization + Branch Isolation', () => {
  describe('Helper: has_org_row_scope (รูปแบบ Phase 1)', () => {
    it('สร้าง function แบบ SECURITY DEFINER + STABLE + search_path = public', () => {
      expect(mig223Src).toMatch(/CREATE OR REPLACE FUNCTION public\.has_org_row_scope\(/)
      expect(mig223Src).toMatch(/STABLE/)
      expect(mig223Src).toMatch(/SECURITY DEFINER/)
      expect(mig223Src).toMatch(/SET search_path = public/)
    })

    it('รับ (p_tenant_id, p_branch_id) — ครบทั้ง 2 ชั้น isolation', () => {
      expect(mig223Src).toMatch(/p_tenant_id TEXT,\s*p_branch_id TEXT/)
    })

    it('ชั้น 1: auth.uid() ว่าง → FALSE', () => {
      expect(mig223Src).toMatch(/IF v_uid IS NULL THEN RETURN FALSE/)
    })

    it('ชั้น 2: is_platform bypass (m071/m088 pattern)', () => {
      expect(mig223Src).toMatch(/IF v_is_platform THEN RETURN TRUE/)
      expect(mig223Src).toMatch(/COALESCE\(is_platform, FALSE\)/)
    })

    it('ชั้น 3: tenant mismatch → FALSE (COALESCE default tenant-bmb-001 ตาม m065/071)', () => {
      expect(mig223Src).toMatch(/COALESCE\(tenant_id, 'tenant-bmb-001'\)/)
      expect(mig223Src).toMatch(/IF v_user_tenant <> COALESCE\(p_tenant_id, 'tenant-bmb-001'\) THEN RETURN FALSE/)
    })

    it('ชั้น 4: admin/owner ข้าม branch ภายใน tenant (m088 model — ไม่ถูก scope ด้วย branch ตัวเอง)', () => {
      expect(mig223Src).toMatch(/role IN \('admin', 'owner'\)/)
      expect(mig223Src).toMatch(/IF v_is_tenant_admin THEN RETURN TRUE/)
    })

    it('ชั้น 5: staff ไม่มี assignment = ระดับ tenant · row tenant-wide เห็นได้ · staff มี branch เห็นเฉพาะตัวเอง', () => {
      expect(mig223Src).toMatch(/IF v_user_branch IS NULL THEN RETURN TRUE/)
      expect(mig223Src).toMatch(/IF p_branch_id IS NULL THEN RETURN TRUE/)
      expect(mig223Src).toMatch(/RETURN v_user_branch = p_branch_id/)
    })

    it('REVOKE จาก anon/PUBLIC + GRANT เฉพาะ authenticated', () => {
      expect(mig223Src).toMatch(/REVOKE EXECUTE ON FUNCTION public\.has_org_row_scope\(TEXT, TEXT\) FROM PUBLIC, anon/)
      expect(mig223Src).toMatch(/GRANT EXECUTE ON FUNCTION public\.has_org_row_scope\(TEXT, TEXT\) TO authenticated/)
    })
  })

  describe('ENABLE RLS ครบ 5 ตาราง', () => {
    it('แต่ละตาราง ENABLE ROW LEVEL SECURITY', () => {
      expect(mig223Src).toMatch(/ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY/)
      expect(mig223Src).toMatch(/ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY/)
      expect(mig223Src).toMatch(/ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY/)
      expect(mig223Src).toMatch(/ALTER TABLE goods_receipt_lines ENABLE ROW LEVEL SECURITY/)
      expect(mig223Src).toMatch(/ALTER TABLE purchase_price_history ENABLE ROW LEVEL SECURITY/)
    })

    it('ไม่มี DISABLE ROW LEVEL SECURITY ใด ๆ', () => {
      expect(mig223Src).not.toMatch(/DISABLE ROW LEVEL SECURITY/)
    })
  })

  describe('purchase_orders policies (5)', () => {
    it('ครบ 5 policies: admin / creator_rw / finance_rw / inventory_rw / receiver_r', () => {
      expect(mig223Src).toMatch(/DROP POLICY IF EXISTS po_admin ON purchase_orders/)
      expect(mig223Src).toMatch(/DROP POLICY IF EXISTS po_creator_rw ON purchase_orders/)
      expect(mig223Src).toMatch(/DROP POLICY IF EXISTS po_finance_rw ON purchase_orders/)
      expect(mig223Src).toMatch(/DROP POLICY IF EXISTS po_inventory_rw ON purchase_orders/)
      expect(mig223Src).toMatch(/DROP POLICY IF EXISTS po_receiver_r ON purchase_orders/)
    })

    it('ทุก policy มี role predicate + has_org_row_scope (ห้าม role check เดี่ยว)', () => {
      const policyBodies = mig223Src.match(/CREATE POLICY po_\w+ ON purchase_orders[\s\S]*?(?=\n\n-- |\n\nDROP POLICY|\n\n-- =)/g) || []
      expect(policyBodies.length).toBe(5)
      for (const body of policyBodies) {
        expect(body).toMatch(/public\.has_org_row_scope\(/)
        expect(
          /public\.is_admin\(\)|public\.is_finance\(\)|public\.is_inventory\(\)|requested_by = auth\.uid\(\)/.test(body)
        ).toBe(true)
      }
    })

    it('WITH CHECK มีเสมอใน policies ที่เขียนได้', () => {
      expect(mig223Src).toMatch(/po_admin ON purchase_orders[\s\S]*?WITH CHECK/)
      expect(mig223Src).toMatch(/po_creator_rw ON purchase_orders[\s\S]*?WITH CHECK/)
    })
  })

  describe('purchase_order_lines policies (4) — scope ผ่าน parent PO', () => {
    it('ครบ 4 policies', () => {
      expect(mig223Src).toMatch(/DROP POLICY IF EXISTS pol_admin ON purchase_order_lines/)
      expect(mig223Src).toMatch(/DROP POLICY IF EXISTS pol_creator_rw ON purchase_order_lines/)
      expect(mig223Src).toMatch(/DROP POLICY IF EXISTS pol_finance_rw ON purchase_order_lines/)
      expect(mig223Src).toMatch(/DROP POLICY IF EXISTS pol_inventory_rw ON purchase_order_lines/)
    })

    it('ทุก policy ใช้ EXISTS parent scope (has_org_row_scope ของ po)', () => {
      const policyBodies = mig223Src.match(/CREATE POLICY pol_\w+ ON purchase_order_lines[\s\S]*?(?=\n\n-- |\n\nDROP POLICY|\n\n-- =)/g) || []
      expect(policyBodies.length).toBe(4)
      for (const body of policyBodies) {
        expect(body).toMatch(/FROM purchase_orders po/)
        expect(body).toMatch(/public\.has_org_row_scope\(po\.tenant_id, po\.branch_id\)/)
      }
    })
  })

  describe('goods_receipts policies (3)', () => {
    it('ครบ 3 policies: admin / creator_rw / inventory_rw', () => {
      expect(mig223Src).toMatch(/DROP POLICY IF EXISTS grn_admin ON goods_receipts/)
      expect(mig223Src).toMatch(/DROP POLICY IF EXISTS grn_creator_rw ON goods_receipts/)
      expect(mig223Src).toMatch(/DROP POLICY IF EXISTS grn_inventory_rw ON goods_receipts/)
    })

    it('ทุก policy ผ่าน has_org_row_scope', () => {
      const policyBodies = mig223Src.match(/CREATE POLICY grn_\w+ ON goods_receipts[\s\S]*?(?=\n\n-- |\n\nDROP POLICY|\n\n-- =)/g) || []
      expect(policyBodies.length).toBe(3)
      for (const body of policyBodies) {
        expect(body).toMatch(/public\.has_org_row_scope\(tenant_id, branch_id\)/)
      }
    })
  })

  describe('goods_receipt_lines policies (3) — scope ผ่าน parent GRN', () => {
    it('ครบ 3 policies', () => {
      expect(mig223Src).toMatch(/DROP POLICY IF EXISTS grl_admin ON goods_receipt_lines/)
      expect(mig223Src).toMatch(/DROP POLICY IF EXISTS grl_inventory_rw ON goods_receipt_lines/)
      expect(mig223Src).toMatch(/DROP POLICY IF EXISTS grl_receiver_r ON goods_receipt_lines/)
    })

    it('ทุก policy ใช้ EXISTS parent scope', () => {
      const policyBodies = mig223Src.match(/CREATE POLICY grl_\w+ ON goods_receipt_lines[\s\S]*?(?=\n\n-- |\n\nDROP POLICY|\n\n-- =)/g) || []
      expect(policyBodies.length).toBe(3)
      for (const body of policyBodies) {
        expect(body).toMatch(/FROM goods_receipts gr/)
        expect(body).toMatch(/public\.has_org_row_scope\(gr\.tenant_id, gr\.branch_id\)/)
      }
    })
  })

  describe('purchase_price_history policies (2)', () => {
    it('ครบ 2 policies: admin + staff_read (4 roles)', () => {
      expect(mig223Src).toMatch(/DROP POLICY IF EXISTS pph_admin ON purchase_price_history/)
      expect(mig223Src).toMatch(/DROP POLICY IF EXISTS pph_staff_read ON purchase_price_history/)
      expect(mig223Src).toMatch(/public\.is_inventory\(\) OR public\.is_finance\(\)\s*\n?\s*OR public\.is_kitchen\(\) OR public\.is_pos\(\)/)
    })

    it('staff_read ผ่าน row-level tenant/branch scope (ไม่ใช้ join)', () => {
      expect(mig223Src).toMatch(/pph_staff_read ON purchase_price_history[\s\S]*?public\.has_org_row_scope\(tenant_id, branch_id\)/)
    })
  })

  describe('Role predicates (m146) + SECURITY DEFINER note (Owner C)', () => {
    it('ใช้ predicates จาก m146 เท่านั้น', () => {
      expect(mig223Src).toMatch(/public\.is_admin\(\)/)
      expect(mig223Src).toMatch(/public\.is_finance\(\)/)
      expect(mig223Src).toMatch(/public\.is_inventory\(\)/)
      expect(mig223Src).toMatch(/public\.is_kitchen\(\)/)
      expect(mig223Src).toMatch(/public\.is_pos\(\)/)
    })

    it('มีข้อความกำกับ: SECURITY DEFINER RPC ต้องตรวจ scope ในตัวเอง (WP staged)', () => {
      expect(mig223Src).toMatch(/SECURITY DEFINER[\s\S]*?has_org_row_scope[\s\S]*?RLS ไม่ถูกบังคับ/)
    })
  })

  describe('Idempotent apply + ไม่แตะตารางอื่น', () => {
    it('ทุก policy มี DROP POLICY IF EXISTS ก่อน CREATE', () => {
      const creates = mig223Src.match(/CREATE POLICY \w+ ON \w+/g) || []
      expect(creates.length).toBe(17)
      const drops = mig223Src.match(/DROP POLICY IF EXISTS \w+ ON \w+/g) || []
      expect(drops.length).toBe(17)
    })

    it('ไม่แตะตารางเดิม (orders/inventory/suppliers ฯลฯ)', () => {
      expect(mig223Src).not.toMatch(/ON (public\.)?(orders|inventory|suppliers|supplier_products)\b/)
    })
  })
})
