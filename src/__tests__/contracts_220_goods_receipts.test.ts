// ============================================
// Bite Me Baby — Phase 2 WP1 source-contract test (Migration 220: goods_receipts Header+Lines)
// ประเภท: STATIC SOURCE-CONTRACT (ตรวจเนื้อ SQL ผ่าน regex — ไม่ execute ต่อ DB)
//   Runtime proof อยู่ที่ e2e/contracts_phase2_219_223.sql (Docker replay)
// Remediation ครอบคลุม (Owner 2026-11-26):
//   DEFECT-1: ไม่มี price_variance generated column (variance = read layer WP7)
//   DEFECT-2: reversal = positive-qty mirror + reversal_of linkage + unique once
//   DEFECT-3: idempotency_key + payload_hash + unique index
//   WP scope: Schema เท่านั้น — GRN workflow = WP4, posting/reversal = WP6
// ============================================

import { describe, it, expect } from 'vitest'
import mig220Raw from '../../supabase/migrations/220_goods_receipts.sql?raw'

// Strip SQL line comments ก่อนเช็ค DDL — comment อธิบายการลบ defect จะมีชื่อ
// คอลัมน์/คำที่แก้ไขอยู่ จึงต้องแยก "เนื้อคำสั่งจริง" ออกจาก "ข้อความอธิบาย"
const mig220Src = mig220Raw.replace(/--[^\n]*/g, '')

