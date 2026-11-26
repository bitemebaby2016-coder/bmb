// ============================================
// Bite Me Baby — Phase 2 WP1 source-contract test (STAGED WORKFLOW REFERENCE)
// ประเภท: STATIC SOURCE-CONTRACT ของ "design reference" —
//   ไฟล์ใน supabase/staged_workflows/ ไม่ใช่ migration (ห้าม apply ใน WP1)
//   แต่ต้องสอดคล้องกับ schema contract ของ WP1 (m219-223)
// ยืนยันตามคำสั่ง Owner 2026-11-26 §D:
//   WP2=PO workflow · WP4=GRN workflow · WP6=WAVG posting+reversal
//   WP7=price history read · WP8=PO dashboard read
// และ remediation DEFECT-2/3/4/5 ใน staged SQL ที่แก้แล้ว
// ============================================

import { describe, it, expect } from 'vitest'
import wp2Src from '../../supabase/staged_workflows/wp2_po_workflow_rpc.sql?raw'
import wp4Src from '../../supabase/staged_workflows/wp4_grn_workflow_rpc.sql?raw'
import wp6Src from '../../supabase/staged_workflows/wp6_wavg_posting_reversal.sql?raw'
import wp7Src from '../../supabase/staged_workflows/wp7_price_history_read_api.sql?raw'
import wp8Src from '../../supabase/staged_workflows/wp8_po_dashboard_read_api.sql?raw'

const stagedAll = [wp2Src, wp4Src, wp6Src, wp7Src, wp8Src]

