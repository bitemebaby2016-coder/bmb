// ============================================
// Bite Me Baby — Phase 2 WP1 source-contract test (Migration 222: inventory_transactions ext)
// ประเภท: STATIC SOURCE-CONTRACT (ตรวจเนื้อ SQL ผ่าน regex — ไม่ execute ต่อ DB)
//   Runtime proof อยู่ที่ e2e/contracts_phase2_219_223.sql (Docker replay)
// ตรวจ migration 222 มี: ADD COLUMN IF NOT EXISTS ครบ 5 คอลัมน์ + COMMENT
// นิยามความหมาย + FK + indexes + ไม่แตะ logic เดิม (backward compatible)
// ============================================

import { describe, it, expect } from 'vitest'
import mig222Src from '../../supabase/migrations/222_inventory_transaction_ext.sql?raw'

describe('Phase 2 WP1 — Migration 222: inventory_transactions extension (SCHEMA)', () => {
  describe('Additive columns (IF NOT EXISTS)', () => {
    it('ALTER TABLE ... ADD COLUMN IF NOT EXISTS ครบ 5 คอลัมน์ใน statement เดียว', () => {
      expect(mig222Src).toMatch(/ALTER TABLE inventory_transactions/)
      expect(mig222Src).toMatch(/ADD COLUMN IF NOT EXISTS po_id TEXT REFERENCES purchase_orders\(id\)/)
      expect(mig222Src).toMatch(/ADD COLUMN IF NOT EXISTS grn_id TEXT REFERENCES goods_receipts\(id\)/)
      expect(mig222Src).toMatch(/ADD COLUMN IF NOT EXISTS grn_line_id TEXT REFERENCES goods_receipt_lines\(id\)/)
      expect(mig222Src).toMatch(/ADD COLUMN IF NOT EXISTS unit_cost NUMERIC\(12,4\)/)
      expect(mig222Src).toMatch(/ADD COLUMN IF NOT EXISTS conversion_snapshot NUMERIC\(10,4\)/)
    })

    it('COMMENT นิยามความหมายครบทั้ง 5 คอลัมน์ (Owner B)', () => {
      expect(mig222Src).toMatch(/COMMENT ON COLUMN inventory_transactions\.po_id/)
      expect(mig222Src).toMatch(/COMMENT ON COLUMN inventory_transactions\.grn_id/)
      expect(mig222Src).toMatch(/COMMENT ON COLUMN inventory_transactions\.grn_line_id/)
      expect(mig222Src).toMatch(/COMMENT ON COLUMN inventory_transactions\.unit_cost/)
      expect(mig222Src).toMatch(/COMMENT ON COLUMN inventory_transactions\.conversion_snapshot/)
    })

    it('COMMENT ระบุ sign convention (qty บวกเสมอ — ทิศทางด้วย type)', () => {
      expect(mig222Src).toMatch(/quantity เป็นบวกเสมอ/)
    })

    it('unit_cost COMMENT ระบุสูตร GRN post และ reversal', () => {
      expect(mig222Src).toMatch(/landed_cost \/ conversion_factor/)
    })
  })

  describe('Indexes', () => {
    it('ครบ 3 indexes สำหรับ linkage columns', () => {
      expect(mig222Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_itx_po ON inventory_transactions\(po_id\)/)
      expect(mig222Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_itx_grn ON inventory_transactions\(grn_id\)/)
      expect(mig222Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_itx_grn_line ON inventory_transactions\(grn_line_id\)/)
    })
  })

  describe('Backward compatibility', () => {
    it('ไม่มี ALTER ที่ DROP COLUMN หรือแก้ NOT NULL (ไม่ทำลายข้อมูลเดิม)', () => {
      expect(mig222Src).not.toMatch(/DROP COLUMN/)
      expect(mig222Src).not.toMatch(/SET NOT NULL/)
    })

    it('ไม่มี CREATE TABLE ใหม่ (extend ตารางเดิมเท่านั้น)', () => {
      expect(mig222Src).not.toMatch(/CREATE TABLE/)
    })

    it('ไม่มี CREATE FUNCTION (posting = WP6 staged)', () => {
      expect(mig222Src).not.toMatch(/CREATE OR REPLACE FUNCTION/)
      expect(mig222Src).toMatch(/WP6/)
    })

    it('ไม่มี DROP TABLE/POLICY ใด ๆ', () => {
      expect(mig222Src).not.toContain('DROP TABLE')
      expect(mig222Src).not.toContain('DROP POLICY')
    })
  })
})
