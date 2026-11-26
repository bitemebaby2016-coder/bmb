// ============================================
// Bite Me Baby — Phase 2 WP1 source-contract test (Migration 221: purchase_price_history)
// ประเภท: STATIC SOURCE-CONTRACT (ตรวจเนื้อ SQL ผ่าน regex — ไม่ execute ต่อ DB)
//   Runtime proof อยู่ที่ e2e/contracts_phase2_219_223.sql (Docker replay)
// Remediation ครอบคลุม (Owner 2026-11-26):
//   DEFECT-5: ไม่มี package_size (supplier_products ไม่มีคอลัมน์นี้ — m217)
//   DEFECT-4: landed_cost มี COMMENT นิยามสูตร + จุดจัดเก็บชัดเจน
//   ORG/BRANCH: เพิ่ม tenant_id + branch_id ให้ RLS ตรวจได้ (pattern 214)
// ============================================

import { describe, it, expect } from 'vitest'
import mig221Raw from '../../supabase/migrations/221_purchase_price_history.sql?raw'

// Strip SQL line comments ก่อนเช็ค DDL — comment อธิบายการลบ defect จะมีชื่อ
// คอลัมน์/คำที่แก้ไขอยู่ จึงต้องแยก "เนื้อคำสั่งจริง" ออกจาก "ข้อความอธิบาย"
const mig221Src = mig221Raw.replace(/--[^\n]*/g, '')