describe('Phase 2 — Staged Workflow SQL (WP2/WP4/WP6/WP7/WP8 — design reference)', () => {
  describe('ข้อกำหนดกลาง (Owner C/D)', () => {
    it('ทุกไฟล์ระบุว่า "ห้าม apply ใน WP1"', () => {
      for (const src of stagedAll) {
        expect(src).toMatch(/ห้าม apply ใน WP1/)
      }
    })

    it('ทุกไฟล์ระบุ WP เจ้าของ', () => {
      expect(wp2Src).toMatch(/WP2/)
      expect(wp4Src).toMatch(/WP4/)
      expect(wp6Src).toMatch(/WP6/)
      expect(wp7Src).toMatch(/WP7/)
      expect(wp8Src).toMatch(/WP8/)
    })

    it('DEFECT-5: ไม่มีไฟล์ใดอ้าง supplier_products.package_size', () => {
      for (const src of stagedAll) {
        expect(src).not.toMatch(/supplier_products\s[\s\S]*package_size|package_size FROM supplier_products/)
        expect(src).not.toMatch(/SELECT package_size/)
      }
    })

    it('SECURITY DEFINER functions ตรวจ role + has_org_row_scope ในตัวเอง', () => {
      expect(wp2Src).toMatch(/has_org_row_scope/)
      expect(wp4Src).toMatch(/has_org_row_scope/)
      expect(wp6Src).toMatch(/has_org_row_scope/)
    })
  })

  describe('WP2 — PO Workflow RPC', () => {
    it('มี 4 functions: generate_po_number + create/update/submit/approve', () => {
      expect(wp2Src).toMatch(/CREATE OR REPLACE FUNCTION generate_po_number\(\)/)
      expect(wp2Src).toMatch(/CREATE OR REPLACE FUNCTION create_purchase_order\(/)
      expect(wp2Src).toMatch(/CREATE OR REPLACE FUNCTION update_purchase_order\(/)
      expect(wp2Src).toMatch(/CREATE OR REPLACE FUNCTION submit_purchase_order\(p_po_id TEXT\)/)
      expect(wp2Src).toMatch(/CREATE OR REPLACE FUNCTION approve_purchase_order\(p_po_id TEXT\)/)
    })

    it('ใช้ sequence po_number_seq ของ m219 + format ตรง contract', () => {
      expect(wp2Src).toMatch(/nextval\('po_number_seq'\)/)
      expect(wp2Src).toMatch(/'PO-' \|\| to_char\(CURRENT_DATE, 'YYYYMMDD'\)/)
    })

    it('approve = finance/admin เท่านั้น + status gate', () => {
      expect(wp2Src).toMatch(/is_finance\(\) AND NOT public\.is_admin\(\)/)
      expect(wp2Src).toMatch(/v_po\.status != 'submitted'/)
    })

    it('create บังคับ branch ของ caller (staff ที่ถูก assign ห้ามสร้างต่าง branch)', () => {
      expect(wp2Src).toMatch(/ERR_FORBIDDEN_BRANCH/)
      expect(wp2Src).toMatch(/v_branch IS NOT NULL AND p_branch_id IS NOT NULL AND p_branch_id <> v_branch/)
    })

    it('optimistic lock (version)', () => {
      expect(wp2Src).toMatch(/v_po\.version != p_version/)
      expect(wp2Src).toMatch(/version = version \+ 1/)
    })
  })

  describe('WP4 — GRN Workflow RPC', () => {
    it('มี 3 functions: generate_grn_number + create_grn_draft + approve_grn', () => {
      expect(wp4Src).toMatch(/CREATE OR REPLACE FUNCTION generate_grn_number\(\)/)
      expect(wp4Src).toMatch(/CREATE OR REPLACE FUNCTION create_grn_draft\(/)
      expect(wp4Src).toMatch(/CREATE OR REPLACE FUNCTION approve_grn\(p_grn_id TEXT\)/)
    })

    it('ใช้ sequence grn_number_seq ของ m220 + format ตรง contract', () => {
      expect(wp4Src).toMatch(/nextval\('grn_number_seq'\)/)
      expect(wp4Src).toMatch(/'GRN-' \|\| to_char\(CURRENT_DATE, 'YYYYMMDD'\)/)
    })

    it('GRN สืบทอด tenant/branch จาก PO header (ไม่รับจากผู้เรียก)', () => {
      expect(wp4Src).toMatch(/v_po\.tenant_id, v_po\.branch_id/)
    })

    it('over-receive ถูกปฏิเสธ (partial receiving + multiple GRN lines)', () => {
      expect(wp4Src).toMatch(/Over-receive not allowed/)
      expect(wp4Src).toMatch(/v_pol\.received_qty \+ v_received_qty > v_pol\.ordered_qty/)
    })

    it('accepted + rejected = received ตรวจล่วงหน้า (ตรง CHECK ของ m220)', () => {
      expect(wp4Src).toMatch(/accepted_qty \+ rejected_qty must equal received_qty/)
    })

    it('approve = inventory/admin + status gate draft', () => {
      expect(wp4Src).toMatch(/is_inventory\(\) AND NOT public\.is_admin\(\)/)
      expect(wp4Src).toMatch(/v_gr\.status != 'draft'/)
    })
  })

  describe('WP6 — WAVG Posting + Reversal', () => {
    it('มี 5 functions ครบ', () => {
      expect(wp6Src).toMatch(/CREATE OR REPLACE FUNCTION calculate_grn_line_landed_cost\(/)
      expect(wp6Src).toMatch(/CREATE OR REPLACE FUNCTION compute_grn_payload_hash\(p_grn_id TEXT\)/)
      expect(wp6Src).toMatch(/CREATE OR REPLACE FUNCTION post_goods_receipt_line\(/)
      expect(wp6Src).toMatch(/CREATE OR REPLACE FUNCTION post_goods_receipt\(\s*p_grn_id TEXT,\s*p_idempotency_key TEXT\s*\)/)
      expect(wp6Src).toMatch(/CREATE OR REPLACE FUNCTION reverse_grn\(\s*p_grn_id TEXT,\s*p_reason TEXT\s*\)/)
    })

    it('DEFECT-4: landed cost ตามสูตร m221 (subtotal − discount + shipping + non_recoverable tax)/received', () => {
      expect(wp6Src).toMatch(/v_grl\.received_qty \* v_grl\.actual_unit_price\) - v_grl\.line_discount/)
      expect(wp6Src).toMatch(/CASE WHEN v_grl\.tax_treatment = 'non_recoverable' THEN v_grl\.tax_amount ELSE 0 END/)
      expect(wp6Src).toMatch(/NULLIF\(v_grl\.received_qty, 0\)/)
    })

    it('WAVG ใช้ accepted_qty (คูณ conversion) ไม่ใช่ received_qty', () => {
      expect(wp6Src).toMatch(/v_accepted_use := v_grl\.accepted_qty \* v_grl\.conversion_factor/)
      expect(wp6Src).toMatch(/v_old_stock \* COALESCE\(v_old_wavg, 0\) \+ v_accepted_use \* v_landed_use/)
    })

    it('DEFECT-3: idempotency — key เดิม hash ตรง = คืนผลเดิม · hash ต่าง = ERR_IDEMPOTENCY_CONFLICT', () => {
      expect(wp6Src).toMatch(/IF v_gr\.idempotency_key = p_idempotency_key THEN/)
      expect(wp6Src).toMatch(/IF v_gr\.idempotency_payload_hash = v_payload_hash THEN/)
      expect(wp6Src).toMatch(/ERR_IDEMPOTENCY_CONFLICT/)
      expect(wp6Src).toMatch(/ERR_ALREADY_POSTED/)
    })

    it('DEFECT-3: payload hash เชิงดีเทอร์มินิสต์จากเนื้อหาเอกสาร', () => {
      expect(wp6Src).toMatch(/CREATE OR REPLACE FUNCTION compute_grn_payload_hash/)
      expect(wp6Src).toMatch(/string_agg/)
      expect(wp6Src).toMatch(/ORDER BY grl\.id/)
    })

    it('กัน line double-post (duplicate retry ไม่สร้าง stock tx ซ้ำ)', () => {
      expect(wp6Src).toMatch(/ERR_LINE_ALREADY_POSTED/)
      expect(wp6Src).toMatch(/FROM inventory_transactions\s*\n?\s*WHERE grn_line_id = p_grn_line_id AND reference_type = 'grn'/)
    })

    it('DEFECT-2: reversal เป็น positive mirror — ไม่มี qty/price ติดลบลง goods_receipt_lines', () => {
      // reversal line copy ค่าเดิมเป็นบวก
      expect(wp6Src).toMatch(/v_grl\.received_qty, v_grl\.accepted_qty, v_grl\.rejected_qty/)
      expect(wp6Src).toMatch(/v_grl\.actual_unit_price/)
      // ไม่มี -v_grl.received_qty / -v_grl.actual_unit_price ที่เป็นคอลัมน์เชิงลบเดิม
      expect(wp6Src).not.toMatch(/-\s*v_grl\.received_qty,\s*-?\s*v_grl\.accepted/)
    })

    it('DEFECT-2: stock ย้อนด้วย itx type=out + qty บวก (convention m019/m026)', () => {
      expect(wp6Src).toMatch(/v_grl\.ingredient_id, 'out', v_reversal_qty, v_landed_use/)
      expect(wp6Src).toMatch(/GREATEST\(current_stock - v_reversal_qty, 0\)/)
    })

    it('DEFECT-2: WAVG ย้อนด้วย landed cost ที่เก็บไว้ใน price history (ไม่อ่านคอลัมน์ที่ไม่มี)', () => {
      expect(wp6Src).toMatch(/price_type = 'landed' AND grn_line_id = v_grl\.id/)
      expect(wp6Src).not.toMatch(/v_grl\.landed_cost/)
    })

    it('DEFECT-2: ทำซ้ำไม่ได้ — unique_violation → ERR_ALREADY_REVERSED + status gate', () => {
      expect(wp6Src).toMatch(/EXCEPTION WHEN unique_violation THEN/)
      expect(wp6Src).toMatch(/ERR_ALREADY_REVERSED/)
      expect(wp6Src).toMatch(/v_gr\.status != 'posted'/)
      expect(wp6Src).toMatch(/ERR_REVERSAL_OF_REVERSAL/)
    })

    it('DEFECT-2: price history correction เป็น mirrored entry + อ้าง line ต้นฉบับ (ตรวจย้อนได้)', () => {
      expect(wp6Src).toMatch(/'correction', v_grl\.purchase_unit/)
      expect(wp6Src).toMatch(/-v_grl\.received_qty, -v_grl\.actual_unit_price/)
      expect(wp6Src).toMatch(/'GRN_REVERSAL'/)
    })

    it('PO line received_qty ห้ามติดลบหลัง reversal', () => {
      expect(wp6Src).toMatch(/GREATEST\(received_qty - v_grl\.received_qty, 0\)/)
    })

    it('post = inventory/admin + reversal window 30 วัน (admin/finance override)', () => {
      expect(wp6Src).toMatch(/is_inventory\(\) AND NOT public\.is_admin\(\)/)
      expect(wp6Src).toMatch(/INTERVAL '30 days'/)
    })

    it('price history เขียน 3 states + tenant/branch จาก GRN header', () => {
      expect(wp6Src).toMatch(/'committed'/)
      expect(wp6Src).toMatch(/'realized'/)
      expect(wp6Src).toMatch(/'landed'/)
      expect(wp6Src).toMatch(/v_gr\.tenant_id, v_gr\.branch_id/)
    })
  })

  describe('WP7/WP8 — Read APIs (SECURITY INVOKER — RLS บังคับจริง)', () => {
    it('WP7 get_purchase_price_history เป็น SECURITY INVOKER', () => {
      expect(wp7Src).toMatch(/CREATE OR REPLACE FUNCTION get_purchase_price_history\(/)
      expect(wp7Src).toMatch(/SECURITY INVOKER/)
      expect(wp7Src).not.toMatch(/SECURITY DEFINER/)
    })

    it('WP8 get_po_dashboard เป็น SECURITY INVOKER', () => {
      expect(wp8Src).toMatch(/CREATE OR REPLACE FUNCTION get_po_dashboard\(/)
      expect(wp8Src).toMatch(/SECURITY INVOKER/)
      expect(wp8Src).not.toMatch(/SECURITY DEFINER/)
    })

    it('WP7 กรองพารามิเตอร์ครบ (ingredient/supplier/type/date range + pagination clamp)', () => {
      expect(wp7Src).toMatch(/p_ingredient_id IS NULL OR ingredient_id = p_ingredient_id/)
      expect(wp7Src).toMatch(/LIMIT LEAST\(p_limit, 500\)/)
    })

    it('WP8 aggregate หลายชุด (counts/spend/outstanding/action items/top suppliers)', () => {
      expect(wp8Src).toMatch(/'po_counts'/)
      expect(wp8Src).toMatch(/'grn_pending'/)
      expect(wp8Src).toMatch(/'total_spend'/)
      expect(wp8Src).toMatch(/'outstanding_qty'/)
      expect(wp8Src).toMatch(/'pos_needing_action'/)
      expect(wp8Src).toMatch(/'grns_awaiting_approval'/)
      expect(wp8Src).toMatch(/'top_suppliers'/)
    })
  })

  describe('ไม่อ้างคอลัมน์ที่ไม่มีจริง (DEFECT-4/5 regression guard)', () => {
    it('ไม่มีการอ้าง goods_receipt_lines.landed_cost', () => {
      expect(wp6Src).not.toMatch(/v_grl\.landed_cost/)
    })

    it('ไม่มีการอ้าง goods_receipts.idempotency_key จาก 220 ผิดตำแหน่ง (คอลัมน์มีจริง + ใช้ถูกตาราง)', () => {
      // 220 มี idempotency_key ที่ goods_receipts (header) เท่านั้น
      expect(wp6Src).toMatch(/v_gr\.idempotency_key/)
      expect(wp6Src).not.toMatch(/v_grl\.idempotency_key/)
    })
  })
})