describe('Phase 2 WP1 — Migration 220: goods_receipts + goods_receipt_lines (SCHEMA)', () => {
  describe('Table: goods_receipts (Header)', () => {
    it('สร้างตาราง goods_receipts แบบ IF NOT EXISTS', () => {
      expect(mig220Src).toMatch(/CREATE TABLE IF NOT EXISTS goods_receipts\s*\(/)
    })

    it('มี grn_number UNIQUE NOT NULL และ po_id FK', () => {
      expect(mig220Src).toMatch(/grn_number\s+TEXT\s+UNIQUE\s+NOT\s+NULL/)
      expect(mig220Src).toMatch(/po_id\s+TEXT\s+NOT\s+NULL\s+REFERENCES\s+purchase_orders\(id\)/)
    })

    it('มี status CHECK รวม 7 สถานะ (รวม reversed)', () => {
      expect(mig220Src).toMatch(/CHECK\s*\(\s*status\s+IN\s*\(\s*'draft'\s*,\s*'submitted'\s*,\s*'approved'\s*,\s*'posted'\s*,\s*'rejected'\s*,\s*'cancelled'\s*,\s*'reversed'\s*\)\s*\)/)
    })

    it('มี approval workflow columns', () => {
      expect(mig220Src).toMatch(/received_by\s+UUID\s+REFERENCES\s+auth\.users\(id\)/)
      expect(mig220Src).toMatch(/approved_by\s+UUID\s+REFERENCES\s+auth\.users\(id\)/)
      expect(mig220Src).toMatch(/posted_by\s+UUID\s+REFERENCES\s+auth\.users\(id\)/)
      expect(mig220Src).toMatch(/posted_at\s+TIMESTAMPTZ/)
    })

    it('มี reversal_of self-FK + CHECK ห้ามชี้ตัวเอง', () => {
      expect(mig220Src).toMatch(/reversal_of\s+TEXT\s+REFERENCES\s+goods_receipts\(id\)/)
      expect(mig220Src).toMatch(/CONSTRAINT\s+grn_reversal_linkage\s+CHECK\s*\(\s*reversal_of\s+IS\s+NULL\s+OR\s+reversal_of\s*<>\s*id\s*\)/)
    })

    it('DEFECT-3: มี idempotency_key + idempotency_payload_hash', () => {
      expect(mig220Src).toMatch(/idempotency_key\s+TEXT/)
      expect(mig220Src).toMatch(/idempotency_payload_hash\s+TEXT/)
    })

    it('DEFECT-2: reversal row ห้ามมี idempotency_key (CHECK)', () => {
      expect(mig220Src).toMatch(/CONSTRAINT\s+grn_reversal_no_idem\s+CHECK\s*\(\s*reversal_of\s+IS\s+NULL\s+OR\s+idempotency_key\s+IS\s+NULL\s*\)/)
    })

    it('มี tenant_id และ branch_id FK (org/branch isolation)', () => {
      expect(mig220Src).toMatch(/tenant_id\s+TEXT\s+REFERENCES\s+tenants\(id\)/)
      expect(mig220Src).toMatch(/branch_id\s+TEXT\s+REFERENCES\s+branches\(id\)/)
    })
  })

  describe('Table: goods_receipt_lines', () => {
    it('สร้างตาราง goods_receipt_lines แบบ IF NOT EXISTS + FK chain', () => {
      expect(mig220Src).toMatch(/CREATE TABLE IF NOT EXISTS goods_receipt_lines\s*\(/)
      expect(mig220Src).toMatch(/grn_id\s+TEXT\s+NOT\s+NULL\s+REFERENCES\s+goods_receipts\(id\)\s+ON\s+DELETE\s+CASCADE/)
      expect(mig220Src).toMatch(/po_line_id\s+TEXT\s+NOT\s+NULL\s+REFERENCES\s+purchase_order_lines\(id\)/)
      expect(mig220Src).toMatch(/supplier_product_id\s+TEXT\s+NOT\s+NULL\s+REFERENCES\s+supplier_products\(id\)/)
      expect(mig220Src).toMatch(/ingredient_id\s+TEXT\s+NOT\s+NULL\s+REFERENCES\s+inventory\(id\)/)
    })

    it('DEFECT-2: quantities/price เป็นบวกเท่านั้น (received>0, accepted/rejected>=0, price>=0)', () => {
      expect(mig220Src).toMatch(/received_qty\s+NUMERIC\(10,4\)\s+NOT\s+NULL\s+CHECK\s*\(\s*received_qty\s*>\s*0\s*\)/)
      expect(mig220Src).toMatch(/CHECK\s*\(\s*accepted_qty\s*>=\s*0\s*\)/)
      expect(mig220Src).toMatch(/CHECK\s*\(\s*rejected_qty\s*>=\s*0\s*\)/)
      expect(mig220Src).toMatch(/actual_unit_price\s+NUMERIC\(12,4\)\s+NOT\s+NULL\s+CHECK\s*\(\s*actual_unit_price\s*>=\s*0\s*\)/)
    })

    it('มี CHECK accepted + rejected = received (รับบางส่วน/ปฏิเสธ/ของเสียหาย)', () => {
      expect(mig220Src).toMatch(/CONSTRAINT\s+grl_acceptance_balance\s+CHECK\s*\(\s*accepted_qty\s*\+\s*rejected_qty\s*=\s*received_qty\s*\)/)
    })

    it('มี unit/conversion + discount/shipping/tax columns', () => {
      expect(mig220Src).toMatch(/purchase_unit\s+TEXT\s+NOT\s+NULL/)
      expect(mig220Src).toMatch(/use_unit\s+TEXT\s+NOT\s+NULL/)
      expect(mig220Src).toMatch(/conversion_factor\s+NUMERIC\(10,4\)\s+NOT\s+NULL\s+DEFAULT\s+1\s+CHECK\s*\(\s*conversion_factor\s*>\s*0\s*\)/)
      expect(mig220Src).toMatch(/shipping_allocated\s+NUMERIC\(12,2\)\s+NOT\s+NULL\s+DEFAULT\s+0/)
      expect(mig220Src).toMatch(/tax_treatment\s+TEXT\s+CHECK\s*\(\s*tax_treatment\s+IN\s*\(\s*'recoverable'\s*,\s*'non_recoverable'\s*,\s*'exempt'\s*\)\s*\)/)
      expect(mig220Src).toMatch(/tax_amount\s+NUMERIC\(12,2\)\s+NOT\s+NULL\s+DEFAULT\s+0/)
    })

    it('มี lot_number + expiry_date', () => {
      expect(mig220Src).toMatch(/lot_number\s+TEXT/)
      expect(mig220Src).toMatch(/expiry_date\s+DATE/)
    })

    it('DEFECT-1: ไม่มี price_variance GENERATED column ใด ๆ', () => {
      expect(mig220Src).not.toMatch(/price_variance/)
      expect(mig220Src).not.toMatch(/GENERATED\s+ALWAYS/)
    })
  })

  describe('Unique indexes (DEFECT-2 + DEFECT-3)', () => {
    it('uq_grn_reversal_once: ต้นฉบับหนึ่งใบ reverse ได้ครั้งเดียว (partial unique)', () => {
      expect(mig220Src).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_grn_reversal_once/)
      expect(mig220Src).toMatch(/ON goods_receipts\(reversal_of\) WHERE reversal_of IS NOT NULL/)
    })

    it('uq_grn_idempotency_key: key ไม่ซ้ำระดับ DB (partial unique)', () => {
      expect(mig220Src).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_grn_idempotency_key/)
      expect(mig220Src).toMatch(/ON goods_receipts\(idempotency_key\) WHERE idempotency_key IS NOT NULL/)
    })

    it('มี index สำหรับ payload hash', () => {
      expect(mig220Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_grn_idem_hash ON goods_receipts\(idempotency_payload_hash\)/)
    })
  })

  describe('Indexes + sequence', () => {
    it('ครบ indexes หลัก', () => {
      expect(mig220Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_grl_grn ON goods_receipt_lines\(grn_id\)/)
      expect(mig220Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_grl_po_line ON goods_receipt_lines\(po_line_id\)/)
      expect(mig220Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_grn_po ON goods_receipts\(po_id\)/)
      expect(mig220Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_grn_tenant_branch ON goods_receipts\(tenant_id,\s*branch_id\)/)
      expect(mig220Src).toMatch(/CREATE INDEX IF NOT EXISTS idx_grn_reversal ON goods_receipts\(reversal_of\)/)
    })

    it('มี sequence grn_number_seq + format contract (generator = WP4 staged)', () => {
      expect(mig220Src).toMatch(/CREATE SEQUENCE IF NOT EXISTS grn_number_seq/)
      expect(mig220Src).toMatch(/GRN-YYYYMMDD-\{seq:04d\}/)
      expect(mig220Src).toMatch(/wp4_grn_workflow_rpc\.sql/)
    })
  })

  describe('Triggers (idempotent apply)', () => {
    it('DROP TRIGGER IF EXISTS ก่อน CREATE ทั้งสองตาราง', () => {
      expect(mig220Src).toMatch(/DROP TRIGGER IF EXISTS update_goods_receipts_updated_at ON goods_receipts/)
      expect(mig220Src).toMatch(/DROP TRIGGER IF EXISTS update_goods_receipt_lines_updated_at ON goods_receipt_lines/)
      expect(mig220Src).toMatch(/FOR EACH ROW EXECUTE FUNCTION public\.update_updated_at_column\(\)/)
    })
  })

  describe('WP1 scope + Additive only', () => {
    it('ไม่มี CREATE OR REPLACE FUNCTION (workflow = WP4/WP6 staged)', () => {
      expect(mig220Src).not.toMatch(/CREATE OR REPLACE FUNCTION/)
    })

    it('ไม่มี DROP TABLE / DROP COLUMN / DROP POLICY', () => {
      expect(mig220Src).not.toContain('DROP TABLE')
      expect(mig220Src).not.toContain('DROP COLUMN')
      expect(mig220Src).not.toContain('DROP POLICY')
    })

    it('อ้าง staged_workflows ของ WP4/WP6 (หัวไฟล์ — ใช้ source ดิบรวม comment)', () => {
      expect(mig220Raw).toMatch(/staged_workflows\/wp4_grn_workflow_rpc\.sql/)
      expect(mig220Raw).toMatch(/staged_workflows\/wp6_wavg_posting_reversal\.sql/)
    })
  })

  describe('Grants', () => {
    it('GRANT CRUD ให้ authenticated (จำกัดจริงด้วย RLS 223)', () => {
      expect(mig220Src).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON goods_receipts TO authenticated/)
      expect(mig220Src).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON goods_receipt_lines TO authenticated/)
    })
  })
})