describe('Phase 2 WP1 — Migration 221: purchase_price_history (SCHEMA, append-only)', () => {
  describe('Table: purchase_price_history', () => {
    it('สร้างตารางแบบ IF NOT EXISTS + BIGSERIAL PK', () => {
      expect(mig221Src).toMatch(/CREATE TABLE IF NOT EXISTS purchase_price_history\s*\(/)
      expect(mig221Src).toMatch(/id\s+BIGSERIAL\s+PRIMARY KEY/)
    })

    it('มี FK ครบทั้ง 7 reference columns', () => {
      expect(mig221Src).toMatch(/supplier_id\s+TEXT\s+NOT\s+NULL\s+REFERENCES\s+suppliers\(id\)/)
      expect(mig221Src).toMatch(/supplier_product_id\s+TEXT\s+NOT\s+NULL\s+REFERENCES\s+supplier_products\(id\)/)
      expect(mig221Src).toMatch(/ingredient_id\s+TEXT\s+NOT\s+NULL\s+REFERENCES\s+inventory\(id\)/)
      expect(mig221Src).toMatch(/po_id\s+TEXT\s+REFERENCES\s+purchase_orders\(id\)/)
      expect(mig221Src).toMatch(/po_line_id\s+TEXT\s+REFERENCES\s+purchase_order_lines\(id\)/)
      expect(mig221Src).toMatch(/grn_id\s+TEXT\s+REFERENCES\s+goods_receipts\(id\)/)
      expect(mig221Src).toMatch(/grn_line_id\s+TEXT\s+REFERENCES\s+goods_receipt_lines\(id\)/)
    })

    it('price_type CHECK รวม 6 ประเภท (รวม correction)', () => {
      expect(mig221Src).toMatch(/CHECK\s*\(\s*price_type\s+IN\s*\(\s*'quoted'\s*,\s*'committed'\s*,\s*'realized'\s*,\s*'landed'\s*,\s*'approved'\s*,\s*'correction'\s*\)\s*\)/)
    })

    it('DEFECT-5: ไม่มี package_size ในตาราง (ใช้ units + conversion ที่มีอยู่)', () => {
      expect(mig221Src).not.toMatch(/package_size/)
    })

    it('มี price_per_use_unit GENERATED (unit_price / conversion_factor) — ข้อยกเว้นเดียวที่อนุญาต', () => {
      expect(mig221Src).toMatch(/price_per_use_unit\s+NUMERIC\(12,4\)\s+GENERATED\s+ALWAYS\s+AS\s*\(\s*unit_price\s*\/\s*conversion_factor\s*\)\s+STORED/)
    })

    it('DEFECT-4: landed_cost มี COMMENT นิยามสูตร + จุดจัดเก็บ (ต่อ line ต่อหน่วยซื้อ)', () => {
      expect(mig221Src).toMatch(/COMMENT ON COLUMN purchase_price_history\.landed_cost/)
      expect(mig221Src).toMatch(/PER GRN LINE PER PURCHASE UNIT/)
      expect(mig221Src).toMatch(/received_qty\s*[×x]\s*actual_unit_price/)
      expect(mig221Src).toMatch(/inventory_transactions\.unit_cost/)
    })

    it('ORG/BRANCH isolation: มี tenant_id + branch_id + COMMENT (copy จาก PO/GRN โดย WP6)', () => {
      expect(mig221Src).toMatch(/tenant_id\s+TEXT\s+REFERENCES\s+tenants\(id\)/)
      expect(mig221Src).toMatch(/branch_id\s+TEXT\s+REFERENCES\s+branches\(id\)/)
      expect(mig221Src).toMatch(/COMMENT ON COLUMN purchase_price_history\.tenant_id/)
      expect(mig221Src).toMatch(/COMMENT ON COLUMN purchase_price_history\.branch_id/)
    })

    it('มี approval workflow columns + created_at', () => {
      expect(mig221Src).toMatch(/effective_date\s+DATE\s+NOT\s+NULL\s+DEFAULT\s+CURRENT_DATE/)
      expect(mig221Src).toMatch(/approval_status\s+TEXT\s+CHECK\s*\(\s*approval_status\s+IN\s*\(\s*'pending'\s*,\s*'approved'\s*,\s*'rejected'\s*\)\s*\)/)
      expect(mig221Src).toMatch(/source_user\s+UUID\s+REFERENCES\s+auth\.users\(id\)/)
      expect(mig221Src).toMatch(/source_document\s+TEXT/)
      expect(mig221Src).toMatch(/created_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+NOW\(\)/)
    })
  })

  describe('Indexes', () => {
    it('ครบ 8 indexes รวม tenant/branch', () => {
      expect(mig221Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_pph_supplier ON purchase_price_history\(supplier_id,\s*effective_date\s+DESC\)/)
      expect(mig221Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_pph_ingredient ON purchase_price_history\(ingredient_id,\s*effective_date\s+DESC\)/)
      expect(mig221Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_pph_grn ON purchase_price_history\(grn_id\)/)
      expect(mig221Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_pph_grn_line ON purchase_price_history\(grn_line_id\)/)
      expect(mig221Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_pph_type ON purchase_price_history\(price_type,\s*effective_date\s+DESC\)/)
      expect(mig221Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_pph_po ON purchase_price_history\(po_id\)/)
      expect(mig221Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_pph_po_line ON purchase_price_history\(po_line_id\)/)
      expect(mig221Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_pph_tenant_branch ON purchase_price_history\(tenant_id,\s*branch_id\)/)
    })
  })

  describe('Append-only enforcement', () => {
    it('function บล็อก UPDATE + DELETE ด้วย RAISE EXCEPTION', () => {
      expect(mig221Src).toMatch(/CREATE OR REPLACE FUNCTION enforce_purchase_price_history_append_only\(\)/)
      expect(mig221Src).toMatch(/IF\s+TG_OP\s*=\s*'UPDATE'[\s\S]*?RAISE EXCEPTION 'purchase_price_history is append-only: UPDATE not allowed'/)
      expect(mig221Src).toMatch(/IF\s+TG_OP\s*=\s*'DELETE'[\s\S]*?RAISE EXCEPTION 'purchase_price_history is append-only: DELETE not allowed'/)
    })

    it('trigger BEFORE UPDATE OR DELETE + idempotent apply', () => {
      expect(mig221Src).toMatch(/DROP TRIGGER IF EXISTS trg_purchase_price_history_append_only ON purchase_price_history/)
      expect(mig221Src).toMatch(/CREATE TRIGGER trg_purchase_price_history_append_only/)
      expect(mig221Src).toMatch(/BEFORE UPDATE OR DELETE ON purchase_price_history/)
    })

    it('function เป็น SECURITY DEFINER + SET search_path = public', () => {
      expect(mig221Src).toMatch(/SECURITY DEFINER/)
      expect(mig221Src).toMatch(/SET search_path = public/)
    })
  })

  describe('Grants (append-only — SELECT, INSERT เท่านั้น)', () => {
    it('ไม่มี GRANT UPDATE/DELETE ใด ๆ', () => {
      expect(mig221Src).toMatch(/GRANT SELECT, INSERT ON purchase_price_history TO authenticated/)
      const grantLines = mig221Src.match(/GRANT.*ON purchase_price_history TO authenticated/g) || []
      expect(grantLines.length).toBe(1)
      expect(grantLines[0]).not.toMatch(/UPDATE/)
      expect(grantLines[0]).not.toMatch(/DELETE/)
    })
  })

  describe('WP1 scope + Additive only', () => {
    it('ไม่มี workflow RPC (read API = WP7 staged — ใช้ source ดิบรวม comment)', () => {
      expect(mig221Raw).not.toMatch(/CREATE OR REPLACE FUNCTION get_purchase_price_history/)
      expect(mig221Raw).toMatch(/wp7_price_history_read_api\.sql/)
    })

    it('ไม่มี DROP TABLE / DROP COLUMN', () => {
      expect(mig221Src).not.toContain('DROP TABLE')
      expect(mig221Src).not.toContain('DROP COLUMN')
    })
  })
})
