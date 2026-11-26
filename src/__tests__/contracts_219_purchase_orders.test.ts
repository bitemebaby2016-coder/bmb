// ============================================
// Bite Me Baby — Phase 2 WP1 source-contract test (Migration 219: purchase_orders + purchase_order_lines)
// ประเภท: STATIC SOURCE-CONTRACT (ตรวจเนื้อ SQL ผ่าน regex — ไม่ execute ต่อ DB)
//   Runtime proof อยู่ที่ e2e/contracts_phase2_219_223.sql (Docker replay)
// ตรวจ migration 219 มี:
//   1. purchase_orders / purchase_order_lines tables + constraints + indexes
//   2. po_number_seq (number contract) — generator function = WP2 (staged)
//   3. WP1 scope: Schema เท่านั้น — ห้ามมี CREATE FUNCTION workflow
//   4. Idempotent apply (IF NOT EXISTS / DROP TRIGGER IF EXISTS)
// ============================================

import { describe, it, expect } from 'vitest'
import mig219Src from '../../supabase/migrations/219_purchase_orders.sql?raw'

describe('Phase 2 WP1 — Migration 219: purchase_orders + purchase_order_lines (SCHEMA)', () => {
  describe('Table: purchase_orders', () => {
    it('สร้างตาราง purchase_orders แบบ IF NOT EXISTS', () => {
      expect(mig219Src).toMatch(/CREATE TABLE IF NOT EXISTS purchase_orders\s*\(/)
    })

    it('มี Primary Key id TEXT', () => {
      expect(mig219Src).toMatch(/id\s+TEXT\s+PRIMARY KEY/)
    })

    it('มี po_number UNIQUE NOT NULL', () => {
      expect(mig219Src).toMatch(/po_number\s+TEXT\s+UNIQUE\s+NOT\s+NULL/)
    })

    it('มี supplier_id FK ไป suppliers(id)', () => {
      expect(mig219Src).toMatch(/supplier_id\s+TEXT\s+NOT\s+NULL\s+REFERENCES\s+suppliers\(id\)/)
    })

    it('มี status CHECK constraint รวม 9 สถานะ', () => {
      expect(mig219Src).toMatch(/status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'draft'/)
      expect(mig219Src).toMatch(/CHECK\s*\(\s*status\s+IN\s*\(\s*'draft'\s*,\s*'submitted'\s*,\s*'approved'\s*,\s*'ordered'\s*,\s*'partially_received'\s*,\s*'completed'\s*,\s*'cancelled'\s*,\s*'rejected'\s*,\s*'closed'\s*\)\s*\)/)
    })

    it('มี timestamps และ version', () => {
      expect(mig219Src).toMatch(/created_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+NOW\(\)/)
      expect(mig219Src).toMatch(/updated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+NOW\(\)/)
      expect(mig219Src).toMatch(/version\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+1/)
    })

    it('มี revision tracking columns', () => {
      expect(mig219Src).toMatch(/parent_po_id\s+TEXT\s+REFERENCES\s+purchase_orders\(id\)/)
      expect(mig219Src).toMatch(/revision_reason\s+TEXT/)
      expect(mig219Src).toMatch(/revision_number\s+INTEGER\s+DEFAULT\s+1/)
    })

    it('มี tenant_id และ branch_id FK (org/branch isolation)', () => {
      expect(mig219Src).toMatch(/tenant_id\s+TEXT\s+REFERENCES\s+tenants\(id\)/)
      expect(mig219Src).toMatch(/branch_id\s+TEXT\s+REFERENCES\s+branches\(id\)/)
    })

    it('มี amount columns (subtotal, discount, shipping, tax, total)', () => {
      expect(mig219Src).toMatch(/subtotal\s+NUMERIC\(12,2\)\s+NOT\s+NULL\s+DEFAULT\s+0/)
      expect(mig219Src).toMatch(/discount_amount\s+NUMERIC\(12,2\)\s+NOT\s+NULL\s+DEFAULT\s+0/)
      expect(mig219Src).toMatch(/shipping_amount\s+NUMERIC\(12,2\)\s+NOT\s+NULL\s+DEFAULT\s+0/)
      expect(mig219Src).toMatch(/tax_amount\s+NUMERIC\(12,2\)\s+NOT\s+NULL\s+DEFAULT\s+0/)
      expect(mig219Src).toMatch(/total_amount\s+NUMERIC\(12,2\)\s+NOT\s+NULL\s+DEFAULT\s+0/)
    })
  })

  describe('Table: purchase_order_lines', () => {
    it('สร้างตาราง purchase_order_lines แบบ IF NOT EXISTS', () => {
      expect(mig219Src).toMatch(/CREATE TABLE IF NOT EXISTS purchase_order_lines\s*\(/)
    })

    it('มี po_id FK ไป purchase_orders(id) ON DELETE CASCADE', () => {
      expect(mig219Src).toMatch(/po_id\s+TEXT\s+NOT\s+NULL\s+REFERENCES\s+purchase_orders\(id\)\s+ON\s+DELETE\s+CASCADE/)
    })

    it('มี supplier_product_id FK และ ingredient_id FK', () => {
      expect(mig219Src).toMatch(/supplier_product_id\s+TEXT\s+NOT\s+NULL\s+REFERENCES\s+supplier_products\(id\)/)
      expect(mig219Src).toMatch(/ingredient_id\s+TEXT\s+NOT\s+NULL\s+REFERENCES\s+inventory\(id\)/)
    })

    it('มี CHECK: ordered_qty > 0 และ received_qty >= 0', () => {
      expect(mig219Src).toMatch(/ordered_qty\s+NUMERIC\(10,4\)\s+NOT\s+NULL\s+CHECK\s*\(\s*ordered_qty\s*>\s*0\s*\)/)
      expect(mig219Src).toMatch(/received_qty\s+NUMERIC\(10,4\)\s+NOT\s+NULL\s+DEFAULT\s+0/)
      expect(mig219Src).toMatch(/CHECK\s*\(\s*received_qty\s*>=\s*0\s*\)/)
    })

    it('มี conversion_factor > 0 และ unit_price >= 0', () => {
      expect(mig219Src).toMatch(/conversion_factor\s+NUMERIC\(10,4\)\s+NOT\s+NULL\s+DEFAULT\s+1\s+CHECK\s*\(\s*conversion_factor\s*>\s*0\s*\)/)
      expect(mig219Src).toMatch(/unit_price\s+NUMERIC\(12,4\)\s+NOT\s+NULL\s+CHECK\s*\(\s*unit_price\s*>=\s*0\s*\)/)
    })

    it('มี unit columns และ discount/total', () => {
      expect(mig219Src).toMatch(/purchase_unit\s+TEXT\s+NOT\s+NULL/)
      expect(mig219Src).toMatch(/use_unit\s+TEXT\s+NOT\s+NULL/)
      expect(mig219Src).toMatch(/line_discount\s+NUMERIC\(12,2\)\s+NOT\s+NULL\s+DEFAULT\s+0/)
      expect(mig219Src).toMatch(/line_total\s+NUMERIC\(12,2\)\s+NOT\s+NULL\s+DEFAULT\s+0/)
    })
  })

  describe('Document number contract', () => {
    it('สร้าง sequence po_number_seq (schema object — generator = WP2 staged)', () => {
      expect(mig219Src).toMatch(/CREATE SEQUENCE IF NOT EXISTS po_number_seq/)
      expect(mig219Src).toMatch(/WP2/)
    })

    it('COMMENT ระบุ format PO-YYYYMMDD-{seq:04d}', () => {
      expect(mig219Src).toMatch(/PO-YYYYMMDD-\{seq:04d\}/)
    })
  })

  describe('Indexes', () => {
    it('ครบ 8 indexes', () => {
      expect(mig219Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_pol_po ON purchase_order_lines\(po_id\)/)
      expect(mig219Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_pol_ingredient ON purchase_order_lines\(ingredient_id\)/)
      expect(mig219Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_pol_supplier_product ON purchase_order_lines\(supplier_product_id\)/)
      expect(mig219Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders\(status\)/)
      expect(mig219Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders\(supplier_id\)/)
      expect(mig219Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders\(po_number\)/)
      expect(mig219Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_po_tenant_branch ON purchase_orders\(tenant_id,\s*branch_id\)/)
      expect(mig219Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_po_parent ON purchase_orders\(parent_po_id\)/)
    })
  })

  describe('Triggers (idempotent apply)', () => {
    it('DROP TRIGGER IF EXISTS ก่อน CREATE TRIGGER ทั้งสองตาราง', () => {
      expect(mig219Src).toMatch(/DROP TRIGGER IF EXISTS update_purchase_orders_updated_at ON purchase_orders/)
      expect(mig219Src).toMatch(/CREATE TRIGGER update_purchase_orders_updated_at/)
      expect(mig219Src).toMatch(/DROP TRIGGER IF EXISTS update_purchase_order_lines_updated_at ON purchase_order_lines/)
      expect(mig219Src).toMatch(/CREATE TRIGGER update_purchase_order_lines_updated_at/)
      expect(mig219Src).toMatch(/FOR EACH ROW EXECUTE FUNCTION public\.update_updated_at_column\(\)/)
    })
  })

  describe('WP1 scope: Schema เท่านั้น (ไม่มี Workflow Functions)', () => {
    it('ไม่มี CREATE OR REPLACE FUNCTION (workflow RPC ย้ายไป WP2 staged)', () => {
      expect(mig219Src).not.toMatch(/CREATE OR REPLACE FUNCTION/)
    })

    it('ไม่มี GRANT EXECUTE ON FUNCTION', () => {
      expect(mig219Src).not.toMatch(/GRANT EXECUTE ON FUNCTION/)
    })

    it('อ้างอิง staged_workflows WP2', () => {
      expect(mig219Src).toMatch(/staged_workflows\/wp2_po_workflow_rpc\.sql/)
    })
  })

  describe('Additive only — ไม่มี DROP TABLE/COLUMN/POLICY', () => {
    it('ไม่มี DROP TABLE / DROP COLUMN / DROP POLICY', () => {
      expect(mig219Src).not.toContain('DROP TABLE')
      expect(mig219Src).not.toContain('DROP COLUMN')
      expect(mig219Src).not.toContain('DROP POLICY')
      const alterDrops = (mig219Src.match(/ALTER TABLE.*DROP COLUMN/gi) || []).length
      expect(alterDrops).toBe(0)
    })
  })

  describe('Grants', () => {
    it('GRANT CRUD ให้ authenticated (จำกัดจริงด้วย RLS 223)', () => {
      expect(mig219Src).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_orders TO authenticated/)
      expect(mig219Src).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_order_lines TO authenticated/)
    })
  })
})
