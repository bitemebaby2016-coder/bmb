// ============================================
// Bite Me Baby — Phase 2 WP6 source-contract test (MIGRATION 226)
// STATIC SOURCE-CONTRACT ของ 226 (WAVG Posting + Reversal)
// runtime จริง พิสูจน์ใน e2e/contracts_wp6_226.sql (Docker replay)
// ============================================

import { describe, it, expect } from 'vitest'
import wp6 from '../../supabase/migrations/226_wavg_posting_reversal.sql?raw'

describe('Phase 2 WP6 — Migration 226 (WAVG Posting + Reversal) source-contract', () => {
  it('เป็น migration ที่มี BEGIN/COMMIT + ระบุ WP6', () => {
    expect(wp6).toMatch(/BEGIN;/)
    expect(wp6).toMatch(/COMMIT;/)
    expect(wp6).toMatch(/WP6/)
  })

  it('ทุก function SECURITY DEFINER + SET search_path', () => {
    expect((wp6.match(/SECURITY DEFINER/g) || []).length).toBeGreaterThanOrEqual(5)
    expect(wp6).toMatch(/SET search_path = public/)
  })

  it('ตรวจ role + has_org_row_scope ภายใน function (post/reverse)', () => {
    expect(wp6).toMatch(/public\.is_inventory\(\)/)
    expect(wp6).toMatch(/public\.has_org_row_scope\(v_gr\.tenant_id, v_gr\.branch_id\)/)
  })

  it('WP6 REMEDIATION: ไม่มี has_staff_branch_scope + Asia/Bangkok (ห้าม CURRENT_DATE)', () => {
    expect(wp6).not.toMatch(/has_staff_branch_scope\s*\(/)
    expect(wp6).toMatch(/Asia\/Bangkok/)
    expect(wp6).not.toMatch(/CURRENT_DATE/)
  })

  it('5 functions ครบ', () => {
    expect(wp6).toMatch(/CREATE OR REPLACE FUNCTION public\.calculate_grn_line_landed_cost\(/)
    expect(wp6).toMatch(/CREATE OR REPLACE FUNCTION public\.compute_grn_payload_hash\(p_grn_id TEXT\)/)
    expect(wp6).toMatch(/CREATE OR REPLACE FUNCTION public\.post_goods_receipt_line\(/)
    expect(wp6).toMatch(/CREATE OR REPLACE FUNCTION public\.post_goods_receipt\(\s*p_grn_id TEXT,\s*p_idempotency_key TEXT\s*\)/)
    expect(wp6).toMatch(/CREATE OR REPLACE FUNCTION public\.reverse_grn\(\s*p_grn_id TEXT,\s*p_reason TEXT\s*\)/)
  })

  it('DEFECT-4 landed cost ตาม m221 + WAVG ใช้ accepted_qty', () => {
    expect(wp6).toMatch(/v_grl\.received_qty \* v_grl\.actual_unit_price\) - v_grl\.line_discount/)
    expect(wp6).toMatch(/CASE WHEN v_grl\.tax_treatment = 'non_recoverable' THEN v_grl\.tax_amount ELSE 0 END/)
    expect(wp6).toMatch(/v_accepted_use := v_grl\.accepted_qty \* v_grl\.conversion_factor/)
    expect(wp6).toMatch(/v_old_stock \* COALESCE\(v_old_wavg, 0\) \+ v_accepted_use \* v_landed_use/)
  })

  it('DEFECT-3 idempotency: key+hash / conflict / already posted / line double-post', () => {
    expect(wp6).toMatch(/IF v_gr\.idempotency_key = p_idempotency_key THEN/)
    expect(wp6).toMatch(/IF v_gr\.idempotency_payload_hash = v_payload_hash THEN/)
    expect(wp6).toMatch(/ERR_IDEMPOTENCY_CONFLICT/)
    expect(wp6).toMatch(/ERR_ALREADY_POSTED/)
    expect(wp6).toMatch(/ERR_LINE_ALREADY_POSTED/)
  })

  it('DEFECT-2 reversal: positive mirror + out tx + correction + unique once', () => {
    expect(wp6).toMatch(/'out', v_reversal_qty, v_landed_use/)
    expect(wp6).toMatch(/GREATEST\(current_stock - v_reversal_qty, 0\)/)
    expect(wp6).toMatch(/'correction'/)
    expect(wp6).toMatch(/'GRN_REVERSAL'/)
    expect(wp6).toMatch(/ERR_ALREADY_REVERSED/)
    expect(wp6).toMatch(/v_gr\.status != 'posted'/)
    expect(wp6).not.toMatch(/v_grl\.landed_cost/)
  })

  it('price history 3 states + tenant/branch + audit', () => {
    expect(wp6).toMatch(/'committed'/)
    expect(wp6).toMatch(/'realized'/)
    expect(wp6).toMatch(/'landed'/)
    expect(wp6).toMatch(/v_gr\.tenant_id, v_gr\.branch_id/)
    expect(wp6).toMatch(/'grn_post'/)
    expect(wp6).toMatch(/'grn_reverse'/)
  })

  it('ไม่สร้างตารางซ้ำ + ไม่มี package_size', () => {
    expect(wp6).not.toMatch(/CREATE TABLE[^;]*(goods_receipts|purchase_orders|inventory_transactions)/)
    expect(wp6).not.toMatch(/package_size/)
  })
})