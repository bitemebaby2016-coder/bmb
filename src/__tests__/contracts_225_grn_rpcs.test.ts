// ============================================
// Bite Me Baby — Phase 2 WP4 source-contract test (MIGRATION 225)
// STATIC SOURCE-CONTRACT ของ 225 (GRN Workflow RPC)
// runtime จริง พิสูจน์ใน e2e/contracts_wp4_225.sql (Docker replay)
// ============================================

import { describe, it, expect } from 'vitest'
import wp4Migration from '../../supabase/migrations/225_grn_workflow_rpcs.sql?raw'

describe('Phase 2 WP4 — Migration 225 (GRN Workflow RPC) source-contract', () => {
  it('เป็น migration ที่มี BEGIN/COMMIT + ระบุ WP4', () => {
    expect(wp4Migration).toMatch(/BEGIN;/)
    expect(wp4Migration).toMatch(/COMMIT;/)
    expect(wp4Migration).toMatch(/WP4/)
  })

  it('ทุก function SECURITY DEFINER + SET search_path', () => {
    expect((wp4Migration.match(/SECURITY DEFINER/g) || []).length).toBeGreaterThanOrEqual(3)
    expect(wp4Migration).toMatch(/SET search_path = public/)
  })

  it('ตรวจ role + has_org_row_scope ภายใน function', () => {
    expect(wp4Migration).toMatch(/public\.is_staff\(\)/)
    expect(wp4Migration).toMatch(/public\.is_inventory\(\)/)
    expect(wp4Migration).toMatch(/public\.has_org_row_scope\(v_po\.tenant_id, v_po\.branch_id\)/)
  })

  it('WP4 REMEDIATION: ไม่มี has_staff_branch_scope + ใช้ Asia/Bangkok (ห้าม CURRENT_DATE)', () => {
    expect(wp4Migration).not.toMatch(/has_staff_branch_scope\s*\(/)
    expect(wp4Migration).toMatch(/Asia\/Bangkok/)
    expect(wp4Migration).not.toMatch(/CURRENT_DATE/)
  })

  it('3 functions ครบ + number format GRN-YYYYMMDD', () => {
    expect(wp4Migration).toMatch(/CREATE OR REPLACE FUNCTION public\.generate_grn_number\(\)/)
    expect(wp4Migration).toMatch(/CREATE OR REPLACE FUNCTION public\.create_grn_draft\(/)
    expect(wp4Migration).toMatch(/CREATE OR REPLACE FUNCTION public\.approve_grn\(p_grn_id TEXT\)/)
    expect(wp4Migration).toMatch(/nextval\('grn_number_seq'\)/)
    expect(wp4Migration).toMatch(/'GRN-' \|\| to_char\(v_today, 'YYYYMMDD'\)/)
  })

  it('GRN สืบทอด tenant/branch จาก PO + over-receive guard + acceptance balance', () => {
    expect(wp4Migration).toMatch(/v_po\.tenant_id, v_po\.branch_id/)
    expect(wp4Migration).toMatch(/ERR_OVER_RECEIVE/)
    expect(wp4Migration).toMatch(/v_committed \+ v_received_qty > v_pol\.ordered_qty/)
    expect(wp4Migration).toMatch(/ERR_ACCEPTANCE_BALANCE/)
  })

  it('approve = inventory/admin + status gate draft + audit', () => {
    expect(wp4Migration).toMatch(/NOT public\.is_inventory\(\) AND NOT public\.is_admin\(\)/)
    expect(wp4Migration).toMatch(/v_gr\.status <> 'draft'/)
    expect(wp4Migration).toMatch(/'grn_create'/)
    expect(wp4Migration).toMatch(/'grn_approve'/)
    expect(wp4Migration).toMatch(/public\.append_audit_log\(/)
  })

  it('ไม่สร้างตาราง GRN ซ้ำ + ไม่มี package_size', () => {
    expect(wp4Migration).not.toMatch(/CREATE TABLE[^;]*goods_receipts/)
    expect(wp4Migration).not.toMatch(/package_size/)
  })
})